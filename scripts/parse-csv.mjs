// M1 Step2：解析 ShowJCR CCF2026 CSV → data/parsed/venues.json。
// 硬校验 681/295/386 与 A/B/C 分布，不符即报错退出（防上游悄悄改版）。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./lib/csv.mjs";
import { assertExpectedCounts, rowToVenue, tally } from "./lib/venues.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const text = await readFile(join(ROOT, "data", "raw", "CCF2026-UTF8.csv"), "utf8");
const rows = parseCsv(text);
const header = rows[0];
if (header?.[0] !== "刊物名称" || header.length !== 8) {
  throw new Error(`CSV 表头不符（上游可能改版）：${JSON.stringify(header)}`);
}
const venues = rows
  .slice(1)
  .filter((r) => r.some((c) => c.trim() !== ""))
  .map(rowToVenue);

const t = tally(venues);
assertExpectedCounts(t);
for (const v of venues) {
  if (v.year !== 2026) throw new Error(`非 2026 版条目：${v.abbr || v.name} year=${v.year}`);
}

const outDir = join(ROOT, "data", "parsed");
await mkdir(outDir, { recursive: true });
await writeFile(
  join(outDir, "venues.json"),
  JSON.stringify({ source: "data/raw/CCF2026-UTF8.csv", edition: "ccf-2026-03", venues }, null, 2) + "\n",
);

console.log(`[parse] ${venues.length} venues → data/parsed/venues.json`);
console.log(`  期刊 ${t.journal.total}（A${t.journal.A}/B${t.journal.B}/C${t.journal.C}）`);
console.log(`  会议 ${t.conference.total}（A${t.conference.A}/B${t.conference.B}/C${t.conference.C}）`);
const domains = [...new Set(venues.map((v) => v.domain))];
console.log(`  领域 ${domains.length}：${domains.join("、")}`);
console.log(`  无缩写条目 ${venues.filter((v) => !v.abbr).length}（matchKey 回退全称）`);