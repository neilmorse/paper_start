import { describe, expect, it } from "vitest";
import {
  isAcceptable,
  jaccard,
  normalizeSource,
  rankCandidates,
  scoreCandidate,
  sourceIdFromUrl,
} from "@/scripts/lib/match.mjs";
import { matchKey } from "@/scripts/lib/normalize.mjs";

function venue(abbr, name, type) {
  return { abbr, name, nameKey: matchKey(name), type, rank: "A" };
}

function source(id, displayName, type, opts = {}) {
  return normalizeSource({
    id: `https://openalex.org/${id}`,
    display_name: displayName,
    type,
    alternate_titles: opts.alternateTitles ?? [],
    works_count: opts.worksCount ?? 0,
    issn_l: opts.issnL ?? "",
    listed_in: opts.listedIn ?? [],
    relevance_score: opts.relevanceScore ?? null,
  });
}

describe("sourceIdFromUrl", () => {
  it("extracts the S-id from a full URL", () => {
    expect(sourceIdFromUrl("https://openalex.org/S4210191458")).toBe("S4210191458");
  });
  it("passes through a bare S-id", () => {
    expect(sourceIdFromUrl("S199944782")).toBe("S199944782");
  });
  it("returns empty for non-source input", () => {
    expect(sourceIdFromUrl("")).toBe("");
    expect(sourceIdFromUrl("https://openalex.org/W123")).toBe("");
  });
});

describe("normalizeSource", () => {
  it("maps real OpenAlex fields (alternate_titles, not aliases)", () => {
    const s = source("S1", "Some Journal", "journal", {
      alternateTitles: ["SJ"],
      worksCount: 100,
      issnL: "1234-5678",
      listedIn: ["ccf-a"],
    });
    expect(s).toMatchObject({
      id: "S1",
      displayName: "Some Journal",
      alternateTitles: ["SJ"],
      issnL: "1234-5678",
      type: "journal",
      worksCount: 100,
      listedIn: ["ccf-a"],
    });
  });
  it("defaults missing fields safely", () => {
    const s = normalizeSource({ id: "https://openalex.org/S2" });
    expect(s.alternateTitles).toEqual([]);
    expect(s.worksCount).toBe(0);
    expect(s.displayName).toBe("");
  });
});

describe("jaccard", () => {
  it("computes token overlap", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(["a", "b"]), new Set(["c"]))).toBe(0);
    expect(jaccard(new Set(), new Set(["a"]))).toBe(0);
  });
});

describe("scoreCandidate", () => {
  it("scores the correct AAAI conference high", () => {
    const v = venue("AAAI", "AAAI Conference on Artificial Intelligence", "conference");
    const s = source("S4210191458", "Proceedings of the AAAI Conference on Artificial Intelligence", "conference", { worksCount: 25109 });
    const r = scoreCandidate(v, s);
    expect(r.confidence).toBe("high");
    expect(r.score).toBeGreaterThanOrEqual(0.7);
    expect(r.reasons).toContain("abbr");
  });

  it("scores an unrelated conference low", () => {
    const v = venue("AAAI", "AAAI Conference on Artificial Intelligence", "conference");
    const s = source("S9", "International Conference on Runtime Verification", "conference");
    expect(scoreCandidate(v, s).confidence).toBe("low");
  });

  it("penalizes type mismatch", () => {
    const v = venue("TPAMI", "IEEE Transactions on Pattern Analysis and Machine Intelligence", "journal");
    const asJournal = source("S1", "IEEE Transactions on Pattern Analysis and Machine Intelligence", "journal");
    const asConference = source("S1", "IEEE Transactions on Pattern Analysis and Machine Intelligence", "conference");
    expect(scoreCandidate(v, asJournal).score).toBeGreaterThan(scoreCandidate(v, asConference).score);
  });

  it("matches a journal by full name", () => {
    const v = venue("TPAMI", "IEEE Transactions on Pattern Analysis and Machine Intelligence", "journal");
    const s = source("S199944782", "IEEE Transactions on Pattern Analysis and Machine Intelligence", "journal", { worksCount: 12000 });
    expect(scoreCandidate(v, s).confidence).toBe("high");
  });

  it("uses alternate_titles for abbr hit when display_name lacks it", () => {
    const v = venue("JACM", "Journal of the ACM", "journal");
    const s = source("S1", "Journal of the ACM", "journal", { alternateTitles: ["JACM"] });
    expect(scoreCandidate(v, s).reasons).toContain("abbr");
  });

  it("handles abbr-less venues via full name", () => {
    const v = venue("", "Briefings in Bioinformatics", "journal");
    const s = source("S1", "Briefings in Bioinformatics", "journal");
    expect(scoreCandidate(v, s).confidence).toBe("high");
  });
});

describe("isAcceptable (false-positive guards)", () => {
  it("rejects CAV matched to Cavitation (abbr-only, low name similarity)", () => {
    const v = venue("CAV", "International Conference on Computer Aided Verification", "conference");
    const s = source("S7407096370", "International Symposium on Cavitation (CAV)", "conference", { worksCount: 183 });
    expect(isAcceptable(scoreCandidate(v, s))).toBe(false);
  });

  it("rejects CRYPTO matched to a blockchain conference", () => {
    const v = venue("CRYPTO", "International Cryptology Conference", "conference");
    const s = source("S7407107822", "Crypto Valley Conference on Blockchain Technology (CVCBT)", "conference");
    expect(isAcceptable(scoreCandidate(v, s))).toBe(false);
  });

  it("rejects FAST matched to a sea transportation conference", () => {
    const v = venue("FAST", "USENIX Conference on File and Storage Technologies", "conference");
    const s = source("S7407104977", "SNAME International Conference on Fast Sea Transportation (FAST)", "conference");
    expect(isAcceptable(scoreCandidate(v, s))).toBe(false);
  });

  it("does not abbr-match FM inside SEFM (word boundary)", () => {
    const v = venue("FM", "International Symposium on Formal Methods", "conference");
    const s = source("S7407089105", "IEEE International Conference on Software Engineering and Formal Methods (SEFM)", "conference");
    const r = scoreCandidate(v, s);
    expect(r.reasons).not.toContain("abbr");
    expect(isAcceptable(r)).toBe(false);
  });

  it("accepts the correct AAAI conference", () => {
    const v = venue("AAAI", "AAAI Conference on Artificial Intelligence", "conference");
    const s = source("S4210191458", "Proceedings of the AAAI Conference on Artificial Intelligence", "conference", { worksCount: 25109 });
    expect(isAcceptable(scoreCandidate(v, s))).toBe(true);
  });
});

describe("rankCandidates", () => {
  it("sorts by score then worksCount then id deterministically", () => {
    const v = venue("AAAI", "AAAI Conference on Artificial Intelligence", "conference");
    const a = source("S2", "Proceedings of the AAAI Conference on Artificial Intelligence", "conference", { worksCount: 100 });
    const b = source("S1", "Proceedings of the AAAI Conference on Artificial Intelligence", "conference", { worksCount: 200 });
    const c = source("S3", "Unrelated Workshop", "conference", { worksCount: 999 });
    const ranked = rankCandidates(v, [a, b, c]);
    expect(ranked.map((r) => r.source.id)).toEqual(["S1", "S2", "S3"]);
  });

  it("is reproducible regardless of input order", () => {
    const v = venue("AAAI", "AAAI Conference on Artificial Intelligence", "conference");
    const s1 = source("S1", "Proceedings of the AAAI Conference on Artificial Intelligence", "conference", { worksCount: 200 });
    const s2 = source("S2", "Proceedings of the AAAI Conference on Artificial Intelligence", "conference", { worksCount: 100 });
    expect(rankCandidates(v, [s1, s2]).map((r) => r.source.id)).toEqual(
      rankCandidates(v, [s2, s1]).map((r) => r.source.id),
    );
  });
});