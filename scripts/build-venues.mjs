// M1 Step5：产出 public/data/ccf-venues.json + coverage-report.json + docs/coverage-report.md。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildVenueRecord, computeCoverage, renderCoverageMarkdown } from "./lib/build.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const merged = JSON.parse(await readFile(join(ROOT, "data", "parsed", "merged.json"), "utf8"));
const sources = JSON.parse(await readFile(join(ROOT, "data", "parsed", "sources.json"), "utf8"));
const ccfddl = JSON.parse(await readFile(join(ROOT, "data", "raw", "ccfddl.json"), "utf8"));

const domainToSub = new Map(ccfddl.domains.map((d) => [d.name, d.sub]));
const venues = merged.venues.map((v) => {
  const r = buildVenueRecord(v);
  r.domainSub = domainToSub.get(r.domain) ?? null;
  return r;
});
const domains = ccfddl.domains.map((d) => ({
  sub: d.sub,
  name: d.name,
  nameEn: d.nameEn,
  venueCount: venues.filter((v) => v.domain === d.name).length,
}));

const coverage = computeCoverage(venues, sources.listedInDiff ?? []);
const generatedAt = new Date().toISOString();
const attribution = {
  ccf: "CCF 推荐国际学术会议和期刊目录 2026 年 3 月第七版（官方公开事实数据）",
  sources: ["hitfyd/ShowJCR（仓库 GPL-3.0）", "ccfddl/ccf-deadlines（MIT）", "OpenAlex"],
  details: "docs/data-sources.md",
};

await mkdir(join(ROOT, "public", "data"), { recursive: true });
await writeFile(
  join(ROOT, "public", "data", "ccf-venues.json"),
  JSON.stringify({ version: "ccf-2026-03", generatedAt, attribution, domains, venues }, null, 2) + "\n",
);
await writeFile(
  join(ROOT, "public", "data", "coverage-report.json"),
  JSON.stringify({ version: "ccf-2026-03", generatedAt, ...coverage }, null, 2) + "\n",
);
await writeFile(join(ROOT, "docs", "coverage-report.md"), renderCoverageMarkdown(coverage, domains));

console.log("[build] public/data/ccf-venues.json + coverage-report.json + docs/coverage-report.md");
console.log(`  venues ${venues.length}，解析 ${coverage.overall.resolved}（${(coverage.overall.resolutionRate * 100).toFixed(1)}%）`);
console.log(`  期刊 ${coverage.overall.journal.resolved}/${coverage.overall.journal.total}，会议 ${coverage.overall.conference.resolved}/${coverage.overall.conference.total}`);
console.log(`  覆盖警告 ${coverage.coverageWarnings.length}，未解析 ${coverage.unresolved.length}，listed_in 差异 ${coverage.listedInDiff.length}`);
console.log(`  领域 ${domains.length}：${domains.map((d) => `${d.sub}(${d.venueCount})`).join(" ")}`);