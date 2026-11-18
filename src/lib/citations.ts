import { runBatches, sliceSourceIds } from "./filters";
import type { Paper } from "./types";

// 图谱总节点硬上限 150；core 超限确定性截断保扩展席位；扩展取文 ≤2 批（filter 类计费便宜）。
export const TOTAL_CAP = 150;
export const CORE_CAP = 100;
export const FETCH_CAP = 200;

export function workIdOf(id: string): string {
  const m = /(W\d+)$/.exec(id ?? "");
  return m ? m[1] : "";
}

export function graphCore(core: Paper[]): Paper[] {
  return core.slice(0, CORE_CAP);
}

export function expandBudget(coreCount: number, totalCap = TOTAL_CAP): number {
  return Math.max(0, Math.min(totalCap - coreCount, FETCH_CAP));
}

// 候选=core 各篇 referenced_works 并集−core ids，freq=集内被引频次。
export function candidateFreqs(core: Paper[]): Map<string, number> {
  const coreIds = new Set(core.map((p) => workIdOf(p.id)));
  const freq = new Map<string, number>();
  for (const p of core) {
    for (const ref of p.referenced_works ?? []) {
      const wid = workIdOf(ref);
      if (!wid || coreIds.has(wid)) continue;
      freq.set(wid, (freq.get(wid) ?? 0) + 1);
    }
  }
  return freq;
}

// 预选（取回前 cited_by_count 不可知）：freq↓→id↑，截 budget。
export function selectCandidates(core: Paper[], budget: number): string[] {
  if (budget <= 0) return [];
  return [...candidateFreqs(core).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, budget)
    .map(([wid]) => wid);
}

// 终排（取回后）：freq↓→cited_by_count↓→id↑；仅保留候选集内、按 id 去重。
export function rankExpanded(fetched: Paper[], freq: Map<string, number>): Paper[] {
  const seen = new Set<string>();
  const out: Paper[] = [];
  for (const p of fetched) {
    const wid = workIdOf(p.id);
    if (!wid || !freq.has(wid) || seen.has(wid)) continue;
    seen.add(wid);
    out.push(p);
  }
  out.sort((a, b) => {
    const wa = workIdOf(a.id);
    const wb = workIdOf(b.id);
    return (freq.get(wb) ?? 0) - (freq.get(wa) ?? 0) || b.cited_by_count - a.cited_by_count || wa.localeCompare(wb);
  });
  return out;
}

// 路线图/图谱共用 1-hop 扩展。图谱：expandOnce(graphCore(core), fb)（budget=150−core）；
// 路线图：expandOnce(core, fb, FETCH_CAP)（全量 core + ≤200 扩展）。
export async function expandOnce(
  core: Paper[],
  fetchBatch: (ids: string[]) => Promise<Paper[]>,
  budget = expandBudget(core.length),
): Promise<Paper[]> {
  const candidates = selectCandidates(core, budget);
  if (!candidates.length) return [];
  const freq = candidateFreqs(core);
  const batches = await runBatches(sliceSourceIds(candidates, 100), fetchBatch, 2);
  return rankExpanded(batches.flat(), freq);
}