import { useSearchStore } from "@/src/store/search";

export function QuotaBanner() {
  const fallback = useSearchStore((s) => s.fallback);
  if (!fallback) return null;
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
      当前展示<strong>演示数据</strong>（实时检索额度耗尽或上游不可用）。示例查询可离线查看；自定义查询请稍后再试。
    </div>
  );
}