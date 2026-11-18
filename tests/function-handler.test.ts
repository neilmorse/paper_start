import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LruTtlCache } from "@/functions/cache.ts";

let handler: (req: Request) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
const env: Record<string, string> = { OPENALEX_API_KEY: "test-key" };

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  ({ handler } = await import("@/functions/handler.ts"));
});
afterEach(() => vi.unstubAllGlobals());

function req(path: string, method = "GET", ip = "test-ip"): Request {
  return new Request("http://local/functions/v1/app" + path, {
    method,
    headers: { "x-forwarded-for": ip },
  });
}
const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const worksBody = (results: unknown[], meta: unknown = { count: results.length }) => ({ meta, results });

const sampleWork = {
  id: "https://openalex.org/W1",
  doi: "https://doi.org/10.x",
  title: "T",
  display_name: "T",
  publication_year: 2024,
  cited_by_count: 5,
  type: "article",
  authorships: Array.from({ length: 10 }, (_, i) => ({
    author: { display_name: `A${i}` },
    institutions:
      i === 0 ? [{ country_code: "CN" }]
      : i === 1 ? [{ country_code: "US" }]
      : i === 2 ? [{ country_code: "CN" }]
      : i === 3 ? [{}]
      : [],
  })),
  primary_location: { source: { id: "https://openalex.org/S199944782", display_name: "TPAMI", type: "journal" } },
  biblio: { volume: "1", issue: "2", first_page: "3", last_page: "4" },
  open_access: { oa_url: "https://oa.example" },
  ids: { openalex: "https://openalex.org/W1" },
  abstract_inverted_index: { hello: [0] },
  referenced_works: Array.from({ length: 60 }, (_, i) => `https://openalex.org/W${100 + i}`),
};

describe("routing (gateway name replacement)", () => {
  it("routes /health under app and renamed app-d<hash>", async () => {
    for (const base of ["/functions/v1/app", "/functions/v1/app-d" + "a".repeat(32), "/app"]) {
      const res = await handler(new Request("http://local" + base + "/health"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ ok: true, openalexKeyConfigured: true, llmConfigured: false });
    }
  });
  it("404 for unknown subpath and non-matching path", async () => {
    expect((await handler(req("/nope"))).status).toBe(404);
    expect((await handler(new Request("http://local/other/health"))).status).toBe(404);
  });
  it("405 for non-GET on GET endpoints", async () => {
    expect((await handler(req("/search?q=x", "POST"))).status).toBe(405);
    expect((await handler(req("/health", "POST"))).status).toBe(405);
  });
  it("405 for GET on AI endpoints (POST only)", async () => {
    expect((await handler(req("/ai/keywords"))).status).toBe(405);
  });
});

describe("search validation", () => {
  it("400 when neither q nor sources", async () => {
    expect((await handler(req("/search"))).status).toBe(400);
  });
  it("400 for >100 sources or malformed S id", async () => {
    const many = Array.from({ length: 101 }, (_, i) => `S${i}`).join(",");
    expect((await handler(req(`/search?sources=${many}`))).status).toBe(400);
    expect((await handler(req("/search?sources=S1,BAD"))).status).toBe(400);
  });
  it("400 for perPage out of range or bad year", async () => {
    expect((await handler(req("/search?q=x&perPage=51"))).status).toBe(400);
    expect((await handler(req("/search?q=x&yearFrom=20x0"))).status).toBe(400);
  });
  it("builds source OR filter and year filter", async () => {
    fetchMock.mockResolvedValue(okJson(worksBody([])));
    await handler(req("/search?q=graph&sources=S1,S2&yearFrom=2020&yearTo=2024"));
    const u = new URL(fetchMock.mock.calls[0][0]);
    expect(u.searchParams.get("filter")).toBe("primary_location.source.id:S1|S2,from_publication_date:2020-01-01,to_publication_date:2024-12-31");
    expect(u.searchParams.get("search")).toBe("graph");
  });
});

describe("projection / trimming", () => {
  it("trims authors to 8 names, drops abstract, keeps biblio + source.type", async () => {
    fetchMock.mockResolvedValue(okJson(worksBody([sampleWork])));
    const body = await (await handler(req("/search?q=graph"))).json();
    const w = body.results[0];
    expect(w.authors).toHaveLength(8);
    expect(w.authors[0]).toBe("A0");
    expect(w).not.toHaveProperty("abstract_inverted_index");
    expect(w.biblio.volume).toBe("1");
    expect(w.sourceType).toBe("journal");
    expect(w.sourceId).toBe("S199944782");
    expect(w.venue).toBe("TPAMI");
  });
  it("/work returns abstract_inverted_index", async () => {
    fetchMock.mockResolvedValue(okJson(sampleWork));
    const body = await (await handler(req("/work?id=W1"))).json();
    expect(body.work.abstract_inverted_index).toEqual({ hello: [0] });
  });
  it("/works validates W ids", async () => {
    expect((await handler(req("/works?ids=W1,BAD"))).status).toBe(400);
    expect((await handler(req("/works"))).status).toBe(400);
  });
  it("caps referenced_works at 50 in upstream order, flags refsTotal/refsTruncated", async () => {
    fetchMock.mockResolvedValue(okJson(worksBody([sampleWork])));
    const body = await (await handler(req("/search?q=graph"))).json();
    const w = body.results[0];
    expect(w.referenced_works).toHaveLength(50);
    expect(w.referenced_works[0]).toBe("https://openalex.org/W100");
    expect(w.referenced_works[49]).toBe("https://openalex.org/W149");
    expect(w.refsTotal).toBe(60);
    expect(w.refsTruncated).toBe(true);
  });
  it("refsTruncated false when refs ≤ 50", async () => {
    fetchMock.mockResolvedValue(okJson(worksBody([{ ...sampleWork, referenced_works: ["https://openalex.org/W2"] }])));
    const w = (await (await handler(req("/search?q=graph"))).json()).results[0];
    expect(w.referenced_works).toEqual(["https://openalex.org/W2"]);
    expect(w.refsTotal).toBe(1);
    expect(w.refsTruncated).toBe(false);
  });
  it("countries dedup+sort across all authors; firstAuthorCountry from first author only", async () => {
    fetchMock.mockResolvedValue(okJson(worksBody([sampleWork])));
    const w = (await (await handler(req("/search?q=graph"))).json()).results[0];
    expect(w.countries).toEqual(["CN", "US"]);
    expect(w.firstAuthorCountry).toBe("CN");
  });
  it("firstAuthorCountry null without cross-author fallback", async () => {
    const noFirstInst = {
      ...sampleWork,
      authorships: [
        { author: { display_name: "A0" }, institutions: [] },
        { author: { display_name: "A1" }, institutions: [{ country_code: "US" }] },
      ],
    };
    fetchMock.mockResolvedValue(okJson(worksBody([noFirstInst])));
    const w = (await (await handler(req("/search?q=graph"))).json()).results[0];
    expect(w.firstAuthorCountry).toBeNull();
    expect(w.countries).toEqual(["US"]);
  });
  it("/work projection also carries refs/countries", async () => {
    fetchMock.mockResolvedValue(okJson(sampleWork));
    const body = await (await handler(req("/work?id=W1"))).json();
    expect(body.work.refsTotal).toBe(60);
    expect(body.work.countries).toEqual(["CN", "US"]);
  });
});

describe("search sort/type whitelist", () => {
  it("passes whitelisted sort upstream and includes referenced_works in select", async () => {
    fetchMock.mockResolvedValue(okJson(worksBody([])));
    await handler(req("/search?q=graph&sort=cited_by_count:desc"));
    const u = new URL(fetchMock.mock.calls[0][0]);
    expect(u.searchParams.get("sort")).toBe("cited_by_count:desc");
    expect(u.searchParams.get("select")).toContain("referenced_works");
  });
  it("accepts publication_year:desc", async () => {
    fetchMock.mockResolvedValue(okJson(worksBody([])));
    const res = await handler(req("/search?q=graph&sort=publication_year:desc"));
    expect(res.status).toBe(200);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("sort")).toBe("publication_year:desc");
  });
  it("400 for non-whitelisted sort", async () => {
    expect((await handler(req("/search?q=x&sort=bad"))).status).toBe(400);
    expect((await handler(req("/search?q=x&sort=cited_by_count:asc"))).status).toBe(400);
  });
  it("type=review adds filter, type=bad → 400", async () => {
    fetchMock.mockResolvedValue(okJson(worksBody([])));
    await handler(req("/search?q=graph&type=review&yearFrom=2020"));
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("filter")).toBe("from_publication_date:2020-01-01,type:review");
    expect((await handler(req("/search?q=x&type=bad"))).status).toBe(400);
  });
  it("sort participates in cache key", async () => {
    fetchMock.mockResolvedValue(okJson(worksBody([])));
    await handler(req("/search?q=graph"));
    await handler(req("/search?q=graph&sort=cited_by_count:desc"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("error mapping", () => {
  it("429 → quota_exhausted", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const res = await handler(req("/search?q=x"));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("quota_exhausted");
  });
  it("401/403 → upstream_auth_error", async () => {
    for (const status of [401, 403]) {
      fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({}) });
      const res = await handler(req("/search?q=x"));
      expect((await res.json()).error).toBe("upstream_auth_error");
    }
  });
  it("fetch rejection → upstream_timeout", async () => {
    fetchMock.mockRejectedValue(new Error("aborted"));
    const res = await handler(req("/search?q=x"));
    expect(res.status).toBe(504);
    expect((await res.json()).error).toBe("upstream_timeout");
  });
});

describe("cache", () => {
  it("second identical search does not refetch", async () => {
    fetchMock.mockResolvedValue(okJson(worksBody([sampleWork])));
    await handler(req("/search?q=graph"));
    await handler(req("/search?q=graph"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("per-IP token bucket 120/min", () => {
  it("allows 120 then rate-limits the 121st", async () => {
    const ip = "bucket-ip";
    for (let i = 0; i < 120; i++) {
      expect((await handler(req("/health", "GET", ip))).status).toBe(200);
    }
    const res = await handler(req("/health", "GET", ip));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
  });
});

describe("AI stub", () => {
  it("POST without LLM secrets → service_not_configured", async () => {
    const res = await handler(req("/ai/keywords", "POST"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("service_not_configured");
  });
});

describe("LruTtlCache", () => {
  it("expires entries after TTL", () => {
    let t = 0;
    const c = new LruTtlCache(500, () => t);
    c.set("k", "v", 100);
    expect(c.get("k")).toBe("v");
    t = 101;
    expect(c.get("k")).toBeUndefined();
  });
  it("evicts least-recently-used beyond max", () => {
    const c = new LruTtlCache(2, () => 0);
    c.set("a", 1, 1000);
    c.set("b", 2, 1000);
    c.get("a"); // refresh a
    c.set("c", 3, 1000); // evicts b
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
    expect(c.size).toBe(2);
  });
  it("caps at 500 entries", () => {
    const c = new LruTtlCache(500, () => 0);
    for (let i = 0; i < 501; i++) c.set(`k${i}`, i, 10000);
    expect(c.size).toBe(500);
    expect(c.get("k0")).toBeUndefined();
    expect(c.get("k500")).toBe(500);
  });
});