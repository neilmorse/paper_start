import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EXAMPLE_QUERIES } from "@/src/lib/types";
import { useSearchStore } from "@/src/store/search";

export function SearchBar() {
  const query = useSearchStore((s) => s.query);
  const status = useSearchStore((s) => s.status);
  const setQuery = useSearchStore((s) => s.setQuery);
  const search = useSearchStore((s) => s.search);

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入关键词，如 graph neural network"
          aria-label="检索关键词"
        />
        <Button type="submit" disabled={status === "loading"}>
          <SearchIcon className="size-4" />
          检索
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">示例：</span>
        {EXAMPLE_QUERIES.map((q) => (
          <Button
            key={q}
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery(q);
              useSearchStore.getState().search();
            }}
          >
            {q}
          </Button>
        ))}
      </div>
    </div>
  );
}