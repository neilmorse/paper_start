// OpenAlex 上游客户端：代码内固定出站目标（平台无出站域名配置参数）。
// key 缺失降级无 key + mailto（每 IP $0.10/天）；错误映射不透传原始异常。
const OPENALEX_HOST = "https://api.openalex.org";

export class UpstreamError extends Error {
  constructor(
    public code: string,
    public status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "UpstreamError";
  }
}

export function openalexKey(): string | undefined {
  return Deno.env.get("OPENALEX_API_KEY") || undefined;
}

function mailto(): string {
  return Deno.env.get("OPENALEX_MAILTO") || "neilmorse@foxmail.com";
}

export async function openalexFetch(
  path: string,
  params: Record<string, string>,
): Promise<unknown> {
  const u = new URL(OPENALEX_HOST + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== "") u.searchParams.set(k, v);
  }
  u.searchParams.set("mailto", mailto());
  const key = openalexKey();
  if (key) u.searchParams.set("api_key", key);

  let res: Response;
  try {
    res = await fetch(u, { signal: AbortSignal.timeout(15000) });
  } catch {
    throw new UpstreamError("upstream_timeout", 504);
  }
  if (res.status === 429) throw new UpstreamError("quota_exhausted", 429);
  if (res.status === 401 || res.status === 403) throw new UpstreamError("upstream_auth_error", 502);
  if (!res.ok) throw new UpstreamError("upstream_error", 502);
  return res.json();
}