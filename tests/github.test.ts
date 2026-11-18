import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRepoQuery, scoreRepo } from "@/functions/github.ts";

let handler: (req: Request) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
const env: Record<string, string> = {};

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  ({ handler } = await import("@/functions/handler.ts"));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete env.GITHUB_TOKEN;
});

const req = (path: string, method = "GET") => new Request("http://local/functions/v1/app" + path, { method });
const okJson = (body: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => body });

describe("buildRepoQuery / scoreRepo", () => {
  it("drops stopwords/short words, caps at 5", () => {
    expect(buildRepoQuery("A Survey on Graph Neural Networks")).toBe("survey graph neural networks");
    expect(buildRepoQuery("Attention Is All You Need")).toBe("attention all you need");
    expect(buildRepoQuery("!!!")).toBe("");
  });
  it("score: title hits ×3 + log stars + recency − fork/archived", () => {
    const now = Date.parse("2026-11-18T00:00:00Z");
    const base = { name: "graph-neural-networks", description: "GNN libs", stargazers_count: 99, pushed_at: "2026-10-01T00:00:00Z" };
    const words = ["graph", "neural", "networks"];
    const s = scoreRepo(base, words, now);
    expect(s).toBeCloseTo(9 + 2 + 2, 5);
    expect(scoreRepo({ ...base, fork: true }, words, now)).toBeCloseTo(s - 2, 5);
    expect(scoreRepo({ ...base, archived: true }, words, now)).toBeCloseTo(s - 3, 5);
    expect(scoreRepo({ ...base, pushed_at: "2020-01-01T00:00:00Z" }, words, now)).toBeCloseTo(s - 2, 5);
  });
});

describe("/github routing and validation", () => {
  it("400 for missing/short/overlong title", async () => {
    expect((await handler(req("/github"))).status).toBe(400);
    expect((await handler(req("/github?title=abc"))).status).toBe(400);
    expect((await handler(req("/github?title=" + "x".repeat(201)))).status).toBe(400);
  });
  it("405 for POST", async () => {
    expect((await handler(req("/github?title=graph+neural+networks", "POST"))).status).toBe(405);
  });
});

describe("/github proxy", () => {
  const items = [
    { full_name: "a/gnn", html_url: "https://github.com/a/gnn", description: "graph neural networks", stargazers_count: 100, language: "Python", license: { spdx_id: "MIT" }, pushed_at: "2026-10-01T00:00:00Z", fork: false, archived: false },
    { full_name: "b/other", html_url: "https://github.com/b/other", description: "unrelated", stargazers_count: 5000, language: "Go", license: null, pushed_at: "2020-01-01T00:00:00Z", fork: true, archived: false },
  ];
  it("projects and sorts repos by score; upstream query params fixed", async () => {
    fetchMock.mockResolvedValue(okJson({ items }));
    const res = await handler(req("/github?title=Graph+Neural+Networks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.repos[0].fullName).toBe("a/gnn");
    expect(body.repos[0].license).toBe("MIT");
    expect(body.repos[1].fullName).toBe("b/other");
    const u = new URL(fetchMock.mock.calls[0][0]);
    expect(u.origin).toBe("https://api.github.com");
    expect(u.pathname).toBe("/search/repositories");
    expect(u.searchParams.get("sort")).toBe("stars");
    expect(u.searchParams.get("per_page")).toBe("5");
  });
  it("sends Bearer token only when configured", async () => {
    fetchMock.mockResolvedValue(okJson({ items: [] }));
    await handler(req("/github?title=graph+neural+networks"));
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    env.GITHUB_TOKEN = "tok";
    vi.resetModules();
    ({ handler } = await import("@/functions/handler.ts"));
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(okJson({ items: [] }));
    await handler(req("/github?title=diffusion+model+survey+xyz"));
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
  it("24h cache: identical title does not refetch", async () => {
    fetchMock.mockResolvedValue(okJson({ items }));
    await handler(req("/github?title=graph+neural+networks"));
    await handler(req("/github?title=graph+neural+networks"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("403 → github_rate_limited + cooldown short-circuits next call", async () => {
    const reset = Math.floor(Date.now() / 1000) + 3600;
    fetchMock.mockResolvedValue({ ok: false, status: 403, headers: new Headers({ "x-ratelimit-reset": String(reset) }), json: async () => ({}) });
    const res = await handler(req("/github?title=graph+neural+networks"));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("github_rate_limited");
    const res2 = await handler(req("/github?title=another+totally+different+title"));
    expect(res2.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("fetch rejection / 500 → github_unreachable 502", async () => {
    fetchMock.mockRejectedValue(new Error("net down"));
    expect((await handler(req("/github?title=graph+neural+networks"))).status).toBe(502);
    fetchMock.mockResolvedValue({ ok: false, status: 500, headers: new Headers(), json: async () => ({}) });
    const res = await handler(req("/github?title=diffusion+model+survey+xyz"));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("github_unreachable");
  });
});