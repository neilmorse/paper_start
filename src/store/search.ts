import { create } from "zustand";
import { apiGet, isFallbackError } from "@/src/lib/api";
import { buildIndex, filterVenues, sourceIdsForVenues, venueForSource, type CcfIndex } from "@/src/lib/ccf";
import { FETCH_CAP, expandOnce } from "@/src/lib/citations";
import { mergeResults, PER_PAGE, runBatches, sliceSourceIds } from "@/src/lib/filters";
import { SOTA_SUPPLEMENT_MIN, SOTA_WINDOW, buildRoadmap } from "@/src/lib/roadmap";
import { DEFAULT_FILTERS, EXAMPLE_QUERIES, type CcfCatalog, type Paper, type SearchFilters } from "@/src/lib/types";

export type SearchStatus = "idle" | "loading" | "ready" | "error";
export type ResultView = "roadmap" | "list" | "graph";

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
const isExample = (q: string) => EXAMPLE_QUERIES.some((e) => demoSlug(e) === demoSlug(q));

async function loadDemo(query: string): Promise<Paper[] | null> {
  if (!isExample(query)) return null;
  try {
    const res = await fetch(`/data/demo/${demoSlug(query)}.json`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.results ?? null;
  } catch {
    return null;
  }
}

// 兜底模式的静态 1-hop 扩展批次（重生成 demo 时产出），路线图/图谱离线可渲染。
async function loadDemoRefs(query: string): Promise<Paper[] | null> {
  if (!isExample(query)) return null;
  try {
    const res = await fetch(`/data/demo/${demoSlug(query)}-refs.json`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.results ?? null;
  } catch {
    return null;
  }
}

// 同 (query,filters) 且非兜底态命中即跳过，防重复烧额度；兜底态允许重试真实检索。
let lastSearchKey = "";

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
  view: ResultView;
  expanded: Paper[];
  expanding: boolean;
  expandError: string | null;
  sotaExtra: Paper[];
  sotaSupplemented: boolean;
  loadCatalog: () => Promise<void>;
  setQuery: (q: string) => void;
  setFilters: (f: SearchFilters) => void;
  setView: (v: ResultView) => void;
  search: () => Promise<void>;
  expand: () => Promise<void>;
  supplementSota: () => Promise<void>;
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
  view: "roadmap",
  expanded: [],
  expanding: false,
  expandError: null,
  sotaExtra: [],
  sotaSupplemented: false,

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
  setView: (v) => set({ view: v }),

  search: async () => {
    const { index, query, filters } = get();
    if (!index) return;
    const key = JSON.stringify({ q: query.trim(), filters });
    if (key === lastSearchKey && get().status === "ready" && !get().fallback) return;
    set({ status: "loading", error: null, fallback: false, expanded: [], expandError: null, sotaExtra: [], sotaSupplemented: false });
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
      lastSearchKey = key;
      set({ results: merged, windowCount: merged.length, status: "ready" });
      await get().expand();
      await get().supplementSota();
    } catch (e) {
      if (isFallbackError(e)) {
        const demo = await loadDemo(query);
        if (demo) {
          lastSearchKey = key;
          set({ results: demo, windowCount: demo.length, status: "ready", fallback: true });
          await get().expand();
          return;
        }
      }
      set({ status: "error", error: errorText(e), results: [], windowCount: 0 });
    }
  },

  // 路线图默认视图 → 检索成功后自动 1-hop 扩展（≤2 次 filter 类请求）；失败不阻塞主结果。
  expand: async () => {
    const { results, fallback, query } = get();
    if (!results.length) return;
    set({ expanding: true, expandError: null });
    try {
      if (fallback) {
        const refs = await loadDemoRefs(query);
        set({ expanded: refs ?? [], expanding: false });
        if (!refs) set({ expandError: "演示扩展数据缺失，路线图仅基于当前结果窗口。" });
        return;
      }
      const expanded = await expandOnce(
        results,
        async (ids) => {
          const b = await apiGet<{ results?: Paper[] }>("/works", { ids: ids.join("|") });
          return b.results ?? [];
        },
        FETCH_CAP,
      );
      set({ expanded, expanding: false });
    } catch {
      set({ expanded: [], expanding: false, expandError: "引文扩展失败，路线图仅基于当前结果窗口。" });
    }
  },

  // 实测：relevance 窗口内近两年非综述论文稀少（GNN 演示 SOTA 仅 1 篇）。
  // 候选 <3 且单批来源时补一次「近两年+引用降序」检索（+1 search 请求）；多批/兜底不补，避免部分样本冒充全量。
  supplementSota: async () => {
    const { results, expanded, index, query, filters, fallback } = get();
    if (fallback || !index || !query.trim() || !results.length) return;
    const year = new Date().getFullYear();
    const rankOf = (sid: string) => venueForSource(index, sid)?.rank;
    if (buildRoadmap(results, expanded, rankOf, year).sota.length >= SOTA_SUPPLEMENT_MIN) return;
    const chunks = sliceSourceIds(sourceIdsForVenues(filterVenues(index.venues, filters)));
    if (chunks.length !== 1) return;
    try {
      const body = await apiGet<{ results?: Paper[] }>("/search", {
        q: query.trim(),
        sources: chunks[0].join(","),
        yearFrom: String(year - SOTA_WINDOW),
        sort: "cited_by_count:desc",
        type: "article",
        perPage: "25",
      });
      set({ sotaExtra: body.results ?? [], sotaSupplemented: true });
    } catch {
      // 补充检索失败不影响主结果与已有分层
    }
  },
}));