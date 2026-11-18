import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { venueForSource } from "@/src/lib/ccf";
import { buildGraph, filterIsolated, filterLinks } from "@/src/lib/graph";
import type { Paper } from "@/src/lib/types";
import { useSearchStore } from "@/src/store/search";

const radius = (val: number) => Math.max(2, Math.sqrt(val) * 1.5);

export default function GraphView({ onOpen }: { onOpen: (p: Paper) => void }) {
  const results = useSearchStore((s) => s.results);
  const expanded = useSearchStore((s) => s.expanded);
  const index = useSearchStore((s) => s.index);
  const [showIsolated, setShowIsolated] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { nodes, links } = useMemo(
    () => buildGraph(results, expanded, (sid) => (index ? venueForSource(index, sid)?.rank : undefined)),
    [results, expanded, index],
  );
  const visNodes = useMemo(() => filterIsolated(nodes, links, showIsolated), [nodes, links, showIsolated]);
  const visLinks = useMemo(() => filterLinks(links, visNodes), [links, visNodes]);
  const data = useMemo(() => ({ nodes: visNodes, links: visLinks }), [visNodes, visLinks]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={showIsolated} onChange={(e) => setShowIsolated(e.target.checked)} />
          显示孤立节点
        </label>
        <span>
          节点 {visNodes.length} / 边 {visLinks.length}（上限 150；颜色=CCF 分级：A 金红 / B 蓝 / C 绿 / 灰=未分级；虚线=1-hop 扩展；点击节点看详情）
        </span>
      </div>
      <div ref={wrapRef} className="overflow-hidden rounded-lg border border-border">
        <ForceGraph2D
          graphData={data as any}
          width={width}
          height={560}
          backgroundColor="rgba(0,0,0,0)"
          nodeVal={(n: any) => n.val}
          nodeColor={(n: any) => n.color}
          nodeLabel={(n: any) =>
            `${n.paper.title} · ${n.paper.venue ?? "未知来源"} · ${n.paper.publication_year ?? "—"} · 引用 ${n.paper.cited_by_count}`
          }
          nodeCanvasObject={(n: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const r = radius(n.val);
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
            ctx.fillStyle = n.color;
            ctx.fill();
            if (n.expanded) {
              ctx.setLineDash([2 / globalScale, 2 / globalScale]);
              ctx.strokeStyle = n.color;
              ctx.lineWidth = 1 / globalScale;
              ctx.beginPath();
              ctx.arc(n.x, n.y, r + 2 / globalScale, 0, 2 * Math.PI);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }}
          nodePointerAreaPaint={(n: any, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.beginPath();
            ctx.arc(n.x, n.y, radius(n.val) + 2, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          onNodeClick={(n: any) => onOpen(n.paper)}
          linkColor={() => "rgba(130,130,130,0.35)"}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
        />
      </div>
    </div>
  );
}