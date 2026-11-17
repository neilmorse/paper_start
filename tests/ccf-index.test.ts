import { describe, expect, it } from "vitest";
import { buildIndex, filterVenues, sourceIdsForVenues, venueForSource } from "@/src/lib/ccf";
import type { CcfCatalog, Venue } from "@/src/lib/types";

function venue(over: Partial<Venue> = {}): Venue {
  return {
    key: "journal:x", abbr: "X", name: "X Journal", type: "journal", rank: "A",
    domain: "人工智能", domainSub: "AI", sourceIds: ["S1"], issns: [], aliases: [],
    dblpKey: "", confidence: "high", worksCount: 100, ...over,
  };
}
const catalog: CcfCatalog = {
  version: "ccf-2026-03", generatedAt: "", domains: [],
  venues: [
    venue({ key: "journal:a", abbr: "A", rank: "A", domain: "人工智能", sourceIds: ["S1", "S2"] }),
    venue({ key: "conference:b", abbr: "B", type: "conference", rank: "B", domain: "计算机网络", sourceIds: ["S3"] }),
    venue({ key: "journal:c", abbr: "C", rank: "C", domain: "人工智能", sourceIds: [] }),
  ],
};

describe("buildIndex / venueForSource", () => {
  it("maps every sourceId back to its venue", () => {
    const idx = buildIndex(catalog);
    expect(venueForSource(idx, "S1")?.abbr).toBe("A");
    expect(venueForSource(idx, "S2")?.abbr).toBe("A");
    expect(venueForSource(idx, "S3")?.abbr).toBe("B");
    expect(venueForSource(idx, "S9")).toBeUndefined();
  });
  it("skips empty sourceIds (unresolved venues)", () => {
    const idx = buildIndex(catalog);
    expect(idx.bySourceId.size).toBe(3);
  });
});

describe("filterVenues", () => {
  const idx = buildIndex(catalog);
  it("default CCF-A preset selects only A", () => {
    expect(filterVenues(idx.venues, { ranks: ["A"], domains: [], types: [] }).map((v) => v.abbr)).toEqual(["A"]);
  });
  it("empty filters select all", () => {
    expect(filterVenues(idx.venues, { ranks: [], domains: [], types: [] })).toHaveLength(3);
  });
  it("combines rank + domain + type", () => {
    const r = filterVenues(idx.venues, { ranks: ["A", "B"], domains: ["计算机网络"], types: ["conference"] });
    expect(r.map((v) => v.abbr)).toEqual(["B"]);
  });
});

describe("sourceIdsForVenues", () => {
  it("flattens and dedups sourceIds", () => {
    const idx = buildIndex(catalog);
    expect(sourceIdsForVenues(idx.venues)).toEqual(["S1", "S2", "S3"]);
  });
});