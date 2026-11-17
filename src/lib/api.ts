export class ApiError extends Error {
  constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

// 兜底触发：额度耗尽 / 上游鉴权错误 / 断网。upstream_timeout 等不触发（计划 K 修订）。
export function isFallbackError(e: unknown): boolean {
  if (e instanceof ApiError) return e.code === "quota_exhausted" || e.code === "upstream_auth_error";
  return e instanceof TypeError; // fetch 网络失败
}

// 上游数据不可信：href 渲染前仅允许 http(s)，拒绝 javascript:/data: 等。
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// OpenAlex abstract_inverted_index → 正文（按位置还原）。
export function restoreAbstract(inverted: Record<string, number[]> | null | undefined): string {
  if (!inverted) return "";
  const positions: Array<[number, string]> = [];
  for (const [word, idxs] of Object.entries(inverted)) {
    for (const i of idxs) positions.push([i, word]);
  }
  positions.sort((a, b) => a[0] - b[0]);
  return positions.map(([, w]) => w).join(" ");
}

export async function apiGet<T>(subpath: string, params: Record<string, string> = {}): Promise<T> {
  const u = new URL("/functions/v1/app" + subpath, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v !== "") u.searchParams.set(k, v);
  }
  let res: Response;
  try {
    res = await fetch(u, { headers: { Accept: "application/json" } });
  } catch {
    throw new TypeError("network_error");
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) throw new ApiError(body?.error ?? "upstream_error", body?.message);
  return body as T;
}