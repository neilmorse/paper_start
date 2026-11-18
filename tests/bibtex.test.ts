import { describe, expect, it } from "vitest";
import { baseKey, entryType, escapeBibtex, toBibtex } from "@/src/lib/bibtex";
import type { LibraryItem, LibrarySnapshot } from "@/src/lib/types";

const snap = (over: Partial<LibrarySnapshot> = {}): LibrarySnapshot => ({
  title: "T",
  authors: [],
  year: null,
  venue: null,
  sourceId: "S1",
  type: null,
  biblio: null,
  doi: null,
  url: null,
  citedByCount: 0,
  ...over,
});
const item = (over: Partial<LibrarySnapshot> = {}, workId = "W1"): LibraryItem => ({
  workId,
  savedAt: "2026-01-01T00:00:00.000Z",
  snapshot: snap(over),
  tags: [],
  status: "unread",
  note: "",
});

describe("escapeBibtex", () => {
  it("escapes all special characters", () => {
    expect(escapeBibtex("A & B % C $ D # E _ F { G } ~ H ^ I \\ J")).toBe(
      "A \\& B \\% C \\$ D \\# E \\_ F \\{ G \\} \\~{} H \\^{} I \\textbackslash{} J",
    );
  });
  it("leaves plain text and unicode untouched", () => {
    expect(escapeBibtex("Graph 神经网络 2020")).toBe("Graph 神经网络 2020");
  });
});

describe("entryType / baseKey", () => {
  it("journal→article, conference→inproceedings, unknown→misc", () => {
    expect(entryType(snap({ type: "journal" }))).toBe("article");
    expect(entryType(snap({ type: "conference" }))).toBe("inproceedings");
    expect(entryType(snap({ type: "review" }))).toBe("misc");
    expect(entryType(snap())).toBe("misc");
  });
  it("key = surname + year + first content word (stopwords skipped)", () => {
    expect(baseKey(item({ authors: ["Petar Veličković"], year: 2018, title: "Graph Attention Networks" }))).toBe(
      "velikovi2018graph",
    );
    expect(baseKey(item({ authors: ["Zonghan Wu"], year: 2020, title: "A Survey on Graph Neural Networks" }))).toBe(
      "wu2020survey",
    );
    expect(baseKey(item({ title: "The Report" }))).toBe("anonndreport");
  });
});

describe("toBibtex golden fixtures", () => {
  it("journal entry with biblio/doi/url/note", () => {
    const it = item({
      title: "Graph Attention Networks",
      authors: ["Petar Veličković", "Guillem Cucurull"],
      year: 2018,
      venue: "ICLR",
      rank: "A",
      domain: "人工智能",
      type: "journal",
      biblio: { volume: "1", issue: "2", first_page: "3", last_page: "4" },
      doi: "https://doi.org/10.x/y",
      url: "https://oa.example",
    });
    expect(toBibtex([it])).toBe(
      "@article{velikovi2018graph,\n" +
        "  title = {Graph Attention Networks},\n" +
        "  author = {Petar Veličković and Guillem Cucurull},\n" +
        "  year = {2018},\n" +
        "  journal = {ICLR},\n" +
        "  volume = {1},\n" +
        "  number = {2},\n" +
        "  pages = {3--4},\n" +
        "  doi = {10.x/y},\n" +
        "  url = {https://oa.example},\n" +
        "  note = {CCF-A, 人工智能}\n" +
        "}\n",
    );
  });
  it("conference entry omits missing fields", () => {
    const it = item({ title: "A Survey on Graph Neural Networks", authors: ["Zonghan Wu"], year: 2020, venue: "TNNLS", rank: "B", type: "conference" });
    expect(toBibtex([it])).toBe(
      "@inproceedings{wu2020survey,\n" +
        "  title = {A Survey on Graph Neural Networks},\n" +
        "  author = {Zonghan Wu},\n" +
        "  year = {2020},\n" +
        "  booktitle = {TNNLS},\n" +
        "  note = {CCF-B}\n" +
        "}\n",
    );
  });
  it("misc minimal entry", () => {
    expect(toBibtex([item({ title: "Some Report" })])).toBe("@misc{anonndsome,\n  title = {Some Report}\n}\n");
  });
  it("key conflicts get a/b/c suffixes", () => {
    const a = item({ authors: ["A B"], year: 2020, title: "Same Title" }, "W1");
    const b = item({ authors: ["A B"], year: 2020, title: "Same Title" }, "W2");
    const c = item({ authors: ["A B"], year: 2020, title: "Same Title" }, "W3");
    const out = toBibtex([a, b, c]);
    expect(out).toContain("@misc{b2020same,");
    expect(out).toContain("@misc{b2020samea,");
    expect(out).toContain("@misc{b2020sameb,");
  });
  it("title braces and specials escaped inside wrapped braces", () => {
    const out = toBibtex([item({ title: "Cost & Benefit {Analysis}" })]);
    expect(out).toContain("title = {Cost \\& Benefit \\{Analysis\\}}");
  });
});