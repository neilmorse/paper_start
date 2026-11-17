import { BookmarkCheckIcon, BookmarkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeHref } from "@/src/lib/api";
import { venueForSource } from "@/src/lib/ccf";
import type { Paper } from "@/src/lib/types";
import { useLibraryStore } from "@/src/store/library";
import { useSearchStore } from "@/src/store/search";
import { CcfBadge } from "./CcfBadge";

export function PaperCard({ paper, onOpen }: { paper: Paper; onOpen: (p: Paper) => void }) {
  const index = useSearchStore((s) => s.index);
  const venue = index ? venueForSource(index, paper.sourceId) : undefined;
  const rank = venue?.rank;
  const saved = useLibraryStore((s) => s.has(paper.id));
  const add = useLibraryStore((s) => s.add);
  const remove = useLibraryStore((s) => s.remove);
  const doi = safeHref(paper.doi);
  const oa = safeHref(paper.oaUrl);

  return (
    <article className="rounded-lg border border-border p-4 transition-colors hover:bg-accent/40">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="flex-1 text-left" onClick={() => onOpen(paper)}>
          <h3 className="font-medium leading-snug">{paper.title}</h3>
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={saved ? "取消收藏" : "收藏"}
          onClick={() => (saved ? remove(paper.id) : add(paper, rank))}
        >
          {saved ? <BookmarkCheckIcon className="size-4 text-primary" /> : <BookmarkIcon className="size-4" />}
        </Button>
      </div>
      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{paper.authors.join(", ")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <CcfBadge rank={rank} />
        <span>{venue?.abbr || paper.venue || "未知来源"}</span>
        <span>· {paper.publication_year ?? "—"}</span>
        <span>· 引用 {paper.cited_by_count}</span>
        {doi && (
          <a href={doi} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
            DOI
          </a>
        )}
        {oa && (
          <a href={oa} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
            OA
          </a>
        )}
      </div>
    </article>
  );
}