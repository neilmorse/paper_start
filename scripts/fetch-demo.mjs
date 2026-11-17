// 生成示例查询的演示兜底数据（CCF-A 预设真实响应）→ public/data/demo/<slug>.json。
// 额度耗尽/上游鉴权失败/断网时前端切换到此数据并横幅注明。
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

const SELECT = "id,doi,title,display_name,publication_year,cited_by_count,authorships,primary_location,biblio,type,open_access,ids";
const QUERIES = ["graph neural network", "large language model", "diffusion model"];

function project(w) {
  const src = w.primary_location?.source ?? null;
  const m = /(S\d+)$/.exec(src?.id ?? "");
  return {
    id: w.id,
    doi: w.doi ?? null,
    title: w.title ?? w.display_name ?? "",
    display_name: w.display_name ?? "",
    publication_year: w.publication_year ?? null,
    cited_by_count: w.cited_by_count ?? 0,
    type: w.type ?? null,
    authors: (w.authorships ?? []).slice(0, 8).map((a) => a.author?.display_name ?? "").filter(Boolean),
    venue: src?.display_name ?? null,
    sourceId: m ? m[1] : "",
    sourceType: src?.type ?? null,
    biblio: w.biblio ?? null,
    oaUrl: w.open_access?.oa_url ?? null,
    url: w.ids?.openalex ?? w.id ?? null,
  };
}

await mkdir(join(ROOT, "public", "data", "demo"), { recursive: true });
for (const q of QUERIES) {
  const all = [];
  for (const chunk of chunks) {
    const u = new URL("https://api.openalex.org/works");
    u.searchParams.set("search", q);
    u.searchParams.set("filter", `primary_location.source.id:${chunk.join("|")}`);
    u.searchParams.set("per-page", "50");
    u.searchParams.set("select", SELECT);
    u.searchParams.set("mailto", mailto);
    u.searchParams.set("api_key", key);
    const res = await fetch(u);
    if (!res.ok) throw new Error(`demo fetch HTTP ${res.status} for ${q}`);
    const j = await res.json();
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
  console.log(`[demo] ${q} → ${merged.length} 条（CCF-A，${chunks.length} 批）`);
}