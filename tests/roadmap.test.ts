import { describe, expect, it } from "vitest";
import {
  MILESTONE_CAP,
  SOTA_CAP,
  SURVEY_CAP,
  buildRoadmap,
} from "@/src/lib/roadmap";
import type { Paper, Rank } from "@/src/lib/types";

const NOW = 2026;
const rankOf = (sid: string): Rank | undefined =>
  sid === "SA" ? "A" : sid === "SB" ? "B" : sid === "SC" ? "C" : undefined;

const P = (id: string, year: number | null, cited: number, extra: Partial<Paper> = {}): Paper => ({
  id: `https://openalex.org/${id}`,
  doi: null,
  title: id,
  display_name: id,
  publication_year: year,
  cited_by_count: cited,
  type: "article",
  authors: [],
  venue: null,
  sourceId: "",
  sourceType: null,
  biblio: null,
  oaUrl: null,
  url: null,
  referenced_works: [],
  refsTotal: 0,
  refsTruncated: false,
  countries: [],
  firstAuthorCountry: null,
  ...extra,
});
const ids = (ps: Paper[]) => ps.map((p) => p.id.replace("https://openalex.org/", ""));
const build = (core: Paper[], expanded: Paper[] = []) => buildRoadmap(core, expanded, rankOf, NOW);

describe("buildRoadmap basics", () => {
  it("empty pool → all stages empty", () => {
    expect(build([])).toEqual({ milestone: [], survey: [], sota: [] });
  });
});

describe("milestone stage", () => {
  it("year ≤ NOW−5 and cited ≥ 100 boundaries; null year excluded", () => {
    const r = build([
      P("Wok", 2021, 100),
      P("Wyoung", 2022, 9999),
      P("Wlow", 2010, 99),
      P("Wnull", null, 9999),
    ]);
    expect(ids(r.milestone)).toEqual(["Wok"]);
  });
  it("sorts cited desc → year asc → id asc, caps at 5", () => {
    const core = [
      P("Wb", 2010, 500),
      P("Wa", 2010, 500),
      P("Wold", 2000, 500),
      P("Wtop", 2015, 900),
      P("Wc", 2012, 300),
      P("Wd", 2013, 200),
      P("We", 2014, 150),
    ];
    const r = build(core);
    expect(r.milestone).toHaveLength(MILESTONE_CAP);
    expect(ids(r.milestone)).toEqual(["Wtop", "Wold", "Wa", "Wb", "Wc"]);
  });
});

describe("survey stage", () => {
  it("matches type=review or title keyword with cited ≥ 20", () => {
    const r = build([
      P("Wtype", 2025, 50, { type: "review", title: "Deep Learning" }),
      P("Wtitle", 2025, 20, { title: "A Survey of Graph Methods" }),
      P("Wlow", 2025, 19, { title: "Survey of Everything" }),
      P("Wpreview", 2025, 500, { title: "Preview of Next Gen" }),
      P("Wplain", 2025, 500),
    ]);
    expect(ids(r.survey)).toEqual(["Wtype", "Wtitle"]);
  });
  it("sorts cited desc → id asc, caps at 4", () => {
    const core = Array.from({ length: 6 }, (_, i) => P(`W${i}`, 2025, 100 + i, { type: "review" }));
    const r = build(core);
    expect(r.survey).toHaveLength(SURVEY_CAP);
    expect(ids(r.survey)).toEqual(["W5", "W4", "W3", "W2"]);
  });
});

describe("sota stage", () => {
  it("year ≥ NOW−2 boundary; rank A<B<C<unknown then cited desc", () => {
    const r = build([
      P("W2024", 2024, 10, { sourceId: "SC" }),
      P("W2023", 2023, 9999, { sourceId: "SA" }),
      P("Wunknown", 2025, 9999),
      P("WB", 2025, 1, { sourceId: "SB" }),
      P("WA", 2025, 0, { sourceId: "SA" }),
      P("WC", 2025, 5, { sourceId: "SC" }),
    ]);
    expect(ids(r.sota)).toEqual(["WA", "WB", "W2024", "WC", "Wunknown"]);
  });
  it("caps at 8", () => {
    const core = Array.from({ length: 12 }, (_, i) => P(`W${i}`, 2025, i));
    expect(build(core).sota).toHaveLength(SOTA_CAP);
  });
});

describe("cross-stage dedup priority milestone > survey > sota", () => {
  it("old highly-cited review lands in milestone only", () => {
    const p = P("Wclassic", 2015, 500, { type: "review", title: "A Survey" });
    const r = build([p]);
    expect(ids(r.milestone)).toEqual(["Wclassic"]);
    expect(r.survey).toEqual([]);
    expect(r.sota).toEqual([]);
  });
  it("recent review lands in survey not sota", () => {
    const p = P("Wnew", 2025, 50, { type: "review" });
    const r = build([p]);
    expect(ids(r.survey)).toEqual(["Wnew"]);
    expect(r.sota).toEqual([]);
  });
  it("core wins over expanded on duplicate id", () => {
    const core = [P("Wdup", 2010, 100)];
    const expanded = [P("Wdup", 2010, 9999)];
    const r = build(core, expanded);
    expect(r.milestone).toHaveLength(1);
    expect(r.milestone[0].cited_by_count).toBe(100);
  });
});

describe("determinism", () => {
  it("shuffled input with equal keys yields identical output", () => {
    const a = [P("Wx", 2025, 10, { sourceId: "SA" }), P("Wy", 2025, 10, { sourceId: "SA" }), P("Wz", 2025, 10, { sourceId: "SA" })];
    const b = [a[2], a[0], a[1]];
    expect(ids(build(a).sota)).toEqual(ids(build(b).sota));
    expect(ids(build(a).sota)).toEqual(["Wx", "Wy", "Wz"]);
  });
});