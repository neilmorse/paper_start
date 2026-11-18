import { useState } from "react";
import { XIcon } from "lucide-react";
import { useLibraryStore } from "@/src/store/library";

export function TagEditor({ workId, tags }: { workId: string; tags: string[] }) {
  const addTag = useLibraryStore((s) => s.addTag);
  const removeTag = useLibraryStore((s) => s.removeTag);
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
          {t}
          <button type="button" aria-label={`移除标签 ${t}`} onClick={() => removeTag(workId, t)}>
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        className="w-20 rounded border border-border bg-background px-1.5 py-0.5 text-xs"
        placeholder="+ 标签"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(workId, draft);
            setDraft("");
          }
        }}
        aria-label="添加标签"
      />
    </div>
  );
}