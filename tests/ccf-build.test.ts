import { describe, expect, it } from "vitest";
import {
  buildVenueRecord,
  computeCoverage,
  coverageWarningReasons,
  renderCoverageMarkdown,
} from "@/scripts/lib/build.mjs";

function v(over = {}) {
  return {
    key: "journal:tpami",
    abbr: "TPAMI",
    name: "IEEE TPAMI",
    type: "journal",
    rank: "A",
    domain: "人工智能",
    ccfddlSub: null,
    sourceIds: ["S1"],
    issnL: "0162-8828",
    issn: ["0162-8828", "1939-3539"],
    aliases: ["TPAMI"],
    dblpKey: "pami",
    confidence: "high",
    worksCount: 12000,
    method: "listed_in",
    ...over,
  };
}

describe("buildVenueRecord", () => {
  it("maps schema fields and dedups issns", () => {
    const r = buildVenueRecord(v());
    expect(r).toMatchObject({ key: "journal:tpami", abbr: "TPAMI", type: "journal", rank: "A", sourceIds: ["S1"], dblpKey: "pami", confidence: "high", worksCount: 12000 });
    expect(r.issns).toEqual(["0162-8828", "1939-3539"]);
  });
  it("filters empty sourceIds (no dirty data)", () => {
    expect(buildVenueRecord(v({ sourceIds: ["S1", "", "S2", null] })).sourceIds).toEqual(["S1", "S2"]);
  });
  it("preserves unresolved venues with empty sourceIds", () => {
    const r = buildVenueRecord(v({ sourceIds: [], confidence: "low", method: "unresolved", worksCount: null }));
    expect(r.sourceIds).toEqual([]);
    expect(r.confidence).toBe("low");
  });
});

describe("coverageWarningReasons", () => {
  it("flags unresolved", () => {
    expect(coverageWarningReasons(v({ sourceIds: [] }))[0]).toMatch(/unresolved/);
  });
  it("flags low works count", () => {
    expect(coverageWarningReasons(v({ worksCount: 500 }))[0]).toMatch(/收录偏少/);
  });
  it("carries override note (e.g. NeurIPS)", () => {
    expect(coverageWarningReasons(v({ note: "覆盖偏低" }))).toContain("覆盖偏低");
  });
  it("healthy venue has no warnings", () => {
    expect(coverageWarningReasons(v())).toEqual([]);
  });
});

describe("computeCoverage", () => {
  const venues = [
    v(),
    v({ key: "conference:aaai", abbr: "AAAI", type: "conference", rank: "A", domain: "人工智能", sourceIds: ["S2"], worksCount: 25000 }),
    v({ key: "journal:x", abbr: "X", type: "journal", rank: "B", domain: "计算机网络", sourceIds: [], confidence: "low", worksCount: null }),
  ];
  const cov = computeCoverage(venues, [{ abbr: "TPAMI", csvRank: "A", listedInRank: "B" }]);

  it("computes overall resolution rate", () => {
    expect(cov.overall.total).toBe(3);
    expect(cov.overall.resolved).toBe(2);
    expect(cov.overall.resolutionRate).toBe(0.667);
  });
  it("groups by rank×type", () => {
    const aj = cov.byRankType.find((g) => g.key === "A-journal");
    expect(aj).toMatchObject({ total: 1, resolved: 1, rate: 1 });
    const bj = cov.byRankType.find((g) => g.key === "B-journal");
    expect(bj).toMatchObject({ total: 1, resolved: 0, rate: 0 });
  });
  it("groups by domain and rank×type×domain", () => {
    expect(cov.byDomain.find((g) => g.key === "人工智能").total).toBe(2);
    expect(cov.byRankTypeDomain.find((c) => c.rank === "B" && c.domain === "计算机网络").resolved).toBe(0);
  });
  it("lists unresolved and warnings and listedInDiff", () => {
    expect(cov.unresolved).toHaveLength(1);
    expect(cov.unresolved[0].abbr).toBe("X");
    expect(cov.coverageWarnings.some((w) => w.abbr === "X")).toBe(true);
    expect(cov.listedInDiff).toHaveLength(1);
  });
});

describe("renderCoverageMarkdown", () => {
  it("renders rates, warnings and honesty note", () => {
    const cov = computeCoverage([v(), v({ key: "j:y", abbr: "Y", sourceIds: [], worksCount: null })]);
    const md = renderCoverageMarkdown(cov);
    expect(md).toContain("覆盖率报告");
    expect(md).toContain("A-journal");
    expect(md).toContain("数据诚实度声明");
  });
});