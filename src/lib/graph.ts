import { TOTAL_CAP, graphCore } from "./citations";
import type { RankOf } from "./roadmap";
import type { Paper, Rank } from "./types";

// 节点大小 4+sqrt(cited) 封顶；颜色 A=金红/B=蓝/C=绿/未分级=灰；扩展节点虚线描边（组件绘制）。
export const NODE_VAL_CAP = 30;
export const RANK_COLORS: Record<Rank, string> = { A: "#e4572e", B: "#3b82f6", C: "#22c55e" };
export const UNRANKED_COLOR = "#9ca3af";

export interface GraphNode {
  id: string;
  paper: Paper;
  rank: Rank | undefined;
  expanded: boolean;
  val: number;
  color: string;
}
export interface GraphLink {
  source: string;
  target: string;
}

export function nodeVal(cited: number): number {
  return Math.min(NODE_VAL_CAP, 4 + Math.sqrt(Math.max(0, cited)));
}

// 展示集=graphCore(core)（≤100，保扩展席位）+expanded，去重后硬上限 150；边只连展示集内（有向、去重）。
export function buildGraph(
  core: Paper[],
  expanded: Paper[],
  rankOf: RankOf,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const coreIds = new Set(core.map((p) => p.id));
  const seen = new Set<string>();
  const displayed: Paper[] = [];
  for (const p of [...graphCore(core), ...expanded]) {
    if (!p?.id || seen.has(p.id) || displayed.length >= TOTAL_CAP) continue;
    seen.add(p.id);
    displayed.push(p);
  }
  const nodes: GraphNode[] = displayed.map((p) => {
    const rank = rankOf(p.sourceId);
    return {
      id: p.id,
      paper: p,
      rank,
      expanded: !coreIds.has(p.id),
      val: nodeVal(p.cited_by_count),
      color: rank ? RANK_COLORS[rank] : UNRANKED_COLOR,
    };
  });
  const ids = new Set(nodes.map((n) => n.id));
  const linkSeen = new Set<string>();
  const links: GraphLink[] = [];
  for (const n of nodes) {
    for (const ref of n.paper.referenced_works ?? []) {
      if (!ids.has(ref) || ref === n.id) continue;
      const key = `${n.id}|${ref}`;
      if (linkSeen.has(key)) continue;
      linkSeen.add(key);
      links.push({ source: n.id, target: ref });
    }
  }
  return { nodes, links };
}

export function filterIsolated(nodes: GraphNode[], links: GraphLink[], showIsolated: boolean): GraphNode[] {
  if (showIsolated) return nodes;
  const connected = new Set<string>();
  for (const l of links) {
    connected.add(l.source);
    connected.add(l.target);
  }
  return nodes.filter((n) => connected.has(n.id));
}

export function filterLinks(links: GraphLink[], nodes: GraphNode[]): GraphLink[] {
  const ids = new Set(nodes.map((n) => n.id));
  return links.filter((l) => ids.has(l.source) && ids.has(l.target));
}