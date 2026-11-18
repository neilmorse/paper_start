import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterPanel } from "@/src/components/FilterPanel";
import { PaperDetailSheet } from "@/src/components/PaperDetailSheet";
import { QuotaBanner } from "@/src/components/QuotaBanner";
import { ResultList } from "@/src/components/ResultList";
import { SearchBar } from "@/src/components/SearchBar";
import type { Paper, Rank, VenueType } from "@/src/lib/types";
import { useSearchStore } from "@/src/store/search";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const index = useSearchStore((s) => s.index);
  const catalogError = useSearchStore((s) => s.catalogError);
  const loadCatalog = useSearchStore((s) => s.loadCatalog);
  const query = useSearchStore((s) => s.query);
  const filters = useSearchStore((s) => s.filters);
  const view = useSearchStore((s) => s.view);
  const [detail, setDetail] = useState<Paper | null>(null);
  const [open, setOpen] = useState(false);
  const ready = useRef(false);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // URL → state（目录就绪后一次性深链还原）
  useEffect(() => {
    if (!index) return;
    const st = useSearchStore.getState();
    const q = params.get("q") ?? "";
    const ranks = (params.get("rank") ?? "A").split(",").filter(Boolean) as Rank[];
    const domain = params.get("domain") ?? "";
    const types = (params.get("type") ?? "").split(",").filter(Boolean) as VenueType[];
    const from = params.get("from");
    const to = params.get("to");
    st.setQuery(q);
    st.setFilters({
      ranks,
      domains: domain ? [domain] : [],
      types,
      yearFrom: from ? Number(from) : undefined,
      yearTo: to ? Number(to) : undefined,
    });
    const v = params.get("view");
    st.setView(v === "list" || v === "graph" ? v : "roadmap");
    if (q) st.search();
    ready.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // state → URL（可分享深链；初始化后才同步，避免覆盖深链参数）
  useEffect(() => {
    if (!ready.current) return;
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (filters.ranks.length) p.set("rank", filters.ranks.join(","));
    if (filters.domains.length) p.set("domain", filters.domains[0]);
    if (filters.types.length) p.set("type", filters.types.join(","));
    if (filters.yearFrom) p.set("from", String(filters.yearFrom));
    if (filters.yearTo) p.set("to", String(filters.yearTo));
    p.set("view", view);
    setParams(p, { replace: true });
  }, [query, filters, view, setParams]);

  if (catalogError) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{catalogError}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchBar />
      <FilterPanel />
      <QuotaBanner />
      <ResultList
        onOpen={(p) => {
          setDetail(p);
          setOpen(true);
        }}
      />
      <PaperDetailSheet paper={detail} open={open} onOpenChange={setOpen} />
    </div>
  );
}