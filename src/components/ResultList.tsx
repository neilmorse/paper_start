import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Paper } from "@/src/lib/types";
import { useSearchStore, type ResultView } from "@/src/store/search";
import { PaperCard } from "./PaperCard";
import { RoadmapView } from "./RoadmapView";

const GraphView = lazy(() => import("./GraphView"));

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

export function ResultList({ onOpen }: { onOpen: (p: Paper) => void }) {
  const status = useSearchStore((s) => s.status);
  const results = useSearchStore((s) => s.results);
  const error = useSearchStore((s) => s.error);
  const windowCount = useSearchStore((s) => s.windowCount);
  const view = useSearchStore((s) => s.view);
  const setView = useSearchStore((s) => s.setView);

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }
  if (status === "error") {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  }
  if (status === "idle") {
    return <EmptyState text="输入关键词或点击示例开始检索。默认仅在 CCF-A 顶会顶刊内检索，结果按阅读路线图组织。" />;
  }
  if (results.length === 0) {
    return <EmptyState text="窗口内无结果。试试放宽筛选（更多分级/领域）或更换关键词。" />;
  }
  return (
    <Tabs value={view} onValueChange={(v) => setView(v as ResultView)} className="gap-3">
      <TabsList>
        <TabsTrigger value="roadmap">阅读路线图</TabsTrigger>
        <TabsTrigger value="list">列表（{windowCount}）</TabsTrigger>
        <TabsTrigger value="graph">图谱</TabsTrigger>
      </TabsList>
      <TabsContent value="roadmap">
        <RoadmapView onOpen={onOpen} />
      </TabsContent>
      <TabsContent value="list">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">窗口内 {windowCount} 条（每批取前 50，按引用数降序；不做深度翻页）</p>
          {results.map((p) => (
            <PaperCard key={p.id} paper={p} onOpen={onOpen} />
          ))}
        </div>
      </TabsContent>
      <TabsContent value="graph">
        <Suspense fallback={<Skeleton className="h-[560px] rounded-lg" />}>
          <GraphView onOpen={onOpen} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}