// M1 Step4：归并 + 人工核对清单。
// issn_l 归并改名期刊（一 venue→sourceIds[]，filter 请求便宜且缓存）；合并 ccfddl 别名与 manual/aliases.json；
// unresolved/中置信/歧义 → data/review/unresolved.md（A 级优先，裁不完不阻塞）。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSource } from "./lib/match.mjs";
import { formatReviewMarkdown, mergeAliases, mergeSourceIds, needsReview } from "./lib/merge.mjs";
import { matchKey } from "./lib/normalize.mjs";
import { BudgetError, budgetState, openalexGet } from "./lib/openalex.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const sources = JSON.parse(await readFile(join(ROOT, "data", "parsed", "sources.json"), "utf8"));
const ccfddl = JSON.parse(await readFile(join(ROOT, "data", "raw", "ccfddl.json"), "utf8"));
let manualAliases = {};
try {
  manualAliases = JSON.parse(await readFile(join(ROOT, "data", "manual", "aliases.json"), "utf8"));
} catch {
  manualAliases = {};
}

const ccfddlByDb = new Map(ccfddl.conferences.filter((c) => c.dblp).map((c) => [c.dblp, c]));
const ccfddlByAbbr = new Map(ccfddl.conferences.map((c) => [matchKey(c.abbr), c]));

const ISSN_MERGE = !process.argv.includes("--no-issn-merge");
let issnStopped = false;
const merged = [];

for (const v of sources.venues) {
  let sourceIds = [...v.sourceIds];
  let ccf = null;
  if (v.type === "conference") {
    ccf = (v.dblpKey && ccfddlByDb.get(v.dblpKey)) || ccfddlByAbbr.get(matchKey(v.abbr)) || null;
  }
  const aliases = mergeAliases(
    v.alternateTitles,
    ccf ? [ccf.abbr, ccf.name] : [],
    manualAliases[v.key],
    v.abbr ? [v.abbr] : [],
  );
  const dblpKey = v.dblpKey || ccf?.dblp || "";

  if (ISSN_MERGE && !issnStopped && v.type === "journal" && v.issnL && sourceIds.length) {
    try {
      const body = await openalexGet("/sources", { filter: `issn_l:${v.issnL}`, "per-page": 50 });
      const extra = (body.results ?? [])
        .map(normalizeSource)
        .filter((s) => s.type === "journal")
        .map((s) => s.id);
      sourceIds = mergeSourceIds(sourceIds, extra);
    } catch (e) {
      if (e instanceof BudgetError) {
        issnStopped = true;
        console.warn(`[budget] issn 归并提前停止：${e.message}（剩余期刊保留单 source，重跑免费续）`);
      } else {
        throw e;
      }
    }
  }

  const mv = { ...v, sourceIds, aliases, dblpKey, ccfddlSub: ccf?.sub ?? null };
  mv.review = needsReview(mv);
  merged.push(mv);
}

const reviewVenues = merged.filter((v) => v.review);
const multiSource = merged.filter((v) => v.sourceIds.length > 1);
const summary = {
  total: merged.length,
  resolved: merged.filter((v) => v.sourceIds.length > 0).length,
  review: reviewVenues.length,
  reviewByRank: Object.fromEntries(["A", "B", "C"].map((r) => [r, reviewVenues.filter((v) => v.rank === r).length])),
  multiSourceVenues: multiSource.length,
  issnMergeStopped: issnStopped,
};

await mkdir(join(ROOT, "data", "parsed"), { recursive: true });
await mkdir(join(ROOT, "data", "review"), { recursive: true });
await writeFile(
  join(ROOT, "data", "parsed", "merged.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), budget: budgetState(), summary, venues: merged }, null, 2) + "\n",
);
await writeFile(join(ROOT, "data", "review", "unresolved.md"), formatReviewMarkdown(reviewVenues));

console.log("[merge summary]", JSON.stringify(summary, null, 2));
console.log(`[issn 归并] 多 source venue ${multiSource.length} 个：`);
for (const v of multiSource.slice(0, 10)) console.log(`  ${v.abbr || v.name} → ${v.sourceIds.join(", ")}`);
console.log(`[review] ${reviewVenues.length} 条 → data/review/unresolved.md`);