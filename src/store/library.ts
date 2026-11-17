import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Paper } from "@/src/lib/types";

export interface LibraryItem {
  workId: string;
  savedAt: string;
  snapshot: {
    title: string;
    authors: string[];
    year: number | null;
    venue: string | null;
    sourceId: string;
    rank?: string;
    type: string | null;
    biblio: Paper["biblio"];
    doi: string | null;
    url: string | null;
    citedByCount: number;
  };
  tags: string[];
  status: "unread" | "reading" | "done";
  note: string;
}

interface LibraryState {
  items: LibraryItem[];
  add: (p: Paper, rank?: string) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
}

// M3 骨架：snapshot 冗余含 type/biblio，供 M5 离线导出。M5 扩展 migrate/标签/笔记/导出。
export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (p, rank) => {
        if (get().has(p.id)) return;
        const item: LibraryItem = {
          workId: p.id,
          savedAt: new Date().toISOString(),
          snapshot: {
            title: p.title,
            authors: p.authors,
            year: p.publication_year,
            venue: p.venue,
            sourceId: p.sourceId,
            rank,
            type: p.sourceType ?? p.type,
            biblio: p.biblio,
            doi: p.doi,
            url: p.oaUrl ?? p.url,
            citedByCount: p.cited_by_count,
          },
          tags: [],
          status: "unread",
          note: "",
        };
        set({ items: [...get().items, item] });
      },
      remove: (id) => set({ items: get().items.filter((i) => i.workId !== id) }),
      has: (id) => get().items.some((i) => i.workId === id),
    }),
    { name: "paperstart:library", version: 1 },
  ),
);