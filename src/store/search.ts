import { create } from "zustand";
import { apiGet, isFallbackError } from "@/src/lib/api";
import { buildIndex, filterVenues, sourceIdsForVenues, type CcfIndex } from "@/src/lib/ccf";
import { mergeResults, PER_PAGE, runBatches, sliceSourceIds } from "@/src/lib/filters";
import { DEFAULT_FILTERS, EXAMPLE_QUERIES, type CcfCatalog, type Paper, type SearchFilters } from "@/src/lib/types";

export type SearchStatus = "idle" | "loading" | "ready" | "error";

const ERROR_TEXT: Record<string, string> = {
  quota_exhausted: "OpenAlex 今日额度已耗尽，请稍后再试或使用示例查询查看演示数据。",
  upstream_auth_error: "上游鉴权失败（API key 无效），请联系维护者或使用示例查询。",
  upstream_timeout: "上游响应超时，请重试。",
  upstream_error: "上游服务暂时不可用，请重试。",
  rate_limited: "请求过于频繁，请稍后再试。",
  invalid_input: "检索参数有误，请检查筛选条件。",
  network_error: "网络连接失败，请检查网络后重试。",
};

export function errorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? (e instanceof TypeError ? "network_error" : "upstream_error");
  return ERROR_TEXT[code] ?? "检索失败，请重试。";
}

const demoSlug = (q: string) => q.trim().toLowerCase().replace(/\s+/g, "-");

async function loadDemo(query: string): Promise<Paper[] | null> {
  const slug = demoSlug(query);
  if (!EXAMPLE_QUERIES.some((q) => demoSlug(q) === slug)) return null;
  try {
    const res = await fetch(`/data/demo/${slug}.json`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.results ?? null;
  } catch {
    return null;
  }
}

interface SearchState {
  index: CcfIndex | null;
  catalogError: string | null;
  query: string;
  filters: SearchFilters;
  results: Paper[];
  windowCount: number;
  status: SearchStatus;
  error: string | null;
  fallback: boolean;
  loadCatalog: () => Promise<void>;
  setQuery: (q: string) => void;
  setFilters: (f: SearchFilters) => void;
  search: () => Promise<void>;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  index: null,
  catalogError: null,
  query: "",
  filters: DEFAULT_FILTERS,
  results: [],
  windowCount: 0,
  status: "idle",
  error: null,
  fallback: false,

  loadCatalog: async () => {
    try {
      const res = await fetch("/data/ccf-venues.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const catalog: CcfCatalog = await res.json();
      set({ index: buildIndex(catalog), catalogError: null });
    } catch {
      set({ catalogError: "CCF 目录加载失败，请刷新重试。" });
    }
  },

  setQuery: (q) => set({ query: q }),
  setFilters: (f) => set({ filters: f }),

  search: async () => {
    const { index, query, filters } = get();
    if (!index) return;
    set({ status: "loading", error: null, fallback: false });
    const venues = filterVenues(index.venues, filters);
    const chunks = sliceSourceIds(sourceIdsForVenues(venues));
    try {
      const batches = await runBatches(chunks, async (chunk) => {
        const params: Record<string, string> = { perPage: String(PER_PAGE) };
        if (query.trim()) params.q = query.trim();
        if (chunk.length) params.sources = chunk.join(",");
        if (filters.yearFrom) params.yearFrom = String(filters.yearFrom);
        if (filters.yearTo) params.yearTo = String(filters.yearTo);
        const body = await apiGet<{ results?: Paper[] }>("/search", params);
        return body.results ?? [];
      });
      const merged = mergeResults(batches);
      set({ results: merged, windowCount: merged.length, status: "ready" });
    } catch (e) {
      if (isFallbackError(e)) {
        const demo = await loadDemo(query);
        if (demo) {
          set({ results: demo, windowCount: demo.length, status: "ready", fallback: true });
          return;
        }
      }
      set({ status: "error", error: errorText(e), results: [], windowCount: 0 });
    }
  },
}));