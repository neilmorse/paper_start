import type { ReactNode } from "react";
import { useSearchStore } from "@/src/store/search";
import type { Rank, SearchFilters, VenueType } from "@/src/lib/types";
import { cn } from "@/lib/utils";

const RANKS: Rank[] = ["A", "B", "C"];
const TYPES: Array<{ value: VenueType; label: string }> = [
  { value: "journal", label: "期刊" },
  { value: "conference", label: "会议" },
];

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-3 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function FilterPanel() {
  const filters = useSearchStore((s) => s.filters);
  const setFilters = useSearchStore((s) => s.setFilters);
  const search = useSearchStore((s) => s.search);
  const domains = useSearchStore((s) => s.index?.catalog.domains) ?? [];

  const update = (f: SearchFilters) => {
    setFilters(f);
    search();
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">分级</span>
        {RANKS.map((r) => (
          <Toggle key={r} active={filters.ranks.includes(r)} onClick={() => update({ ...filters, ranks: toggle(filters.ranks, r) })}>
            CCF {r}
          </Toggle>
        ))}
        <span className="ml-3 text-xs font-medium text-muted-foreground">类型</span>
        {TYPES.map((t) => (
          <Toggle key={t.value} active={filters.types.includes(t.value)} onClick={() => update({ ...filters, types: toggle(filters.types, t.value) })}>
            {t.label}
          </Toggle>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">领域</span>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={filters.domains[0] ?? ""}
          onChange={(e) => update({ ...filters, domains: e.target.value ? [e.target.value] : [] })}
          aria-label="领域筛选"
        >
          <option value="">全部领域</option>
          {domains.map((d) => (
            <option key={d.sub} value={d.name}>
              {d.name}（{d.venueCount}）
            </option>
          ))}
        </select>
        <span className="ml-3 text-xs font-medium text-muted-foreground">年份</span>
        <input
          type="number"
          className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
          placeholder="起"
          defaultValue={filters.yearFrom ?? ""}
          onBlur={(e) => update({ ...filters, yearFrom: e.target.value ? Number(e.target.value) : undefined })}
          aria-label="起始年份"
        />
        <input
          type="number"
          className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
          placeholder="止"
          defaultValue={filters.yearTo ?? ""}
          onBlur={(e) => update({ ...filters, yearTo: e.target.value ? Number(e.target.value) : undefined })}
          aria-label="结束年份"
        />
      </div>
    </div>
  );
}