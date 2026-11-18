import { describe, expect, it } from "vitest";
import { CORE_CAP, TOTAL_CAP } from "@/src/lib/citations";
import {
  NODE_VAL_CAP,
  RANK_COLORS,
  UNRANKED_COLOR,
  buildGraph,
  filterIsolated,
  filterLinks,
  nodeVal,
} from "@/src/lib/graph";
import type { Paper, Rank } from "@/src/lib/types";

const rankOf = (sid: string): Rank | undefined =>
  sid === "SA" ? "A" : sid === "SB" ? "B" : sid === "SC" ? "C" : undefined;

const P = (id: string, cited = 0, refs: string[] = [], sourceId = ""): Paper => ({
  id: `https://openalex.org/${id}`,
  doi: null,
  title: id,
  display_name: id,
  publication_year: 2024,
  cited_by_count: cited,
  type: "article",
  authors: [],
  venue: null,
  sourceId,
  sourceType: null,
  biblio: null,
  oaUrl: null,
  url: null,
  referenced_works: refs.map((r) => `https://openalex.org/${r}`),
  refsTotal: refs.length,
  refsTruncated: false,
  countries: [],
  firstAuthorCountry: null,
});
const nid = (n: { id: string }) => n.id.replace("https://openalex.org/", "");

describe("nodeVal", () => {
  it("4+sqrt(cited) capped, negatives clamped", () => {
    expect(nodeVal(0)).toBe(4);
    expect(nodeVal(100)).toBe(14);
    expect(nodeVal(100000)).toBe(NODE_VAL_CAP);
    expect(nodeVal(-5)).toBe(4);
  });
});

describe("buildGraph", () => {
  it("empty input → empty graph", () => {
    expect(buildGraph([], [], rankOf)).toEqual({ nodes: [], links: [] });
  });
  it("edges only within displayed set, directed, deduped, no self-loops", () => {
    const core = [P("W1", 10, ["W2", "W2", "W1", "W999"]), P("W2", 5, ["W1"])];
    const { nodes, links } = buildGraph(core, [], rankOf);
    expect(nodes.map(nid)).toEqual(["W1", "W2"]);
    expect(links).toEqual([
      { source: "https://openalex.org/W1", target: "https://openalex.org/W2" },
      { source: "https://openalex.org/W2", target: "https://openalex.org/W1" },
    ]);
  });
  it("includes edges among expanded nodes", () => {
    const core = [P("W1", 10, ["W2"])];
    const expanded = [P("W2", 5, ["W3"]), P("W3", 1, [])];
    const { links } = buildGraph(core, expanded, rankOf);
    expect(links).toContainEqual({ source: "https://openalex.org/W2", target: "https://openalex.org/W3" });
  });
  it("caps displayed at 150 with 100 core seats, deterministic order", () => {
    const core = Array.from({ length: 120 }, (_, i) => P(`W${i}`, 1000 - i));
    const expanded = Array.from({ length: 60 }, (_, i) => P(`E${i}`, 10));
    const { nodes } = buildGraph(core, expanded, rankOf);
    expect(nodes).toHaveLength(TOTAL_CAP);
    expect(nodes.filter((n) => !n.expanded)).toHaveLength(CORE_CAP);
    expect(nid(nodes[0])).toBe("W0");
    expect(nid(nodes[100])).toBe("E0");
    expect(nid(nodes[149])).toBe("E49");
  });
  it("colors by CCF rank, gray unranked; expanded flag for non-core", () => {
    const core = [P("W1", 1, [], "SA")];
    const expanded = [P("W2", 1, [], "SB"), P("W3", 1, [], "SC"), P("W4", 1)];
    const { nodes } = buildGraph(core, expanded, rankOf);
    expect(nodes.map((n) => n.color)).toEqual([RANK_COLORS.A, RANK_COLORS.B, RANK_COLORS.C, UNRANKED_COLOR]);
    expect(nodes.map((n) => n.expanded)).toEqual([false, true, true, true]);
  });
});

describe("isolated filtering", () => {
  const core = [P("W1", 1, ["W2"]), P("W2", 1), P("W3", 1)];
  it("hides isolated nodes and their dangling links by default", () => {
    const { nodes, links } = buildGraph(core, [], rankOf);
    const vis = filterIsolated(nodes, links, false);
    expect(vis.map(nid)).toEqual(["W1", "W2"]);
    expect(filterLinks(links, vis)).toHaveLength(1);
  });
  it("showIsolated keeps all nodes", () => {
    const { nodes, links } = buildGraph(core, [], rankOf);
    expect(filterIsolated(nodes, links, true)).toHaveLength(3);
  });
});