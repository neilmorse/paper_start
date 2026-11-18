import { toast } from "sonner";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { LIBRARY_KEY, LIBRARY_VERSION, migrateLibrary } from "@/src/lib/storage";
import type { LibraryItem, Paper } from "@/src/lib/types";

interface LibraryState {
  items: LibraryItem[];
  add: (p: Paper, rank?: string, domain?: string | null) => void;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  has: (id: string) => boolean;
  setStatus: (id: string, status: LibraryItem["status"]) => void;
  setStatusMany: (ids: string[], status: LibraryItem["status"]) => void;
  setNote: (id: string, note: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
}

// 写入配额超限不炸 store：toast 引导导出备份（收藏仅存本浏览器，导出是兜底）。
const quotaSafeStorage = {
  getItem: (k: string) => localStorage.getItem(k),
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      toast.error("收藏存储空间不足：请导出备份后删除部分收藏。");
    }
  },
  removeItem: (k: string) => localStorage.removeItem(k),
};

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (p, rank, domain) => {
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
            domain: domain ?? null,
            type: p.sourceType ?? p.type,
            biblio: p.biblio,
            doi: p.doi,
            url: p.oaUrl ?? p.url,
            citedByCount: p.cited_by_count,
            countries: p.countries ?? [],
          },
          tags: [],
          status: "unread",
          note: "",
        };
        set({ items: [...get().items, item] });
      },
      remove: (id) => set({ items: get().items.filter((i) => i.workId !== id) }),
      removeMany: (ids) => {
        const s = new Set(ids);
        set({ items: get().items.filter((i) => !s.has(i.workId)) });
      },
      has: (id) => get().items.some((i) => i.workId === id),
      setStatus: (id, status) => set({ items: get().items.map((i) => (i.workId === id ? { ...i, status } : i)) }),
      setStatusMany: (ids, status) => {
        const s = new Set(ids);
        set({ items: get().items.map((i) => (s.has(i.workId) ? { ...i, status } : i)) });
      },
      setNote: (id, note) => set({ items: get().items.map((i) => (i.workId === id ? { ...i, note } : i)) }),
      addTag: (id, tag) => {
        const t = tag.trim();
        if (!t) return;
        set({ items: get().items.map((i) => (i.workId === id && !i.tags.includes(t) ? { ...i, tags: [...i.tags, t] } : i)) });
      },
      removeTag: (id, tag) =>
        set({ items: get().items.map((i) => (i.workId === id ? { ...i, tags: i.tags.filter((x) => x !== tag) } : i)) }),
    }),
    {
      name: LIBRARY_KEY,
      version: LIBRARY_VERSION,
      storage: createJSONStorage(() => quotaSafeStorage),
      migrate: (state, version) => migrateLibrary(state, version),
      // 同版本 rehydrate 也归一化（旧 snapshot 可能缺 countries/domain 等新字段）
      merge: (persisted, current) => ({ ...current, ...migrateLibrary(persisted, LIBRARY_VERSION) }),
    },
  ),
);