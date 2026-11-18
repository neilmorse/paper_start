import type { LibraryItem, LibrarySnapshot } from "./types";

// 标题首实词跳过的虚词
const STOP = new Set(["a", "an", "the", "on", "of", "for", "and", "with", "to", "in", "toward", "towards", "via", "using"]);

export function escapeBibtex(s: string): string {
  return s.replace(/[\\&%$#_{}~^]/g, (c) =>
    c === "\\" ? "\\textbackslash{}" : c === "~" ? "\\~{}" : c === "^" ? "\\^{}" : `\\${c}`,
  );
}

export function entryType(s: LibrarySnapshot): "article" | "inproceedings" | "misc" {
  return s.type === "journal" ? "article" : s.type === "conference" ? "inproceedings" : "misc";
}

// key=第一作者姓氏+年份+标题首实词（小写字母数字）
export function baseKey(item: LibraryItem): string {
  const surname = (item.snapshot.authors[0] ?? "").trim().split(/\s+/).pop() ?? "";
  const year = item.snapshot.year != null ? String(item.snapshot.year) : "nd";
  const word = (item.snapshot.title.toLowerCase().match(/[a-z0-9]+/g) ?? []).find((w) => !STOP.has(w)) ?? "untitled";
  return (surname || "anon").toLowerCase().replace(/[^a-z0-9]/g, "") + year + word;
}

export function toBibtex(items: LibraryItem[]): string {
  const used = new Set<string>();
  const entries = items.map((it) => {
    let key = baseKey(it);
    if (used.has(key)) {
      for (let i = 0; ; i++) {
        const cand = key + String.fromCharCode(97 + i);
        if (!used.has(cand)) {
          key = cand;
          break;
        }
      }
    }
    used.add(key);
    const s = it.snapshot;
    const t = entryType(s);
    const lines: string[] = [`  title = {${escapeBibtex(s.title)}}`];
    if (s.authors.length) lines.push(`  author = {${s.authors.map(escapeBibtex).join(" and ")}}`);
    if (s.year != null) lines.push(`  year = {${s.year}}`);
    if (s.venue) {
      const field = t === "article" ? "journal" : t === "inproceedings" ? "booktitle" : "howpublished";
      lines.push(`  ${field} = {${escapeBibtex(s.venue)}}`);
    }
    if (s.biblio?.volume) lines.push(`  volume = {${escapeBibtex(s.biblio.volume)}}`);
    if (s.biblio?.issue) lines.push(`  number = {${escapeBibtex(s.biblio.issue)}}`);
    if (s.biblio?.first_page) {
      const pages = s.biblio.first_page + (s.biblio.last_page ? `--${s.biblio.last_page}` : "");
      lines.push(`  pages = {${escapeBibtex(pages)}}`);
    }
    if (s.doi) lines.push(`  doi = {${escapeBibtex(s.doi.replace(/^https?:\/\/doi\.org\//, ""))}}`);
    if (s.url) lines.push(`  url = {${escapeBibtex(s.url)}}`);
    const note = [s.rank ? `CCF-${s.rank}` : null, s.domain ?? null].filter(Boolean).join(", ");
    if (note) lines.push(`  note = {${escapeBibtex(note)}}`);
    return `@${t}{${key},\n${lines.join(",\n")}\n}`;
  });
  return entries.join("\n\n") + "\n";
}