import type { CcfCatalog, SearchFilters, Venue } from "./types";

export interface CcfIndex {
  catalog: CcfCatalog;
  venues: Venue[];
  bySourceId: Map<string, Venue>;
}

// 双向索引：sourceId→venue（卡片徽章反查）；筛选→venue 子集→sourceIds。
export function buildIndex(catalog: CcfCatalog): CcfIndex {
  const bySourceId = new Map<string, Venue>();
  for (const v of catalog.venues) {
    for (const sid of v.sourceIds) {
      if (sid && !bySourceId.has(sid)) bySourceId.set(sid, v);
    }
  }
  return { catalog, venues: catalog.venues, bySourceId };
}

export function venueForSource(index: CcfIndex, sourceId: string): Venue | undefined {
  return index.bySourceId.get(sourceId);
}

// 空数组表示该维度不过滤。默认预设 CCF-A（ranks:["A"]）。
export function filterVenues(venues: Venue[], f: SearchFilters): Venue[] {
  return venues.filter(
    (v) =>
      (f.ranks.length === 0 || f.ranks.includes(v.rank)) &&
      (f.domains.length === 0 || f.domains.includes(v.domain)) &&
      (f.types.length === 0 || f.types.includes(v.type)),
  );
}

export function sourceIdsForVenues(venues: Venue[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of venues) {
    for (const sid of v.sourceIds) {
      if (sid && !seen.has(sid)) {
        seen.add(sid);
        out.push(sid);
      }
    }
  }
  return out;
}