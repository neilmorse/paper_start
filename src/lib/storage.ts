import type { LibraryItem } from "./types";

export const LIBRARY_KEY = "paperstart:library";
export const LIBRARY_VERSION = 1;

export const emptyLibrary = (): { items: LibraryItem[] } => ({ items: [] });

const STATUSES = new Set(["unread", "reading", "done"]);

// 损坏/缺字段条目归一化：非法条目丢弃，缺省字段补默认（离线渲染与导出不依赖网络）。
export function normalizeItem(x: any): LibraryItem | null {
  if (!x || typeof x.workId !== "string" || !x.workId) return null;
  const s = x.snapshot ?? {};
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  return {
    workId: x.workId,
    savedAt: typeof x.savedAt === "string" ? x.savedAt : new Date().toISOString(),
    snapshot: {
      title: str(s.title) ?? "",
      authors: Array.isArray(s.authors) ? s.authors.filter((a: unknown) => typeof a === "string") : [],
      year: typeof s.year === "number" ? s.year : null,
      venue: str(s.venue),
      sourceId: str(s.sourceId) ?? "",
      rank: str(s.rank) ?? undefined,
      domain: str(s.domain),
      type: str(s.type),
      biblio: s.biblio ?? null,
      doi: str(s.doi),
      url: str(s.url),
      citedByCount: typeof s.citedByCount === "number" ? s.citedByCount : 0,
      countries: Array.isArray(s.countries) ? s.countries.filter((c: unknown) => typeof c === "string") : [],
    },
    tags: Array.isArray(x.tags) ? x.tags.filter((t: unknown) => typeof t === "string") : [],
    status: STATUSES.has(x.status) ? x.status : "unread",
    note: typeof x.note === "string" ? x.note : "",
  };
}

// 未知/未来版本拒绝回退空库（不造虚拟旧版本）；同版本按 workId 去重归一化。
export function migrateLibrary(state: unknown, version: number): { items: LibraryItem[] } {
  if (version !== LIBRARY_VERSION) return emptyLibrary();
  const items = (state as { items?: unknown })?.items;
  if (!Array.isArray(items)) return emptyLibrary();
  const seen = new Set<string>();
  const out: LibraryItem[] = [];
  for (const it of items) {
    const n = normalizeItem(it);
    if (n && !seen.has(n.workId)) {
      seen.add(n.workId);
      out.push(n);
    }
  }
  return { items: out };
}

export function parseLibrary(raw: string | null): { items: LibraryItem[] } {
  if (!raw) return emptyLibrary();
  try {
    const p = JSON.parse(raw);
    return migrateLibrary(p?.state, p?.version);
  } catch {
    return emptyLibrary();
  }
}

export function exportFilename(ext: string, now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `paperstart-${now.getFullYear()}${m}${d}.${ext}`;
}

export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}