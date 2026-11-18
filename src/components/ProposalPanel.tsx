import { useMemo, useState } from "react";
import { CopyIcon, DownloadIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { REPORT_PAPER_CAP, assembleProposal } from "@/src/lib/proposal";
import { downloadText, exportFilename } from "@/src/lib/storage";
import { useSearchStore } from "@/src/store/search";

export function ProposalPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const results = useSearchStore((s) => s.results);
  const expanded = useSearchStore((s) => s.expanded);
  const sotaExtra = useSearchStore((s) => s.sotaExtra);
  const query = useSearchStore((s) => s.query);
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => {
    const seen = new Set<string>();
    const uniq = [...results, ...expanded, ...sotaExtra].filter((p) => p?.id && !seen.has(p.id) && (seen.add(p.id), true));
    uniq.sort((a, b) => b.cited_by_count - a.cited_by_count || a.id.localeCompare(b.id));
    return assembleProposal(query.trim() || "（未命名检索）", uniq.slice(0, REPORT_PAPER_CAP));
  }, [results, expanded, sotaExtra, query]);

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
        <div className="flex gap-2 px-4">
          <Button size="sm" variant="outline" onClick={() => downloadText(exportFilename("md"), report, "text/markdown")}>
            <DownloadIcon className="size-4" /> 导出 .md
          </Button>
          <Button size="sm" variant="outline" onClick={copy}>
            <CopyIcon className="size-4" /> {copied ? "已复制" : "复制"}
          </Button>
        </div>
        {/* react-markdown 默认转义原始 HTML（不引 rehype-raw），LLM 输出不可信防 XSS；remark-gfm 仅表格/删除线等语法 */}
        <div className="md-report px-4 pb-8 pt-3 text-sm leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </div>
      </SheetContent>
    </Sheet>
  );
}