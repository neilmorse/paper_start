import { useEffect, useState } from "react";
import { Code2Icon, StarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiGet, restoreAbstract, safeHref } from "@/src/lib/api";
import { venueForSource } from "@/src/lib/ccf";
import type { Paper } from "@/src/lib/types";
import { useGithubStore } from "@/src/store/github";
import { useSearchStore } from "@/src/store/search";
import { CcfBadge } from "./CcfBadge";

const workId = (id: string) => /(W\d+)$/.exec(id)?.[1] ?? id;

export function PaperDetailSheet({
  paper,
  open,
  onOpenChange,
}: {
  paper: Paper | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const index = useSearchStore((s) => s.index);
  const venue = paper && index ? venueForSource(index, paper.sourceId) : undefined;
  const [detail, setDetail] = useState<Paper | null>(null);
  const lookup = useGithubStore((s) => s.lookup);
  const gh = useGithubStore((s) => (paper ? s.byWorkId[paper.id] : undefined));

  useEffect(() => {
    if (!open || !paper) {
      setDetail(null);
      return;
    }
    let alive = true;
    apiGet<{ work: Paper }>("/work", { id: workId(paper.id) })
      .then((b) => {
        if (alive) setDetail(b.work);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, paper]);

  const abstract = restoreAbstract(detail?.abstract_inverted_index ?? paper?.abstract_inverted_index);
  const doi = safeHref(paper?.doi);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{paper?.title}</SheetTitle>
          <SheetDescription>{paper?.authors.join(", ")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-6 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <CcfBadge rank={venue?.rank} />
            <span>{venue?.abbr || paper?.venue}</span>
            <span>· {paper?.publication_year ?? "—"}</span>
            <span>· 引用 {paper?.cited_by_count ?? 0}</span>
          </div>
          {paper?.biblio && (
            <p className="text-muted-foreground">
              卷 {paper.biblio.volume ?? "—"}，期 {paper.biblio.issue ?? "—"}，页 {paper.biblio.first_page ?? "—"}–
              {paper.biblio.last_page ?? "—"}
            </p>
          )}
          <div>
            <h4 className="mb-1 font-medium">摘要</h4>
            <p className="leading-relaxed text-muted-foreground">{abstract || "（无摘要）"}</p>
          </div>
          {doi && (
            <a href={doi} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
              DOI 链接
            </a>
          )}
          <div>
            <h4 className="mb-1 flex items-center gap-1.5 font-medium">
              <Code2Icon className="size-4" /> 代码仓库
            </h4>
            {!gh ? (
              <Button variant="outline" size="sm" onClick={() => paper && lookup(paper.id, paper.title)}>
                查找相关代码仓库
              </Button>
            ) : gh.status === "loading" ? (
              <p className="text-xs text-muted-foreground">正在查询 GitHub…</p>
            ) : gh.status === "error" ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-amber-600">{gh.error}</p>
                <Button variant="outline" size="sm" onClick={() => paper && lookup(paper.id, paper.title)}>
                  重试
                </Button>
              </div>
            ) : gh.repos.length === 0 ? (
              <p className="text-xs text-muted-foreground">未找到相关仓库。</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">相关仓库（非官方认证，按标题模糊匹配）</p>
                <ul className="flex flex-col gap-2">
                  {gh.repos.map((r) => (
                    <li key={r.fullName} className="rounded-md border border-border p-2 text-xs">
                      <a
                        href={safeHref(r.url) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {r.fullName}
                      </a>
                      <span className="ml-2 inline-flex items-center gap-0.5 text-muted-foreground">
                        <StarIcon className="size-3" />
                        {r.stars}
                      </span>
                      <p className="mt-1 text-muted-foreground">
                        {[r.language, r.license, r.pushedAt ? `最近 push ${r.pushedAt.slice(0, 10)}` : null, r.fork ? "fork" : null, r.archived ? "archived" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {r.description && <p className="mt-1 line-clamp-2 text-muted-foreground">{r.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}