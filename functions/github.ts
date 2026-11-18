// GitHub 相关仓库代理：代码内固定出站 api.github.com（平台无出站域名配置）。
// 24h LRU 缓存 + 403/429 cooldown 短路（共享出口未认证仅 60req/hr）；可选 GITHUB_TOKEN 提额。
// 诚实度硬约束：标题模糊匹配，UI 必须标「相关仓库（非官方认证）」，不得声称官方代码。
import { LruTtlCache } from "./cache.ts";

const GITHUB_HOST = "https://api.github.com";
const CACHE_TTL = 24 * 60 * 60 * 1000;
const cache = new LruTtlCache(200);
let cooldownUntil = 0;

const STOP = new Set(["a", "an", "the", "on", "of", "for", "and", "with", "to", "in", "via", "using", "toward", "towards", "based"]);

export function githubToken(): string | undefined {
  return Deno.env.get("GITHUB_TOKEN") || undefined;
}

export function buildRepoQuery(title: string): string {
  const words = (title.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w));
  return words.slice(0, 5).join(" ");
}

export interface RepoHit {
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  language: string | null;
  license: string | null;
  pushedAt: string | null;
  fork: boolean;
  archived: boolean;
  score: number;
}

// 仅排序不声称权威：标题词命中×3 + log(stars) + 近半年活跃加分 − fork/archived 罚分。
export function scoreRepo(repo: any, titleWords: string[], now = Date.now()): number {
  const hay = `${repo.name ?? ""} ${repo.description ?? ""}`.toLowerCase();
  let score = titleWords.filter((w) => hay.includes(w)).length * 3;
  score += Math.log10((repo.stargazers_count ?? 0) + 1);
  const pushed = repo.pushed_at ? Date.parse(repo.pushed_at) : 0;
  if (pushed && now - pushed < 180 * 86400000) score += 2;
  if (repo.fork) score -= 2;
  if (repo.archived) score -= 3;
  return score;
}

export function projectRepo(repo: any, titleWords: string[], now = Date.now()): RepoHit {
  return {
    fullName: repo.full_name ?? "",
    url: repo.html_url ?? "",
    description: repo.description ?? null,
    stars: repo.stargazers_count ?? 0,
    language: repo.language ?? null,
    license: repo.license?.spdx_id ?? null,
    pushedAt: repo.pushed_at ?? null,
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    score: scoreRepo(repo, titleWords, now),
  };
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function handleGithub(url: URL): Promise<Response> {
  const title = url.searchParams.get("title")?.trim() ?? "";
  if (title.length < 4 || title.length > 200) return json({ ok: false, error: "invalid_input", message: "title 须 4..200 字符" }, 400);
  const q = buildRepoQuery(title);
  if (!q) return json({ ok: false, error: "invalid_input", message: "标题无有效检索词" }, 400);

  const cacheKey = "github:" + q;
  const cached = cache.get(cacheKey);
  if (cached) return json(cached);
  if (Date.now() < cooldownUntil) return json({ ok: false, error: "github_rate_limited" }, 429);

  const u = new URL(GITHUB_HOST + "/search/repositories");
  u.searchParams.set("q", q);
  u.searchParams.set("sort", "stars");
  u.searchParams.set("order", "desc");
  u.searchParams.set("per_page", "5");
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "paperstart" };
  const token = githubToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(u, { headers, signal: AbortSignal.timeout(15000) });
  } catch {
    return json({ ok: false, error: "github_unreachable" }, 502);
  }
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
    cooldownUntil = reset > Date.now() ? reset : Date.now() + 60000;
    return json({ ok: false, error: "github_rate_limited" }, 429);
  }
  if (!res.ok) return json({ ok: false, error: "github_unreachable" }, 502);

  const body = (await res.json()) as any;
  const words = q.split(" ");
  const repos = (body.items ?? [])
    .map((r: any) => projectRepo(r, words))
    .sort((a: RepoHit, b: RepoHit) => b.score - a.score || b.stars - a.stars || a.fullName.localeCompare(b.fullName));
  const result = { ok: true, query: q, repos };
  cache.set(cacheKey, result, CACHE_TTL);
  return json(result);
}