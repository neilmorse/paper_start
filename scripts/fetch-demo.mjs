// 生成示例查询的演示兜底数据（CCF-A 预设真实响应）→ public/data/demo/<slug>.json。
// 额度耗尽/上游鉴权失败/断网时前端切换到此数据并横幅注明。
// 另生成 <slug>-refs.json：静态 1-hop 扩展批次，兜底模式下路线图/图谱无需再调 /works。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const key = process.env.OPENALEX_API_KEY;
const mailto = process.env.OPENALEX_MAILTO || "neilmorse@foxmail.com";
if (!key) throw new Error("OPENALEX_API_KEY 未配置");

const catalog = JSON.parse(await readFile(join(ROOT, "public", "data", "ccf-venues.json"), "utf8"));
const ids = [...new Set(catalog.venues.filter((v) => v.rank === "A").flatMap((v) => v.sourceIds).filter(Boolean))];
const chunks = [];
for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

const REFS_CAP = 50;
const FETCH_CAP = 200;
const SELECT = "id,doi,title,display_name,publication_year,cited_by_count,authorships,primary_location,biblio,type,open_access,ids,referenced_works";
const QUERIES = ["graph neural network", "large language model", "diffusion model"];

const workIdOf = (id) => (/(W\d+)$/.exec(id ?? "") || [])[1] ?? "";

function project(w) {
  const src = w.primary_location?.source ?? null;
  const m = /(S\d+)$/.exec(src?.id ?? "");
  const authorships = w.authorships ?? [];
  const refs = Array.isArray(w.referenced_works) ? w.referenced_works : [];
  return {
    id: w.id,
    doi: w.doi ?? null,
    title: w.title ?? w.display_name ?? "",
    display_name: w.display_name ?? "",
    publication_year: w.publication_year ?? null,
    cited_by_count: w.cited_by_count ?? 0,
    type: w.type ?? null,
    authors: authorships.slice(0, 8).map((a) => a.author?.display_name ?? "").filter(Boolean),
    venue: src?.display_name ?? null,
    sourceId: m ? m[1] : "",
    sourceType: src?.type ?? null,
    biblio: w.biblio ?? null,
    oaUrl: w.open_access?.oa_url ?? null,
    url: w.ids?.openalex ?? w.id ?? null,
    referenced_works: refs.slice(0, REFS_CAP),
    refsTotal: refs.length,
    refsTruncated: refs.length > REFS_CAP,
    countries: [...new Set(authorships.flatMap((a) => (a.institutions ?? []).map((i) => i.country_code).filter(Boolean)))].sort(),
    firstAuthorCountry: authorships[0]?.institutions?.[0]?.country_code ?? null,
  };
}

async function fetchWorks(params) {
  const u = new URL("https://api.openalex.org/works");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("select", SELECT);
  u.searchParams.set("mailto", mailto);
  u.searchParams.set("api_key", key);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`demo fetch HTTP ${res.status}`);
  return res.json();
}

// 与 src/lib/citations.ts 同规则：候选=core refs 并集−core ids，freq↓→id↑ 截 FETCH_CAP，≤2 批取文。
async function buildRefs(core) {
  const coreIds = new Set(core.map((p) => workIdOf(p.id)));
  const freq = new Map();
  for (const p of core) {
    for (const ref of p.referenced_works ?? []) {
      const wid = workIdOf(ref);
      if (!wid || coreIds.has(wid)) continue;
      freq.set(wid, (freq.get(wid) ?? 0) + 1);
    }
  }
  const candidates = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, FETCH_CAP)
    .map(([wid]) => wid);
  const out = [];
  for (let i = 0; i < candidates.length; i += 100) {
    const batch = candidates.slice(i, i + 100);
    const j = await fetchWorks({ filter: `ids.openalex:${batch.join("|")}`, "per-page": "100" });
    out.push(...(j.results ?? []).map(project));
    await new Promise((r) => setTimeout(r, 250));
  }
  const seen = new Set();
  return out.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

await mkdir(join(ROOT, "public", "data", "demo"), { recursive: true });
for (const q of QUERIES) {
  const all = [];
  for (const chunk of chunks) {
    const j = await fetchWorks({ search: q, filter: `primary_location.source.id:${chunk.join("|")}`, "per-page": "50" });
    all.push(...(j.results ?? []).map(project));
    await new Promise((r) => setTimeout(r, 250));
  }
  const seen = new Set();
  const merged = all.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  merged.sort((a, b) => b.cited_by_count - a.cited_by_count || a.id.localeCompare(b.id));
  const slug = q.toLowerCase().replace(/\s+/g, "-");
  await writeFile(
    join(ROOT, "public", "data", "demo", `${slug}.json`),
    JSON.stringify({ demo: true, query: q, meta: { count: merged.length }, results: merged }, null, 2) + "\n",
  );
  const refs = await buildRefs(merged);
  await writeFile(
    join(ROOT, "public", "data", "demo", `${slug}-refs.json`),
    JSON.stringify({ demo: true, query: q, results: refs }, null, 2) + "\n",
  );
  console.log(`[demo] ${q} → ${merged.length} 条 + refs ${refs.length} 条（CCF-A，${chunks.length} 批）`);
}