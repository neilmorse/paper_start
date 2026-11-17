// Qoder Sites app Function：OpenAlex 代理 + 缓存 + 错误映射 + LLM 桩。
// 纯函数 handler(req)，index.ts 保持 Deno.serve(handler)。相对导入 + 显式 .ts 扩展名。
import { LruTtlCache } from "./cache.ts";
import { llmConfigured, handleAi } from "./llm.ts";
import { openalexFetch, openalexKey, UpstreamError } from "./openalex.ts";

const SEARCH_TTL = 10 * 60 * 1000;
const WORKS_TTL = 30 * 60 * 1000;
const searchCache = new LruTtlCache(500);
const worksCache = new LruTtlCache(500);

const WORK_SELECT =
  "id,doi,title,display_name,publication_year,cited_by_count,authorships,primary_location,biblio,type,open_access,ids";

// per-IP 令牌桶 120req/min（一次全目录检索 ≈8 底层请求，共享 NAT 评委不误伤）
const RATE = 120;
const WINDOW = 60000;
const buckets = new Map<string, { tokens: number; updated: number }>();
function rateLimited(ip: string, now = Date.now()): boolean {
  let b = buckets.get(ip);
  if (!b) {
    b = { tokens: RATE, updated: now };
    buckets.set(ip, b);
  }
  b.tokens = Math.min(RATE, b.tokens + (now - b.updated) * (RATE / WINDOW));
  b.updated = now;
  if (b.tokens < 1) return true;
  b.tokens -= 1;
  return false;
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...extra } });
}
const badInput = (message: string) => json({ ok: false, error: "invalid_input", message }, 400);

function sourceIdOf(src: { id?: string } | null): string {
  const m = /(S\d+)$/.exec(src?.id ?? "");
  return m ? m[1] : "";
}

// 服务端二次投影：作者裁前 8 只留名；列表不含 abstract_inverted_index；含 biblio + source.type。
function projectWork(w: Record<string, any>, withAbstract = false): Record<string, unknown> {
  const src = w.primary_location?.source ?? null;
  const out: Record<string, unknown> = {
    id: w.id,
    doi: w.doi ?? null,
    title: w.title ?? w.display_name ?? "",
    display_name: w.display_name ?? "",
    publication_year: w.publication_year ?? null,
    cited_by_count: w.cited_by_count ?? 0,
    type: w.type ?? null,
    authors: (w.authorships ?? [])
      .slice(0, 8)
      .map((a: any) => a.author?.display_name ?? "")
      .filter(Boolean),
    venue: src?.display_name ?? null,
    sourceId: sourceIdOf(src),
    sourceType: src?.type ?? null,
    biblio: w.biblio ?? null,
    oaUrl: w.open_access?.oa_url ?? null,
    url: w.ids?.openalex ?? w.id ?? null,
  };
  if (withAbstract) out.abstract_inverted_index = w.abstract_inverted_index ?? null;
  return out;
}

async function handleSearch(url: URL): Promise<Response> {
  const q = url.searchParams.get("q")?.trim() ?? "";
  const sourcesRaw = url.searchParams.get("sources")?.trim() ?? "";
  const yearFrom = url.searchParams.get("yearFrom") ?? "";
  const yearTo = url.searchParams.get("yearTo") ?? "";
  const perPage = Number(url.searchParams.get("perPage") ?? "25");
  const cursor = url.searchParams.get("cursor") ?? "*";

  if (!q && !sourcesRaw) return badInput("q 或 sources 必填");
  let sourceIds: string[] = [];
  if (sourcesRaw) {
    sourceIds = sourcesRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (sourceIds.length > 100 || sourceIds.some((s) => !/^S\d+$/.test(s))) {
      return badInput("sources 须为 ≤100 个 S ID");
    }
  }
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 50) return badInput("perPage 须 1..50");
  for (const y of [yearFrom, yearTo]) {
    if (y && !/^\d{4}$/.test(y)) return badInput("年份须 YYYY");
  }

  const filterParts: string[] = [];
  if (sourceIds.length) filterParts.push(`primary_location.source.id:${sourceIds.join("|")}`);
  if (yearFrom) filterParts.push(`from_publication_year:${yearFrom}`);
  if (yearTo) filterParts.push(`to_publication_year:${yearTo}`);
  const params: Record<string, string> = { "per-page": String(perPage), cursor, select: WORK_SELECT };
  if (q) params.search = q;
  if (filterParts.length) params.filter = filterParts.join(",");

  const cacheKey = "search:" + JSON.stringify(params);
  const cached = searchCache.get(cacheKey);
  if (cached) return json(cached);
  const body = (await openalexFetch("/works", params)) as any;
  const result = {
    ok: true,
    meta: { count: body.meta?.count ?? 0, perPage, next_cursor: body.meta?.next_cursor ?? null },
    results: (body.results ?? []).map((w: any) => projectWork(w)),
  };
  searchCache.set(cacheKey, result, SEARCH_TTL);
  return json(result);
}

async function handleWorks(url: URL): Promise<Response> {
  const idsRaw = url.searchParams.get("ids")?.trim() ?? "";
  if (!idsRaw) return badInput("ids 必填");
  const ids = idsRaw.split("|").map((s) => s.trim()).filter(Boolean);
  if (ids.length > 100 || ids.some((id) => !/^W\d+$/.test(id))) {
    return badInput("ids 须 ≤100 个 W ID（| 分隔）");
  }
  const params: Record<string, string> = {
    filter: `ids.openalex:${ids.join("|")}`,
    "per-page": "100",
    select: WORK_SELECT,
  };
  const cacheKey = "works:" + JSON.stringify(params);
  const cached = worksCache.get(cacheKey);
  if (cached) return json(cached);
  const body = (await openalexFetch("/works", params)) as any;
  const result = { ok: true, results: (body.results ?? []).map((w: any) => projectWork(w)) };
  worksCache.set(cacheKey, result, WORKS_TTL);
  return json(result);
}

async function handleWork(url: URL): Promise<Response> {
  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!/^W\d+$/.test(id)) return badInput("id 须 W ID");
  const body = (await openalexFetch(`/works/${id}`, {})) as any; // 单条 ID 查询免费
  return json({ ok: true, work: projectWork(body, true) });
}

const GET_PATHS = ["/health", "/search", "/works", "/work"];

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // 网关替换函数名段（app → app-d<hash>），按子路径尾部路由
  const m = url.pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/);
  if (!m) return json({ ok: false, error: "not_found" }, 404);
  const path = m[1] || "/";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return json({ ok: false, error: "rate_limited" }, 429);

  try {
    if (path === "/health" && req.method === "GET") {
      return json({ ok: true, openalexKeyConfigured: Boolean(openalexKey()), llmConfigured: llmConfigured() });
    }
    if (path === "/search" && req.method === "GET") return await handleSearch(url);
    if (path === "/works" && req.method === "GET") return await handleWorks(url);
    if (path === "/work" && req.method === "GET") return await handleWork(url);
    if (path === "/ai/keywords" || path === "/ai/survey") return await handleAi(path, req);
    if (GET_PATHS.includes(path)) return json({ ok: false, error: "method_not_allowed" }, 405, { Allow: "GET" });
    return json({ ok: false, error: "not_found" }, 404);
  } catch (e) {
    if (e instanceof UpstreamError) return json({ ok: false, error: e.code }, e.status);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}