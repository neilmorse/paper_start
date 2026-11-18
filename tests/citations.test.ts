import { describe, expect, it, vi } from "vitest";
import {
  CORE_CAP,
  FETCH_CAP,
  TOTAL_CAP,
  candidateFreqs,
  expandBudget,
  expandOnce,
  graphCore,
  rankExpanded,
  selectCandidates,
  workIdOf,
} from "@/src/lib/citations";
import type { Paper } from "@/src/lib/types";

function paper(id: string, cited = 0, refs: string[] = []): Paper {
  return {
    id: `https://openalex.org/${id}`,
    doi: null,
    title: id,
    display_name: id,
    publication_year: 2024,
    cited_by_count: cited,
    type: "article",
    authors: [],
    venue: null,
    sourceId: "",
    sourceType: null,
    biblio: null,
    oaUrl: null,
    url: null,
    referenced_works: refs.map((r) => `https://openalex.org/${r}`),
    refsTotal: refs.length,
    refsTruncated: false,
    countries: [],
    firstAuthorCountry: null,
  };
}
const wid = (p: Paper) => workIdOf(p.id);

describe("workIdOf", () => {
  it("extracts W id from URL or bare id, rejects garbage", () => {
    expect(workIdOf("https://openalex.org/W123")).toBe("W123");
    expect(workIdOf("W123")).toBe("W123");
    expect(workIdOf("https://openalex.org/S1")).toBe("");
    expect(workIdOf("")).toBe("");
  });
});

describe("candidateFreqs", () => {
  it("counts in-set citation frequency and excludes core ids", () => {
    const core = [paper("W1", 0, ["W2", "W99", "W100"]), paper("W2", 0, ["W99"])];
    const freq = candidateFreqs(core);
    expect(freq.get("W99")).toBe(2);
    expect(freq.get("W100")).toBe(1);
    expect(freq.has("W2")).toBe(false);
  });
  it("ignores malformed refs and tolerates missing referenced_works", () => {
    const p = paper("W1");
    (p as any).referenced_works = ["https://openalex.org/S9", "", null];
    expect(candidateFreqs([p]).size).toBe(0);
    const q = paper("W2");
    (q as any).referenced_works = undefined;
    expect(candidateFreqs([q]).size).toBe(0);
  });
});

describe("selectCandidates (pre-fetch deterministic)", () => {
  const core = [paper("W1", 0, ["W100", "W99"]), paper("W2", 0, ["W99", "W200"])];
  it("orders freq desc then id asc, truncates to budget", () => {
    expect(selectCandidates(core, 10)).toEqual(["W99", "W100", "W200"]);
    expect(selectCandidates(core, 2)).toEqual(["W99", "W100"]);
  });
  it("budget ≤ 0 or empty core → no candidates", () => {
    expect(selectCandidates(core, 0)).toEqual([]);
    expect(selectCandidates(core, -1)).toEqual([]);
    expect(selectCandidates([], 10)).toEqual([]);
  });
});

describe("expandBudget / graphCore", () => {
  it("budget = min(totalCap − coreCount, FETCH_CAP), floored at 0", () => {
    expect(expandBudget(100)).toBe(50);
    expect(expandBudget(0)).toBe(TOTAL_CAP);
    expect(expandBudget(150)).toBe(0);
    expect(expandBudget(350)).toBe(0);
    expect(expandBudget(350, 350 + FETCH_CAP)).toBe(FETCH_CAP);
  });
  it("graphCore truncates to CORE_CAP preserving order", () => {
    const core = Array.from({ length: 120 }, (_, i) => paper(`W${i}`));
    const g = graphCore(core);
    expect(g).toHaveLength(CORE_CAP);
    expect(wid(g[0])).toBe("W0");
    expect(wid(g[99])).toBe("W99");
  });
});

describe("rankExpanded (post-fetch deterministic)", () => {
  it("freq desc → cited desc → id asc; dedup; drops non-candidates", () => {
    const freq = new Map([["W99", 2], ["W100", 1], ["W200", 1]]);
    const fetched = [
      paper("W200", 50),
      paper("W100", 50),
      paper("W99", 10),
      paper("W300", 999),
      paper("W100", 50),
    ];
    expect(rankExpanded(fetched, freq).map(wid)).toEqual(["W99", "W100", "W200"]);
  });
});

describe("expandOnce", () => {
  it("empty core or zero budget → no fetch", async () => {
    const fb = vi.fn(async () => []);
    expect(await expandOnce([], fb)).toEqual([]);
    expect(await expandOnce([paper("W1", 0, ["W99"])], fb, 0)).toEqual([]);
    expect(fb).not.toHaveBeenCalled();
  });
  it("splits ≤200 candidates into ≤2 batches of ≤100 and ranks result", async () => {
    const refs = Array.from({ length: 200 }, (_, i) => `W${100 + i}`);
    const core = [paper("W1", 0, refs)];
    const fb = vi.fn(async (ids: string[]) => ids.map((id) => paper(id, Number(id.slice(1)) % 7)));
    const out = await expandOnce(core, fb, FETCH_CAP);
    expect(fb).toHaveBeenCalledTimes(2);
    for (const call of fb.mock.calls) expect(call[0].length).toBeLessThanOrEqual(100);
    expect(out).toHaveLength(200);
    const freq = candidateFreqs(core);
    expect(out.map(wid)).toEqual(rankExpanded(out, freq).map(wid));
  });
  it("default budget reserves graph expansion seats (core 100 → 50)", async () => {
    const core = Array.from({ length: 100 }, (_, i) => paper(`W${i}`, 0, [`W${1000 + i}`]));
    const fb = vi.fn(async (ids: string[]) => ids.map((id) => paper(id)));
    const out = await expandOnce(graphCore(core), fb);
    expect(out).toHaveLength(50);
    expect(fb).toHaveBeenCalledTimes(1);
  });
});