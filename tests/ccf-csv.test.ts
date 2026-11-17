import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/scripts/lib/csv.mjs";
import { collapseWhitespace, coreSearchTerm, dblpKeyFromUrl, matchKey } from "@/scripts/lib/normalize.mjs";
import {
  EXPECTED_COUNTS,
  assertExpectedCounts,
  rowToVenue,
  tally,
} from "@/scripts/lib/venues.mjs";

describe("parseCsv", () => {
  it("parses basic rows and header", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips UTF-8 BOM", () => {
    expect(parseCsv("\uFEFFa,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('a,"b,c",d\n')).toEqual([["a", "b,c", "d"]]);
  });

  it("keeps newlines inside quoted fields", () => {
    expect(parseCsv('a,"b\nc",d\n')).toEqual([["a", "b\nc", "d"]]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('a,"say ""hi""",b\n')).toEqual([["a", 'say "hi"', "b"]]);
  });

  it("does not emit an empty row for trailing newline", () => {
    expect(parseCsv("a,b\n1,2\n")).toHaveLength(2);
    expect(parseCsv("a,b\n1,2")).toHaveLength(2);
  });

  it("preserves empty fields", () => {
    expect(parseCsv(",b,\n1,,3\n")).toEqual([
      ["", "b", ""],
      ["1", "", "3"],
    ]);
  });

  it("parses the edge fixture (quoted comma/newline/quotes)", () => {
    const text = readFileSync(
      fileURLToPath(new URL("./fixtures/csv-edge.csv", import.meta.url)),
      "utf8",
    );
    const rows = parseCsv(text);
    expect(rows).toHaveLength(4);
    expect(rows[1][1]).toBe("Journal of the ACM, The");
    expect(rows[2][1]).toBe('A venue with "quoted" name');
    expect(rows[3][1]).toBe("First line\nsecond line");
  });
});

describe("normalize", () => {
  it("collapseWhitespace trims and collapses", () => {
    expect(collapseWhitespace("  IEEE/   ACM  ")).toBe("IEEE/ ACM");
    expect(collapseWhitespace("Models and  Co-Design")).toBe("Models and Co-Design");
  });

  it("matchKey lowercases and strips punctuation", () => {
    expect(matchKey("Science China-Information Sciences")).toBe(
      "science china information sciences",
    );
    expect(matchKey("IEEE/ACM Trans.")).toBe("ieee acm trans");
  });

  it("matchKey is idempotent", () => {
    for (const s of ["TPAMI", "Science China-Information Sciences", "IEEE/  ACM", "ＡＢＣ", ""]) {
      expect(matchKey(matchKey(s))).toBe(matchKey(s));
    }
  });

  it("matchKey normalizes full-width characters (NFKC)", () => {
    expect(matchKey("ＡＢＣ１２３")).toBe("abc123");
  });

  it("matchKey handles empty input", () => {
    expect(matchKey("")).toBe("");
    expect(matchKey("   ")).toBe("");
  });

  it("dblpKeyFromUrl extracts journal and conference keys", () => {
    expect(dblpKeyFromUrl("http://dblp.uni-trier.de/db/journals/jacm/")).toBe("jacm");
    expect(dblpKeyFromUrl("https://dblp.org/db/conf/internetware/index.html")).toBe("internetware");
    expect(dblpKeyFromUrl("https://www.journals.elsevier.com/cognition/")).toBe("");
    expect(dblpKeyFromUrl("")).toBe("");
  });

  it("coreSearchTerm strips stopwords and org prefixes", () => {
    expect(coreSearchTerm("USENIX Symposium on Operating Systems Design and Implementations")).toBe(
      "operating systems design implementations",
    );
    expect(coreSearchTerm("International Conference on Medical Image Computing and Computer-Assisted Intervention")).toBe(
      "medical image computing computer assisted intervention",
    );
  });
});

describe("rowToVenue", () => {
  const header = [
    "刊物名称", "Journal", "年份", "出版社", "网址", "领域",
    "CCF推荐类别（国际学术刊物/会议）", "CCF推荐类型",
  ];

  it("maps a journal row", () => {
    const v = rowToVenue([
      "JACM", "Journal of the ACM", "2026", "ACM",
      "http://dblp.uni-trier.de/db/journals/jacm/", "交叉/综合/新兴",
      "推荐国际学术刊物", "A类",
    ]);
    expect(v).toMatchObject({
      abbr: "JACM",
      name: "Journal of the ACM",
      year: 2026,
      type: "journal",
      rank: "A",
      domain: "交叉/综合/新兴",
      dblpKey: "jacm",
      matchKey: "jacm",
      nameKey: "journal of the acm",
    });
    expect(header).toHaveLength(8);
  });

  it("maps a conference row", () => {
    const v = rowToVenue([
      "AAAI", "AAAI Conference on Artificial Intelligence", "2026", "AAAI",
      "https://dblp.org/db/conf/aaai/index.html", "人工智能",
      "推荐国际学术会议", "A类",
    ]);
    expect(v.type).toBe("conference");
    expect(v.dblpKey).toBe("aaai");
  });

  it("falls back to full name for matchKey when abbr is empty", () => {
    const v = rowToVenue([
      "", "Briefings in Bioinformatics", "2026", "Oxford University Press",
      "http://dblp.uni-trier.de/db/journals/bib/", "交叉/综合/新兴",
      "推荐国际学术刊物", "B类",
    ]);
    expect(v.abbr).toBe("");
    expect(v.matchKey).toBe("briefings in bioinformatics");
  });

  it("falls back to abbr when full name is empty (real HotSec row)", () => {
    const v = rowToVenue([
      "HotSec", "", "2026", "USENIX", "http://www.usenix.org/events/",
      "网络与信息安全", "推荐国际学术会议", "C类",
    ]);
    expect(v.name).toBe("HotSec");
    expect(v.matchKey).toBe("hotsec");
  });

  it("rejects rows with both abbr and name empty", () => {
    expect(() =>
      rowToVenue(["", "", "2026", "P", "", "人工智能", "推荐国际学术会议", "A类"]),
    ).toThrow();
  });

  it("rejects unknown type and rank labels", () => {
    const base = ["X", "X Venue", "2026", "P", "", "人工智能", "推荐国际学术刊物", "A类"];
    expect(() => rowToVenue([...base.slice(0, 6), "未知类别", "A类"])).toThrow();
    expect(() => rowToVenue([...base.slice(0, 7), "D类"])).toThrow();
  });
});

describe("count validation", () => {
  it("accepts the expected CCF 2026 tally", () => {
    expect(() => assertExpectedCounts(EXPECTED_COUNTS)).not.toThrow();
  });

  it("rejects a wrong total", () => {
    expect(() => assertExpectedCounts({ ...EXPECTED_COUNTS, total: 680 })).toThrow(/681/);
  });

  it("rejects a wrong rank distribution", () => {
    const bad = {
      ...EXPECTED_COUNTS,
      journal: { ...EXPECTED_COUNTS.journal, A: 36 },
    };
    expect(() => assertExpectedCounts(bad)).toThrow();
  });

  it("tally groups by type and rank", () => {
    const venues = [
      { type: "journal", rank: "A" },
      { type: "journal", rank: "A" },
      { type: "conference", rank: "C" },
    ];
    const t = tally(venues);
    expect(t.total).toBe(3);
    expect(t.journal).toEqual({ total: 2, A: 2, B: 0, C: 0 });
    expect(t.conference).toEqual({ total: 1, A: 0, B: 0, C: 1 });
  });
});

describe("real CCF2026 CSV (committed raw fixture)", () => {
  const text = readFileSync(
    fileURLToPath(new URL("../data/raw/CCF2026-UTF8.csv", import.meta.url)),
    "utf8",
  );
  const rows = parseCsv(text).slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  const venues = rows.map(rowToVenue);

  it("has exactly 681 venues with the expected A/B/C distribution", () => {
    expect(venues).toHaveLength(681);
    expect(() => assertExpectedCounts(tally(venues))).not.toThrow();
  });

  it("every venue is edition 2026 with non-empty name and valid labels", () => {
    for (const v of venues) {
      expect(v.year).toBe(2026);
      expect(v.name.length).toBeGreaterThan(0);
      expect(["journal", "conference"]).toContain(v.type);
      expect(["A", "B", "C"]).toContain(v.rank);
      expect(v.domain.length).toBeGreaterThan(0);
    }
  });

  it("contains known anchors", () => {
    const tpami = venues.find((v) => v.abbr === "TPAMI");
    expect(tpami).toMatchObject({ type: "journal", rank: "A", dblpKey: "pami" });
    const jacm = venues.find((v) => v.abbr === "JACM");
    expect(jacm).toMatchObject({ type: "journal", rank: "A" });
  });
});