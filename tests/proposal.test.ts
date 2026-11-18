import { describe, expect, it } from "vitest";
import {
  AI_WARNING,
  assembleProposal,
  buildMatrix,
  buildTimeline,
  paperToLibraryItem,
} from "@/src/lib/proposal";
import type { Paper } from "@/src/lib/types";

const P = (id: string, over: Partial<Paper> = {}): Paper => ({
  id: `https://openalex.org/${id}`,
  doi: null,
  title: id,
  display_name: id,
  publication_year: 2024,
  cited_by_count: 10,
  type: "article",
  authors: ["A B"],
  venue: "V",
  sourceId: "S1",
  sourceType: "journal",
  biblio: null,
  oaUrl: null,
  url: null,
  referenced_works: [],
  refsTotal: 0,
  refsTruncated: false,
  countries: [],
  firstAuthorCountry: null,
  ...over,
});

describe("buildMatrix", () => {
  it("groups by first author country; unknown separate; shares sum 100", () => {
    const papers = [
      P("W1", { firstAuthorCountry: "CN", countries: ["CN"] }),
      P("W2", { firstAuthorCountry: "CN", countries: ["CN", "US"] }),
      P("W3", { firstAuthorCountry: "US", countries: ["US"] }),
      P("W4", { firstAuthorCountry: null, countries: ["CN"] }),
    ];
    const m = buildMatrix(papers);
    expect(m.rows.map((r) => [r.label, r.count])).toEqual([["国内", 2], ["国外", 1], ["未知", 1]]);
    expect(m.rows.reduce((a, r) => a + r.share, 0)).toBe(100);
    expect(m.cnCollabCount).toBe(3);
    expect(m.cnCollabShare).toBe(75);
    expect(m.total).toBe(4);
  });
  it("three equal groups → 33/33/34 (largest remainder)", () => {
    const m = buildMatrix([P("W1", { firstAuthorCountry: "CN" }), P("W2", { firstAuthorCountry: "US" }), P("W3")]);
    expect(m.rows.map((r) => r.share).sort((a, b) => a - b)).toEqual([33, 33, 34]);
  });
  it("empty papers → zero counts and shares", () => {
    const m = buildMatrix([]);
    expect(m.rows.every((r) => r.count === 0 && r.share === 0)).toBe(true);
    expect(m.cnCollabShare).toBe(0);
  });
  it("topVenues by frequency, topPapers by cited, yearSpan min-max", () => {
    const m = buildMatrix([
      P("W1", { firstAuthorCountry: "CN", venue: "TKDE", cited_by_count: 5, publication_year: 2020 }),
      P("W2", { firstAuthorCountry: "CN", venue: "TKDE", cited_by_count: 9, publication_year: 2024 }),
      P("W3", { firstAuthorCountry: "CN", venue: "TPAMI", cited_by_count: 1, publication_year: 2022 }),
    ]);
    const cn = m.rows[0];
    expect(cn.topVenues).toEqual(["TKDE", "TPAMI"]);
    expect(cn.topPapers.map((p) => p.id)).toEqual(["https://openalex.org/W2", "https://openalex.org/W1", "https://openalex.org/W3"]);
    expect(cn.yearSpan).toEqual([2020, 2024]);
  });
});

describe("buildTimeline", () => {
  it("years desc, per-year cap by cited, null years excluded", () => {
    const t = buildTimeline([
      P("W1", { publication_year: 2024, cited_by_count: 1 }),
      P("W2", { publication_year: 2024, cited_by_count: 9 }),
      P("W3", { publication_year: 2024, cited_by_count: 5 }),
      P("W4", { publication_year: 2024, cited_by_count: 7 }),
      P("W5", { publication_year: 2020 }),
      P("W6", { publication_year: null }),
    ]);
    expect(t.map((e) => e.year)).toEqual([2024, 2020]);
    expect(t[0].papers.map((p) => p.id.slice(-2))).toEqual(["W2", "W4", "W3"]);
  });
});

describe("assembleProposal", () => {
  const papers = [P("W1", { firstAuthorCountry: "CN", title: "Graph | Attention" }), P("W2", { firstAuthorCountry: "US" })];
  it("five sections, matrix table, numbered refs, bibtex appendix", () => {
    const md = assembleProposal("graph neural network", papers, {}, new Date(2026, 10, 18));
    for (const h of ["# 开题报告：graph neural network", "## 一、研究背景", "## 二、国内外研究现状对比矩阵", "## 三、技术路线梳理", "## 四、Research Gap（开放问题）", "## 五、参考文献", "### 附：BibTeX"]) {
      expect(md).toContain(h);
    }
    expect(md).toContain("| 国内 | 1 | 50% |");
    expect(md).toContain("[1] A B. Graph \\| Attention. V, 2024.");
    expect(md).toContain("```bibtex");
    expect(md).toContain("生成日期 2026-11-18");
  });
  it("placeholders without AI slots; warning + content with slots", () => {
    const plain = assembleProposal("q", papers);
    expect(plain).toContain("（待补充：可由 AI 生成或手动填写。）");
    expect(plain).not.toContain(AI_WARNING);
    const ai = assembleProposal("q", papers, { background: "背景正文", gap: "缺口正文" });
    expect(ai).toContain(AI_WARNING);
    expect(ai).toContain("背景正文");
    expect(ai).toContain("缺口正文");
  });
  it("empty window still renders structure", () => {
    const md = assembleProposal("q", []);
    expect(md).toContain("| 国内 | 0 | 0% |");
    expect(md).toContain("（窗口内无带年份文献。）");
  });
});

describe("paperToLibraryItem", () => {
  it("maps snapshot fields for bibtex reuse", () => {
    const it = paperToLibraryItem(P("W1", { countries: ["CN"], firstAuthorCountry: "CN" }));
    expect(it.workId).toBe("https://openalex.org/W1");
    expect(it.snapshot.type).toBe("journal");
    expect(it.snapshot.countries).toEqual(["CN"]);
    expect(it.status).toBe("unread");
  });
});