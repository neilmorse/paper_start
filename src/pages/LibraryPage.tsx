import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/src/components/ExportMenu";
import { LibraryTable } from "@/src/components/LibraryTable";
import type { LibraryItem } from "@/src/lib/types";
import { useLibraryStore } from "@/src/store/library";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | LibraryItem["status"];

export default function LibraryPage() {
  const items = useLibraryStore((s) => s.items);
  const removeMany = useLibraryStore((s) => s.removeMany);
  const setStatusMany = useLibraryStore((s) => s.setStatusMany);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => [...new Set(items.flatMap((i) => i.tags))].sort(), [items]);
  const filtered = useMemo(
    () =>
      items.filter(
        (i) => (!tagFilter || i.tags.includes(tagFilter)) && (statusFilter === "all" || i.status === statusFilter),
      ),
    [items, tagFilter, statusFilter],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.workId));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((i) => i.workId)));
  const selectedIds = [...selected];
  const batchStatus = (s: LibraryItem["status"]) => setStatusMany(selectedIds, s);
  const batchDelete = () => {
    if (!window.confirm(`删除选中的 ${selectedIds.length} 条收藏？此操作不可撤销（建议先导出备份）。`)) return;
    removeMany(selectedIds);
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">我的收藏（{items.length}）</h2>
        <ExportMenu />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          还没有收藏。在检索结果中点击书签图标收藏论文。收藏仅存于本浏览器，可用 BibTeX/JSON 导出备份。
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              aria-label="阅读状态筛选"
            >
              <option value="all">全部状态</option>
              <option value="unread">未读</option>
              <option value="reading">在读</option>
              <option value="done">已读</option>
            </select>
            <button
              type="button"
              onClick={() => setTagFilter(null)}
              aria-pressed={tagFilter === null}
              className={cn(
                "rounded-md border px-2 py-1 text-xs",
                tagFilter === null ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent",
              )}
            >
              全部标签
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                aria-pressed={tagFilter === t}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  tagFilter === t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-xs">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              全选
            </label>
            <span className="text-muted-foreground">已选 {selectedIds.length}</span>
            <Button variant="outline" size="sm" disabled={!selectedIds.length} onClick={() => batchStatus("unread")}>
              标未读
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedIds.length} onClick={() => batchStatus("reading")}>
              标在读
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedIds.length} onClick={() => batchStatus("done")}>
              标已读
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedIds.length} onClick={batchDelete}>
              删除选中
            </Button>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              当前筛选下无收藏。试试清除标签/状态筛选。
            </div>
          ) : (
            <LibraryTable items={filtered} selected={selected} onToggle={toggle} />
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">收藏仅存于本浏览器 localStorage；换设备或清缓存前请导出 BibTeX/JSON 备份。</p>
    </div>
  );
}