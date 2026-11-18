import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (rel: string) => JSON.parse(readFileSync(join(root, rel), "utf8"));
const catalog = read("public/data/ccf-venues.json");
const demo = read("public/data/demo/graph-neural-network.json");
const demoRefs = read("public/data/demo/graph-neural-network-refs.json");

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const err = (status: number, error: string) => ({ ok: false, status, json: async () => ({ error }) });

let fetchMock: ReturnType<typeof vi.fn>;
let router: (u: URL) => unknown;

beforeEach(() => {
  vi.resetModules();
  fetchMock = vi.fn(async (url: string) => router(new URL(String(url), "http://local")));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { location: { origin: "http://local" } });
});
afterEach(() => vi.unstubAllGlobals());

const callsTo = (frag: string) => fetchMock.mock.calls.filter((c) => String(c[0]).includes(frag)).length;

async function freshStore() {
  const { useSearchStore } = await import("@/src/store/search");
  return useSearchStore;
}

describe("search store: fallback wiring", () => {
  it("quota_exhausted → demo results + static refs expansion", async () => {
    router = (u) => {
      if (u.pathname === "/data/ccf-venues.json") return ok(catalog);
      if (u.pathname === "/data/demo/graph-neural-network.json") return ok(demo);
      if (u.pathname === "/data/demo/graph-neural-network-refs.json") return ok(demoRefs);
      if (u.pathname.includes("/search")) return err(429, "quota_exhausted");
      return err(404, "not_found");
    };
    const store = await freshStore();
    await store.getState().loadCatalog();
    store.getState().setQuery("graph neural network");
    await store.getState().search();
    const s = store.getState();
    expect(s.status).toBe("ready");
    expect(s.fallback).toBe(true);
    expect(s.results).toHaveLength(demo.results.length);
    expect(s.expanded).toHaveLength(demoRefs.results.length);
    expect(s.view).toBe("roadmap");
    expect(callsTo("/works")).toBe(0);
  });
});

describe("search store: real path + expansion + memoize", () => {
  const core = demo.results.slice(0, 5);
  function realRouter(searchRes: unknown, worksRes: unknown) {
    return (u: URL) => {
      if (u.pathname === "/data/ccf-venues.json") return ok(catalog);
      if (u.pathname.includes("/search")) return searchRes;
      if (u.pathname.includes("/works")) return worksRes;
      return err(404, "not_found");
    };
  }

  it("search success → 1-hop expansion via /works, roadmap default", async () => {
    router = realRouter(ok({ ok: true, results: core }), ok({ ok: true, results: demoRefs.results }));
    const store = await freshStore();
    await store.getState().loadCatalog();
    store.getState().setQuery("graph neural network");
    await store.getState().search();
    const s = store.getState();
    expect(s.status).toBe("ready");
    expect(s.fallback).toBe(false);
    expect(s.results).toHaveLength(5);
    expect(s.expanded.length).toBeGreaterThan(0);
    expect(s.expanded.length).toBeLessThanOrEqual(200);
    expect(callsTo("/works")).toBeLessThanOrEqual(2);
  });

  it("identical (query,filters) re-search is memoized (no refetch)", async () => {
    router = realRouter(ok({ ok: true, results: core }), ok({ ok: true, results: [] }));
    const store = await freshStore();
    await store.getState().loadCatalog();
    store.getState().setQuery("graph neural network");
    await store.getState().search();
    const before = callsTo("/search");
    await store.getState().search();
    expect(callsTo("/search")).toBe(before);
  });

  it("expansion failure degrades gracefully without failing results", async () => {
    router = realRouter(ok({ ok: true, results: core }), err(502, "upstream_error"));
    const store = await freshStore();
    await store.getState().loadCatalog();
    store.getState().setQuery("graph neural network");
    await store.getState().search();
    const s = store.getState();
    expect(s.status).toBe("ready");
    expect(s.results).toHaveLength(5);
    expect(s.expanded).toEqual([]);
    expect(s.expandError).toBeTruthy();
  });
});

describe("search store: SOTA supplement", () => {
  const recent = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...demo.results[0],
      id: `https://openalex.org/W90000${i}`,
      publication_year: new Date().getFullYear(),
      cited_by_count: 50 + i,
      type: "article",
      title: `Recent GNN Advance ${i}`,
    }));
  const oldCore = demo.results.slice(0, 5).map((p) => ({ ...p, publication_year: 2018 }));
  const suppCall = () =>
    fetchMock.mock.calls
      .map((c) => new URL(String(c[0]), "http://local"))
      .find((u) => u.pathname.includes("/search") && u.searchParams.get("sort") === "cited_by_count:desc");

  it("thin SOTA + single source batch → one recent cited-desc supplement", async () => {
    router = (u) => {
      if (u.pathname === "/data/ccf-venues.json") return ok(catalog);
      if (u.pathname.includes("/search"))
        return u.searchParams.get("sort") === "cited_by_count:desc"
          ? ok({ ok: true, results: recent(4) })
          : ok({ ok: true, results: oldCore });
      if (u.pathname.includes("/works")) return ok({ ok: true, results: [] });
      return err(404, "not_found");
    };
    const store = await freshStore();
    await store.getState().loadCatalog();
    store.getState().setQuery("graph neural network");
    await store.getState().search();
    const s = store.getState();
    expect(s.sotaSupplemented).toBe(true);
    expect(s.sotaExtra).toHaveLength(4);
    const u = suppCall();
    expect(u).toBeTruthy();
    expect(u!.searchParams.get("yearFrom")).toBe(String(new Date().getFullYear() - 2));
  });

  it("rich SOTA window → no supplement request", async () => {
    router = (u) => {
      if (u.pathname === "/data/ccf-venues.json") return ok(catalog);
      if (u.pathname.includes("/search")) return ok({ ok: true, results: recent(4) });
      if (u.pathname.includes("/works")) return ok({ ok: true, results: [] });
      return err(404, "not_found");
    };
    const store = await freshStore();
    await store.getState().loadCatalog();
    store.getState().setQuery("graph neural network");
    await store.getState().search();
    expect(store.getState().sotaSupplemented).toBe(false);
    expect(suppCall()).toBeUndefined();
  });

  it("multi-chunk source filter → no supplement (avoid partial-sample bias)", async () => {
    router = (u) => {
      if (u.pathname === "/data/ccf-venues.json") return ok(catalog);
      if (u.pathname.includes("/search")) return ok({ ok: true, results: oldCore });
      if (u.pathname.includes("/works")) return ok({ ok: true, results: [] });
      return err(404, "not_found");
    };
    const store = await freshStore();
    await store.getState().loadCatalog();
    store.getState().setQuery("graph neural network");
    store.getState().setFilters({ ranks: ["A", "B", "C"], domains: [], types: [] });
    await store.getState().search();
    expect(store.getState().sotaSupplemented).toBe(false);
    expect(suppCall()).toBeUndefined();
  });

  it("fallback mode never supplements", async () => {
    router = (u) => {
      if (u.pathname === "/data/ccf-venues.json") return ok(catalog);
      if (u.pathname === "/data/demo/graph-neural-network.json") return ok(demo);
      if (u.pathname === "/data/demo/graph-neural-network-refs.json") return ok(demoRefs);
      if (u.pathname.includes("/search")) return err(429, "quota_exhausted");
      return err(404, "not_found");
    };
    const store = await freshStore();
    await store.getState().loadCatalog();
    store.getState().setQuery("graph neural network");
    await store.getState().search();
    expect(store.getState().fallback).toBe(true);
    expect(store.getState().sotaSupplemented).toBe(false);
    expect(suppCall()).toBeUndefined();
  });
});