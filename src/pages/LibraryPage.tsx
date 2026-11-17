import { CcfBadge } from "@/src/components/CcfBadge";
import type { Rank } from "@/src/lib/types";
import { useLibraryStore } from "@/src/store/library";

export default function LibraryPage() {
  const items = useLibraryStore((s) => s.items);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">我的收藏（{items.length}）</h2>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          还没有收藏。在检索结果中点击书签图标收藏论文。
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.workId} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center gap-2">
                <CcfBadge rank={it.snapshot.rank as Rank | undefined} />
                <span className="font-medium">{it.snapshot.title}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {it.snapshot.venue} · {it.snapshot.year ?? "—"} · {it.snapshot.authors.slice(0, 3).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">完整管理（标签/阅读状态/笔记/BibTeX 与 JSON 导出）将在后续版本提供。收藏仅存于本浏览器。</p>
    </div>
  );
}