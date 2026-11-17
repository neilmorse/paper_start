import { describe, expect, it } from "vitest";
import { mergeResults, runBatches, sliceSourceIds } from "@/src/lib/filters";
import type { Paper } from "@/src/lib/types";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `S${i}`);
const paper = (id: string, cited: number): Paper => ({ id, cited_by_count: cited } as Paper);

describe("sliceSourceIds (≤100 OR filter cap)", () => {
  it("100 ids → single chunk", () => {
    expect(sliceSourceIds(ids(100))).toHaveLength(1);
    expect(sliceSourceIds(ids(100))[0]).toHaveLength(100);
  });
  it("101 ids → 100 + 1", () => {
    const c = sliceSourceIds(ids(101));
    expect(c).toHaveLength(2);
    expect(c[0]).toHaveLength(100);
    expect(c[1]).toHaveLength(1);
  });
  it("681 ids → 7 chunks", () => {
    const c = sliceSourceIds(ids(681));
    expect(c).toHaveLength(7);
    expect(c.flat()).toHaveLength(681);
  });
  it("empty → no chunks", () => {
    expect(sliceSourceIds([])).toEqual([]);
  });
});

describe("mergeResults", () => {
  it("dedups by id across batches", () => {
    const merged = mergeResults([[paper("W1", 5), paper("W2", 3)], [paper("W1", 5), paper("W3", 9)]]);
    expect(merged.map((p) => p.id)).toEqual(["W3", "W1", "W2"]);
  });
  it("sorts by cited_by_count desc with id tiebreak", () => {
    const merged = mergeResults([[paper("W2", 10), paper("W1", 10), paper("W3", 1)]]);
    expect(merged.map((p) => p.id)).toEqual(["W1", "W2", "W3"]);
  });
  it("handles empty batches", () => {
    expect(mergeResults([[], []])).toEqual([]);
  });
});

describe("runBatches (concurrency ≤4)", () => {
  it("executes all items and preserves order", async () => {
    const out = await runBatches([1, 2, 3, 4, 5], async (n) => [n * 10]);
    expect(out).toEqual([[10], [20], [30], [40], [50]]);
  });
  it("never exceeds concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await runBatches(
      Array.from({ length: 12 }, (_, i) => i),
      async (n) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return [n];
      },
      4,
    );
    expect(peak).toBeLessThanOrEqual(4);
  });
});