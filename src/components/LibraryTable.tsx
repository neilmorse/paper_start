import { Button } from "@/components/ui/button";
import type { LibraryItem, Rank } from "@/src/lib/types";
import { useLibraryStore } from "@/src/store/library";
import { CcfBadge } from "./CcfBadge";
import { TagEditor } from "./TagEditor";

const STATUS_LABEL: Record<LibraryItem["status"], string> = { unread: "未读", reading: "在读", done: "已读" };

export function LibraryTable({
  items,
  selected,
  onToggle,
}: {
  items: LibraryItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const setStatus = useLibraryStore((s) => s.setStatus);
  const setNote = useLibraryStore((s) => s.setNote);
  const remove = useLibraryStore((s) => s.remove);
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={it.workId} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.has(it.workId)}
              onChange={() => onToggle(it.workId)}
              aria-label={`选择 ${it.snapshot.title}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CcfBadge rank={it.snapshot.rank as Rank | undefined} />
                <span className="font-medium">{it.snapshot.title}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {it.snapshot.venue ?? "未知来源"} · {it.snapshot.year ?? "—"} · 引用 {it.snapshot.citedByCount} ·{" "}
                {it.snapshot.authors.slice(0, 3).join(", ")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={it.status}
                  onChange={(e) => setStatus(it.workId, e.target.value as LibraryItem["status"])}
                  className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                  aria-label="阅读状态"
                >
                  {(Object.keys(STATUS_LABEL) as LibraryItem["status"][]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <TagEditor workId={it.workId} tags={it.tags} />
                <Button variant="ghost" size="sm" onClick={() => remove(it.workId)}>
                  删除
                </Button>
              </div>
              <textarea
                className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                rows={2}
                placeholder="笔记…"
                value={it.note}
                onChange={(e) => setNote(it.workId, e.target.value)}
                aria-label="笔记"
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}