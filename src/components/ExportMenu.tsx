import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toBibtex } from "@/src/lib/bibtex";
import { downloadText, exportFilename } from "@/src/lib/storage";
import { useLibraryStore } from "@/src/store/library";

export function ExportMenu() {
  const items = useLibraryStore((s) => s.items);
  const disabled = items.length === 0;
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => downloadText(exportFilename("bib"), toBibtex(items), "application/x-bibtex")}
      >
        <DownloadIcon className="size-4" /> BibTeX
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => downloadText(exportFilename("json"), JSON.stringify({ schemaVersion: 1, items }, null, 2), "application/json")}
      >
        <DownloadIcon className="size-4" /> JSON
      </Button>
    </div>
  );
}