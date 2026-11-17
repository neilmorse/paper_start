import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Rank } from "@/src/lib/types";

const RANK_CLASS: Record<Rank, string> = {
  A: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  B: "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-400",
  C: "border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-400",
};

export function CcfBadge({ rank, className }: { rank?: Rank | null; className?: string }) {
  if (!rank) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        未分级
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(RANK_CLASS[rank], className)}>
      CCF {rank}
    </Badge>
  );
}