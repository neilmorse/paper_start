import { useEffect, useMemo, useState } from "react";
import { CopyIcon, DownloadIcon, SparklesIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiGet, apiPost, restoreAbstract } from "@/src/lib/api";
import { REPORT_PAPER_CAP, assembleProposal } from "@/src/lib/proposal";
import { downloadText, exportFilename } from "@/src/lib/storage";
import type { Paper } from "@/src/lib/types";
import { useSearchStore } from "@/src/store/search";

const AI_ERR: Record<string, string> = {
  ai_timeout: "AI 响应超时，请重试（结构化部分不受影响）。",
  ai_unreachable: "AI 服务连接失败（网络/TLS 抖动），请重试。",
  ai_upstream_error: "AI 服务暂时不可用，请重试。",
  ai_bad_response: "AI 返回格式异常，请重试。",
  service_not_configured: "未配置 LLM Secret，AI 补全不可用。",
  network_error: "网络连接失败，请重试。",
};
const workId = (id: string) => /(W\d+)$/.exec(id)?.[1] ?? id;

export function ProposalPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const results = useSearchStore((s) => s.results);
  const expanded = useSearchStore((s) => s.expanded);
  const sotaExtra = useSearchStore((s) => s.sotaExtra);
  const query = useSearchStore((s) => s.query);
  const [copied, setCopied] = useState(false);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const [aiSlots, setAiSlots] = useState<{ background: string; gap: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    apiGet<{ llmConfigured?: boolean }>("/health")
      .then((b) => alive && setLlmReady(Boolean(b.llmConfigured)))
      .catch(() => alive && setLlmReady(false));
    return () => {
      alive = false;
    };
  }, [open]);

  const pool = useMemo(() => {
    const seen = new Set<string>();
    const uniq = [...results, ...expanded, ...sotaExtra].filter((p) => p?.id && !seen.has(p.id) && (seen.add(p.id), true));
    uniq.sort((a, b) => b.cited_by_count - a.cited_by_count || a.id.localeCompare(b.id));
    return uniq;
  }, [results, expanded, sotaExtra]);

  const report = useMemo(
    () => assembleProposal(query.trim() || "（未命名检索）", pool.slice(0, REPORT_PAPER_CAP), aiSlots ?? {}),
    [pool, query, aiSlots],
  );

  const runAi = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const top = pool.slice(0, 8);
      const withAbstract = await Promise.all(
        top.map(async (p) => {
          let abstract = restoreAbstract(p.abstract_inverted_index);
          if (!abstract) {
            try {
              const b = await apiGet<{ work: Paper }>("/work", { id: workId(p.id) });
              abstract = restoreAbstract(b.work?.abstract_inverted_index);
            } catch {
              abstract = "";
            }
          }
          return { title: p.title, venue: p.venue, year: p.publication_year, cited: p.cited_by_count, abstract };
        }),
      );
      const b = await apiPost<{ background: string; gap: string }>("/ai/proposal", {
        query: query.trim() || "（未命名检索）",
        papers: withAbstract,
      });
      setAiSlots({ background: b.background, gap: b.gap });
    } catch (e) {
      const code = (e as { code?: string })?.code ?? (e instanceof TypeError ? "network_error" : "ai_upstream_error");
      setAiError(AI_ERR[code] ?? "AI 补全失败，请重试。");
    } finally {
      setAiLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用（非安全上下文）时忽略，导出 .md 仍可用
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>开题报告（结构化草稿）</SheetTitle>
          <SheetDescription>
            矩阵/时间线/参考文献由 OpenAlex 元数据确定性生成；研究背景与 Research Gap 待 AI 或手动补充。
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap gap-2 px-4">
          <Button size="sm" variant="outline" onClick={() => downloadText(exportFilename("md"), report, "text/markdown")}>
            <DownloadIcon className="size-4" /> 导出 .md
          </Button>
          <Button size="sm" variant="outline" onClick={copy}>
            <CopyIcon className="size-4" /> {copied ? "已复制" : "复制"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={llmReady === false || aiLoading || llmReady === null}
            title={llmReady === false ? "未配置 LLM Secret（见关于页隐私声明）" : "将论文快照与摘要外发第三方 LLM"}
            onClick={runAi}
          >
            <SparklesIcon className="size-4" /> {aiLoading ? "AI 生成中…" : aiSlots ? "重新生成 AI 段落" : "AI 补全背景与 Gap"}
          </Button>
        </div>
        <p className="px-4 pt-1 text-xs text-muted-foreground">
          AI 补全会将论文快照与摘要外发第三方 LLM；生成段落强制标注 AI 警示，结构化部分不受影响。
        </p>
        {aiError && <p className="px-4 pt-1 text-xs text-amber-600">{aiError}</p>}
        {/* react-markdown 默认转义原始 HTML（不引 rehype-raw），LLM 输出不可信防 XSS；remark-gfm 仅表格/删除线等语法 */}
        <div className="md-report px-4 pb-8 pt-3 text-sm leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </div>
      </SheetContent>
    </Sheet>
  );
}