import { BookmarkCheckIcon, BookmarkIcon, Code2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeHref } from "@/src/lib/api";
import { venueForSource } from "@/src/lib/ccf";
import type { Paper } from "@/src/lib/types";
import { useGithubStore } from "@/src/store/github";
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
  const gh = useGithubStore((s) => s.byWorkId[paper.id]);
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
          onClick={() => (saved ? remove(paper.id) : add(paper, rank, venue?.domain))}
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
        {paper.refsTruncated && (
          <span
            className="cursor-help text-muted-foreground/70"
            title={`参考文献共 ${paper.refsTotal} 条，截断至前 50 条参与路线图/图谱构建`}
          >
            · refs 50/{paper.refsTotal}
          </span>
        )}
        {gh?.status === "ready" && gh.repos.length > 0 && (
          <span
            className="inline-flex cursor-help items-center gap-0.5 text-emerald-600"
            title="已检索到相关 GitHub 仓库（非官方认证），见详情"
          >
            <Code2Icon className="size-3" /> 有相关仓库
          </span>
        )}
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