import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, isFallbackError, restoreAbstract, safeHref } from "@/src/lib/api";

describe("safeHref (untrusted upstream links)", () => {
  it("allows http and https", () => {
    expect(safeHref("https://doi.org/10.1/x")).toBe("https://doi.org/10.1/x");
    expect(safeHref("http://example.com")).toBe("http://example.com/");
  });
  it("rejects dangerous and malformed schemes", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("ftp://example.com")).toBeNull();
    expect(safeHref("not a url")).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(safeHref("")).toBeNull();
  });
});

describe("restoreAbstract", () => {
  it("reconstructs text by position", () => {
    expect(restoreAbstract({ hello: [0, 2], world: [1] })).toBe("hello world hello");
  });
  it("returns empty for null/undefined", () => {
    expect(restoreAbstract(null)).toBe("");
    expect(restoreAbstract(undefined)).toBe("");
  });
});

describe("isFallbackError (demo fallback triggers)", () => {
  it("triggers on quota_exhausted and upstream_auth_error", () => {
    expect(isFallbackError(new ApiError("quota_exhausted"))).toBe(true);
    expect(isFallbackError(new ApiError("upstream_auth_error"))).toBe(true);
  });
  it("triggers on network failure (TypeError)", () => {
    expect(isFallbackError(new TypeError("network_error"))).toBe(true);
  });
  it("does not trigger on timeout/internal/invalid", () => {
    expect(isFallbackError(new ApiError("upstream_timeout"))).toBe(false);
    expect(isFallbackError(new ApiError("internal_error"))).toBe(false);
    expect(isFallbackError(new ApiError("invalid_input"))).toBe(false);
    expect(isFallbackError(new Error("other"))).toBe(false);
  });
});

describe("apiGet", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { origin: "http://local" } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns parsed body on ok", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, results: [] }) });
    const body = await apiGet<{ ok: boolean }>("/search", { q: "x" });
    expect(body.ok).toBe(true);
    const u = new URL(fetchMock.mock.calls[0][0]);
    expect(u.pathname).toBe("/functions/v1/app/search");
    expect(u.searchParams.get("q")).toBe("x");
  });
  it("throws ApiError with upstream code on !ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: "quota_exhausted" }) });
    await expect(apiGet("/search", { q: "x" })).rejects.toMatchObject({ code: "quota_exhausted" });
  });
  it("normalizes network failure to TypeError", async () => {
    fetchMock.mockRejectedValue(new Error("failed"));
    await expect(apiGet("/search")).rejects.toBeInstanceOf(TypeError);
  });
  it("malformed non-JSON error body → upstream_error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("bad json"); } });
    await expect(apiGet("/search")).rejects.toMatchObject({ code: "upstream_error" });
  });
});