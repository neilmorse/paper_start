import { useMemo } from "react";
import { InfoIcon, Loader2Icon } from "lucide-react";
import { venueForSource } from "@/src/lib/ccf";
import { buildRoadmap } from "@/src/lib/roadmap";
import type { Paper } from "@/src/lib/types";
import { useSearchStore } from "@/src/store/search";
import { PaperCard } from "./PaperCard";

const STAGES = [
  { key: "milestone", no: 1, title: "必读奠基作", rule: "发表满 5 年且引用 ≥100，按引用数降序，最多 5 篇" },
  { key: "survey", no: 2, title: "领域权威综述", rule: "类型 review 或标题含 survey/review/overview 等，引用 ≥20，最多 4 篇" },
  { key: "sota", no: 3, title: "近两年 SOTA 突破", rule: "近 2 年发表，CCF 等级优先、引用数次之，最多 8 篇" },
] as const;

export function RoadmapView({ onOpen }: { onOpen: (p: Paper) => void }) {
  const results = useSearchStore((s) => s.results);
  const expanded = useSearchStore((s) => s.expanded);
  const sotaExtra = useSearchStore((s) => s.sotaExtra);
  const sotaSupplemented = useSearchStore((s) => s.sotaSupplemented);
  const expanding = useSearchStore((s) => s.expanding);
  const expandError = useSearchStore((s) => s.expandError);
  const index = useSearchStore((s) => s.index);
  const fallback = useSearchStore((s) => s.fallback);

  const roadmap = useMemo(
    () =>
      buildRoadmap(
        results,
        [...expanded, ...sotaExtra],
        (sid) => (index ? venueForSource(index, sid)?.rank : undefined),
        new Date().getFullYear(),
      ),
    [results, expanded, sotaExtra, index],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
        <span>
          阅读路线：奠基作 → 权威综述 → 近两年 SOTA → Research Gap。分层基于引用数/年份/文献类型/CCF
          等级的启发式规则（非人工策展），候选来自当前结果窗口及其参考文献 1-hop 扩展。
          {sotaSupplemented && <span> SOTA 阶段含补充检索（近两年、引用降序）。</span>}
          {fallback && <span className="text-amber-600">（演示数据）</span>}
        </span>
      </p>
      {expanding && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" />
          正在扩展引文网络（1-hop 参考文献）…
        </p>
      )}
      {expandError && <p className="text-xs text-amber-600">{expandError}</p>}
      {STAGES.map((s) => {
        const papers = roadmap[s.key];
        return (
          <section key={s.key} className="flex flex-col gap-2">
            <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="flex size-5 shrink-0 items-center justify-center self-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {s.no}
              </span>
              <h3 className="font-medium">{s.title}</h3>
              <span className="text-xs text-muted-foreground">{papers.length} 篇</span>
              <span className="text-xs text-muted-foreground/80" title={s.rule}>
                · {s.rule}
              </span>
            </header>
            {papers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                当前结果窗口内未识别到候选。规则：{s.rule}。
              </p>
            ) : (
              papers.map((p) => <PaperCard key={p.id} paper={p} onOpen={onOpen} />)
            )}
          </section>
        );
      })}
      <section className="flex flex-col gap-2">
        <header className="flex items-baseline gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center self-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            4
          </span>
          <h3 className="font-medium">Research Gap（尚未解决的问题）</h3>
        </header>
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          研究空白分析将结合开题报告生成：基于上述文献的国内外现状对比矩阵与技术路线梳理，归纳开放问题。（开题报告功能即将上线）
        </p>
      </section>
    </div>
  );
}