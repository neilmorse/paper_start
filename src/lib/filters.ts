import type { Paper } from "./types";

// source 多值 OR 过滤上限 100：按 ≤100 切片分批检索。
export function sliceSourceIds(ids: string[], size = 100): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

// 跨批合并：按 id 去重，默认 cited_by_count 降序（跨批 relevance_score 不可比），id 兜底确定性。
export function mergeResults(batches: Paper[][]): Paper[] {
  const seen = new Set<string>();
  const out: Paper[] = [];
  for (const batch of batches) {
    for (const p of batch) {
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  }
  out.sort((a, b) => b.cited_by_count - a.cited_by_count || a.id.localeCompare(b.id));
  return out;
}

export const MAX_CONCURRENCY = 4;
export const PER_PAGE = 50;

// 并发受限的分批执行（并发 ≤4）。executor 返回每批结果。
export async function runBatches<T, R>(
  items: T[],
  executor: (item: T) => Promise<R[]>,
  concurrency = MAX_CONCURRENCY,
): Promise<R[][]> {
  const results: R[][] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await executor(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}