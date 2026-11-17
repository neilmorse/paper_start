// M1 Step3：venue → OpenAlex source 解析。
// 期刊：listed_in:ccf-a/b/c 批量 filter 池匹配（低置信回落全称 search）。
// 会议：逐个 search 缩写（全称仅低置信回落，≤2 次/会议）。
// 限速≤5rps、重试2、响应缓存 data/cache/openalex/、预算守卫（x-ratelimit-remaining-usd）。
// 锚点 overrides 走免费单条 ID 查询富化元数据。裁不完标 unresolved/budget-stopped，不阻塞。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAcceptable, normalizeSource, rankCandidates } from "./lib/match.mjs";
import { coreSearchTerm, matchKey } from "./lib/normalize.mjs";
import { BudgetError, budgetState, openalexGet } from "./lib/openalex.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const { venues } = JSON.parse(await readFile(join(ROOT, "data", "parsed", "venues.json"), "utf8"));
const overrides = JSON.parse(await readFile(join(ROOT, "data", "manual", "overrides.json"), "utf8"));

const round = (n) => +n.toFixed(3);
const venueKey = (v) => `${v.type}:${v.matchKey}`;
const results = [];
const listedInDiff = [];
let stopped = false;

function candidateView(r) {
  return {
    id: r.source.id,
    displayName: r.source.displayName,
    type: r.source.type,
    score: round(r.score),
    confidence: r.confidence,
    worksCount: r.source.worksCount,
  };
}

function evaluate(v, sources, method) {
  const ranked = rankCandidates(v, sources);
  const best = ranked[0] ?? null;
  const candidates = ranked.slice(0, 5).map(candidateView);
  if (best && isAcceptable(best)) {
    return {
      resolved: {
        sourceIds: [best.source.id],
        displayName: best.source.displayName,
        confidence: best.confidence,
        score: round(best.score),
        method,
        worksCount: best.source.worksCount,
        citedByCount: best.source.citedByCount,
        issnL: best.source.issnL,
        issn: best.source.issn,
        alternateTitles: best.source.alternateTitles,
        listedIn: best.source.listedIn,
        candidates,
      },
      candidates,
    };
  }
  return { resolved: null, candidates };
}

const unresolved = (candidates, method = "unresolved") => ({
  sourceIds: [],
  displayName: "",
  confidence: "low",
  score: 0,
  method,
  worksCount: null,
  candidates,
});

async function fromOverride(v) {
  const o = overrides[v.abbr];
  if (!o) return null;
  const srcs = [];
  for (const id of o.sourceIds) {
    srcs.push(normalizeSource(await openalexGet(`/sources/${id}`))); // 单条 ID 查询免费
  }
  const best = srcs[0];
  return {
    sourceIds: o.sourceIds,
    displayName: best?.displayName ?? "",
    confidence: "high",
    score: 1,
    method: "override",
    worksCount: best?.worksCount ?? null,
    citedByCount: best?.citedByCount ?? null,
    issnL: best?.issnL ?? "",
    issn: best?.issn ?? [],
    alternateTitles: best?.alternateTitles ?? [],
    listedIn: best?.listedIn ?? [],
    candidates: [],
    note: o.note,
  };
}

async function fetchJournalPool() {
  const pool = [];
  for (const rank of ["a", "b", "c"]) {
    let page = 1;
    for (;;) {
      const body = await openalexGet("/sources", { filter: `listed_in:ccf-${rank}`, "per-page": 100, page });
      const srcs = (body.results ?? []).map(normalizeSource);
      pool.push(...srcs);
      const count = body.meta?.count ?? 0;
      if (srcs.length === 0 || page * 100 >= count) break;
      page++;
    }
  }
  return pool;
}

async function resolveJournal(v, pool) {
  const ov = await fromOverride(v);
  if (ov) return ov;
  let r = evaluate(v, pool, "listed_in");
  if (r.resolved) return r.resolved;
  const body = await openalexGet("/sources", { search: v.name, "per-page": 8 });
  r = evaluate(v, (body.results ?? []).map(normalizeSource), "search-name");
  return r.resolved ?? unresolved(r.candidates);
}

async function resolveConference(v) {
  const ov = await fromOverride(v);
  if (ov) return ov;
  const term = v.abbr || v.name;
  let body = await openalexGet("/sources", { search: term, "per-page": 10 });
  let r = evaluate(v, (body.results ?? []).map(normalizeSource), "search");
  if (r.resolved) return r.resolved;
  if (v.abbr) {
    body = await openalexGet("/sources", { search: v.name, "per-page": 10 });
    r = evaluate(v, (body.results ?? []).map(normalizeSource), "search-name");
    if (r.resolved) return r.resolved;
  }
  const core = coreSearchTerm(v.name);
  if (core && core !== matchKey(term)) {
    body = await openalexGet("/sources", { search: core, "per-page": 10 });
    r = evaluate(v, (body.results ?? []).map(normalizeSource), "search-core");
    if (r.resolved) return r.resolved;
  }
  return unresolved(r.candidates);
}

function record(v, res) {
  const liRank = (res.listedIn ?? []).find((t) => /^ccf-[abc]$/.test(t));
  if (v.type === "journal" && liRank && liRank.slice(4) !== v.rank.toLowerCase()) {
    listedInDiff.push({ key: venueKey(v), abbr: v.abbr, name: v.name, csvRank: v.rank, listedInRank: liRank.slice(4).toUpperCase() });
  }
  results.push({
    key: venueKey(v),
    abbr: v.abbr,
    name: v.name,
    type: v.type,
    rank: v.rank,
    domain: v.domain,
    dblpKey: v.dblpKey,
    ...res,
  });
}

// 解析顺序：期刊先（池匹配省额度），会议按 A→B→C（预算紧张时 C 级先标 unresolved，A 级优先）
const order = [
  ...venues.filter((v) => v.type === "journal"),
  ...["A", "B", "C"].flatMap((r) => venues.filter((v) => v.type === "conference" && v.rank === r)),
];

let i = 0;
let journalPool = [];
try {
  journalPool = await fetchJournalPool();
  console.log(`[pool] listed_in CCF 期刊池 ${journalPool.length} 个 source`);
  for (; i < order.length; i++) {
    const v = order[i];
    const res = v.type === "journal" ? await resolveJournal(v, journalPool) : await resolveConference(v);
    record(v, res);
    if ((i + 1) % 50 === 0) {
      const b = budgetState();
      console.log(`  …${i + 1}/${order.length}（spent $${b.spentUsd.toFixed(4)}，remaining $${b.remainingUsd}，cache ${b.cacheHits}）`);
    }
  }
} catch (e) {
  if (e instanceof BudgetError) {
    stopped = true;
    console.warn(`[budget] ${e.message}；剩余 ${order.length - i} 个标 budget-stopped（缓存重跑免费续解析）`);
    for (; i < order.length; i++) record(order[i], unresolved([], "budget-stopped"));
  } else {
    throw e;
  }
}

const count = (fn) => results.filter(fn).length;
const summary = {
  total: results.length,
  resolved: count((r) => r.sourceIds.length > 0),
  unresolved: count((r) => r.sourceIds.length === 0),
  byConfidence: {
    high: count((r) => r.confidence === "high"),
    medium: count((r) => r.confidence === "medium"),
    low: count((r) => r.confidence === "low"),
  },
  byMethod: Object.fromEntries(
    [...new Set(results.map((r) => r.method))].map((m) => [m, count((r) => r.method === m)]),
  ),
  journal: {
    total: count((r) => r.type === "journal"),
    resolved: count((r) => r.type === "journal" && r.sourceIds.length > 0),
  },
  conference: {
    total: count((r) => r.type === "conference"),
    resolved: count((r) => r.type === "conference" && r.sourceIds.length > 0),
  },
  listedInDiffCount: listedInDiff.length,
};

await mkdir(join(ROOT, "data", "parsed"), { recursive: true });
await writeFile(
  join(ROOT, "data", "parsed", "sources.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), budget: budgetState(), stopped, summary, listedInDiff, venues: results }, null, 2) + "\n",
);

console.log("\n[summary]", JSON.stringify(summary, null, 2));
console.log("[budget]", JSON.stringify(budgetState()));
const unresolvedList = results.filter((r) => r.sourceIds.length === 0);
console.log(`\n[unresolved ${unresolvedList.length}]（前 15）`);
for (const r of unresolvedList.slice(0, 15)) {
  console.log(`  ${r.rank} ${r.type} ${r.abbr || r.name} → ${r.method}；候选：${r.candidates.slice(0, 2).map((c) => `${c.displayName}(${c.score})`).join(" | ") || "无"}`);
}