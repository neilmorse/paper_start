import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiGet, restoreAbstract, safeHref } from "@/src/lib/api";
import { venueForSource } from "@/src/lib/ccf";
import type { Paper } from "@/src/lib/types";
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
        </div>
      </SheetContent>
    </Sheet>
  );
}