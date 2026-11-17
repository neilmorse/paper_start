// M1 Step1：取底稿。ShowJCR CSV 直接下载；ccf-deadlines 浅克隆缓存后抽取会议字段。
// 重跑复用已下载底稿与克隆（--force 强制刷新），不重复消耗网络。
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const RAW = join(ROOT, "data", "raw");
const CACHE = join(ROOT, "data", "cache");
const FORCE = process.argv.includes("--force");

const SHOWJCR_CSV_URL =
  "https://raw.githubusercontent.com/hitfyd/ShowJCR/master/中科院分区表及JCR原始数据文件/CCF2026-UTF8.csv";
const CCFDDL_REPO_URL = "https://github.com/ccfddl/ccf-deadlines.git";

async function fetchShowjcrCsv() {
  const dest = join(RAW, "CCF2026-UTF8.csv");
  if (existsSync(dest) && !FORCE) {
    const bytes = (await readFile(dest)).length;
    console.log(`[showjcr] 复用底稿 ${relative(ROOT, dest)}（${bytes} bytes，--force 可重下）`);
    return { url: SHOWJCR_CSV_URL, bytes, reused: true };
  }
  const res = await fetch(SHOWJCR_CSV_URL);
  if (!res.ok) throw new Error(`ShowJCR CSV 下载失败：HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`[showjcr] 已下载 ${relative(ROOT, dest)}（${buf.length} bytes）`);
  return { url: SHOWJCR_CSV_URL, bytes: buf.length, reused: false };
}

async function fetchCcfddl() {
  const repoDir = join(CACHE, "ccfddl-repo");
  if (!existsSync(repoDir)) {
    execFileSync("git", ["clone", "--depth", "1", CCFDDL_REPO_URL, repoDir], { stdio: "inherit" });
  } else if (FORCE) {
    execFileSync("git", ["-C", repoDir, "pull", "--ff-only"], { stdio: "inherit" });
  }
  const commit = execFileSync("git", ["-C", repoDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const confRoot = join(repoDir, "conference");

  // conference/types.yml 是 10 领域定义（sub → 中英文名），非会议条目
  const typesDoc = parse(await readFile(join(confRoot, "types.yml"), "utf8"));
  const domains = typesDoc.map((d) => ({ sub: d.sub, name: d.name, nameEn: d.name_en }));

  const conferences = [];
  const subs = (await readdir(confRoot, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const sub of subs) {
    const files = (await readdir(join(confRoot, sub.name))).filter((f) => f.endsWith(".yml")).sort();
    for (const file of files) {
      const p = join(confRoot, sub.name, file);
      const doc = parse(await readFile(p, "utf8"));
      const item = Array.isArray(doc) ? doc[0] : doc;
      if (!item?.title) throw new Error(`ccfddl yml 缺少 title：${p}`);
      conferences.push({
        abbr: String(item.title).trim(),
        name: item.description ? String(item.description).trim() : "",
        sub: item.sub ?? sub.name,
        ccf: item.rank?.ccf ?? "",
        dblp: item.dblp ?? "",
        file: relative(repoDir, p),
      });
    }
  }
  const dest = join(RAW, "ccfddl.json");
  await writeFile(dest, JSON.stringify({ source: CCFDDL_REPO_URL, commit, domains, conferences }, null, 2) + "\n");
  console.log(`[ccfddl] ${conferences.length} 个会议 + ${domains.length} 个领域 → ${relative(ROOT, dest)}（commit ${commit.slice(0, 7)}）`);
  return { repo: CCFDDL_REPO_URL, commit, conferences: conferences.length, domains: domains.length };
}

await mkdir(RAW, { recursive: true });
await mkdir(CACHE, { recursive: true });
const meta = { fetchedAt: new Date().toISOString() };
meta.showjcr = await fetchShowjcrCsv();
meta.ccfddl = await fetchCcfddl();
await writeFile(join(RAW, "fetch-meta.json"), JSON.stringify(meta, null, 2) + "\n");
console.log("[done] 底稿就绪，元数据 → data/raw/fetch-meta.json");