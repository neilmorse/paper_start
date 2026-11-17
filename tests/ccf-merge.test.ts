import { describe, expect, it } from "vitest";
import {
  detectAmbiguity,
  formatReviewMarkdown,
  mergeAliases,
  mergeSourceIds,
  needsReview,
} from "@/scripts/lib/merge.mjs";

describe("mergeAliases", () => {
  it("dedups by normalized key and preserves order", () => {
    expect(mergeAliases(["TPAMI", "tpami", " IEEE TPAMI "], ["TPAMI", "PAMI"])).toEqual([
      "TPAMI",
      "IEEE TPAMI",
      "PAMI",
    ]);
  });
  it("skips empty and whitespace-only entries", () => {
    expect(mergeAliases(["", "  ", null, "A"])).toEqual(["A"]);
  });
  it("is idempotent", () => {
    const once = mergeAliases(["A", "B"], ["B", "C"]);
    expect(mergeAliases(once)).toEqual(once);
  });
  it("handles undefined lists", () => {
    expect(mergeAliases(undefined, ["A"])).toEqual(["A"]);
  });
});

describe("mergeSourceIds", () => {
  it("dedups across lists preserving order", () => {
    expect(mergeSourceIds(["S1", "S2"], ["S2", "S3"])).toEqual(["S1", "S2", "S3"]);
  });
  it("issn merge adds split journal sources without duplicates", () => {
    expect(mergeSourceIds(["S1"], ["S1", "S9"])).toEqual(["S1", "S9"]);
  });
});

describe("detectAmbiguity", () => {
  it("flags two close non-low candidates", () => {
    expect(detectAmbiguity([{ score: 0.8, confidence: "high" }, { score: 0.75, confidence: "high" }])).toBe(true);
  });
  it("does not flag clearly separated candidates", () => {
    expect(detectAmbiguity([{ score: 0.9, confidence: "high" }, { score: 0.3, confidence: "low" }])).toBe(false);
  });
  it("does not flag when second is low", () => {
    expect(detectAmbiguity([{ score: 0.8, confidence: "high" }, { score: 0.78, confidence: "low" }])).toBe(false);
  });
  it("does not flag a single candidate", () => {
    expect(detectAmbiguity([{ score: 0.9, confidence: "high" }])).toBe(false);
    expect(detectAmbiguity([])).toBe(false);
  });
});

describe("needsReview", () => {
  it("override takes priority and skips review", () => {
    expect(needsReview({ method: "override", sourceIds: ["S1"], confidence: "high", candidates: [] })).toBe(false);
  });
  it("flags unresolved venues", () => {
    expect(needsReview({ method: "unresolved", sourceIds: [], confidence: "low", candidates: [] })).toBe(true);
  });
  it("flags medium confidence", () => {
    expect(needsReview({ method: "search", sourceIds: ["S1"], confidence: "medium", candidates: [] })).toBe(true);
  });
  it("flags ambiguous high-confidence matches (no silent merge)", () => {
    expect(
      needsReview({
        method: "search",
        sourceIds: ["S1"],
        confidence: "high",
        candidates: [{ score: 0.82, confidence: "high" }, { score: 0.78, confidence: "high" }],
      }),
    ).toBe(true);
  });
  it("passes clear high-confidence matches", () => {
    expect(
      needsReview({
        method: "listed_in",
        sourceIds: ["S1"],
        confidence: "high",
        candidates: [{ score: 0.95, confidence: "high" }, { score: 0.2, confidence: "low" }],
      }),
    ).toBe(false);
  });
});

describe("formatReviewMarkdown", () => {
  it("renders venues with candidate links and sorts A first", () => {
    const md = formatReviewMarkdown([
      { rank: "C", abbr: "CCC", name: "C Venue", type: "conference", domain: "AI", method: "unresolved", confidence: "low", candidates: [] },
      { rank: "A", abbr: "AAA", name: "A Venue", type: "journal", domain: "AI", method: "search", confidence: "medium", candidates: [{ id: "S1", displayName: "A Venue", score: 0.6, confidence: "medium", worksCount: 10 }] },
    ]);
    expect(md.indexOf("[A] AAA")).toBeLessThan(md.indexOf("[C] CCC"));
    expect(md).toContain("https://openalex.org/S1");
    expect(md).toContain("共 2 条");
  });
});