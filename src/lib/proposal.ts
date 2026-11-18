import { toBibtex } from "./bibtex";
import type { LibraryItem, Paper } from "./types";

// 开题报告「元数据为骨」：矩阵/时间线/参考文献全部确定性生成，零 LLM 依赖；
// 研究背景/Research Gap 为插槽（M6-2 由 LLM 填充并强制 AI 警示），无 key 时留占位。
export const REPORT_PAPER_CAP = 40;
export const AI_WARNING = "【AI 生成，仅供参考，请核对原始文献】";

export interface MatrixRow {
  label: "国内" | "国外" | "未知";
  count: number;
  share: number;
  topVenues: string[];
  topPapers: Paper[];
  yearSpan: [number, number] | null;
}
export interface ProposalMatrix {
  rows: MatrixRow[];
  cnCollabCount: number;
  cnCollabShare: number;
  total: number;
}

// 最大余数法保证三行占比整数和恰为 100（unknown 单列不摊派）。
function shares(counts: number[], total: number): number[] {
  if (!total) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const base = raw.map(Math.floor);
  const rem = 100 - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - base[i], i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < rem; k++) base[order[k % order.length][1]] += 1;
  return base;
}

const byCited = (a: Paper, b: Paper) => b.cited_by_count - a.cited_by_count || a.id.localeCompare(b.id);

export function buildMatrix(papers: Paper[]): ProposalMatrix {
  const groups: Record<MatrixRow["label"], Paper[]> = { 国内: [], 国外: [], 未知: [] };
  for (const p of papers) {
    const c = p.firstAuthorCountry;
    groups[c === "CN" ? "国内" : c ? "国外" : "未知"].push(p);
  }
  const counts = [groups.国内.length, groups.国外.length, groups.未知.length];
  const pct = shares(counts, papers.length);
  const rows = (["国内", "国外", "未知"] as const).map((label, i) => {
    const ps = groups[label];
    const years = ps.map((p) => p.publication_year).filter((y): y is number => y != null);
    const venues = new Map<string, number>();
    for (const p of ps) if (p.venue) venues.set(p.venue, (venues.get(p.venue) ?? 0) + 1);
    return {
      label,
      count: ps.length,
      share: pct[i],
      topVenues: [...venues.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([v]) => v),
      topPapers: [...ps].sort(byCited).slice(0, 3),
      yearSpan: years.length ? ([Math.min(...years), Math.max(...years)] as [number, number]) : null,
    };
  });
  const cnCollabCount = papers.filter((p) => (p.countries ?? []).includes("CN")).length;
  return {
    rows,
    cnCollabCount,
    cnCollabShare: papers.length ? Math.round((cnCollabCount / papers.length) * 100) : 0,
    total: papers.length,
  };
}

export interface TimelineEntry {
  year: number;
  papers: Paper[];
}
export function buildTimeline(papers: Paper[], perYear = 3): TimelineEntry[] {
  const byYear = new Map<number, Paper[]>();
  for (const p of papers) {
    if (p.publication_year == null) continue;
    const arr = byYear.get(p.publication_year) ?? [];
    arr.push(p);
    byYear.set(p.publication_year, arr);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, ps]) => ({ year, papers: [...ps].sort(byCited).slice(0, perYear) }));
}

const mdCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

export interface ProposalSlots {
  background?: string | null;
  gap?: string | null;
}

export function assembleProposal(query: string, papers: Paper[], slots: ProposalSlots = {}, now = new Date()): string {
  const sorted = [...papers].sort(byCited);
  const index = new Map(sorted.map((p, i) => [p.id, i + 1]));
  const ref = (p: Paper) => `[${index.get(p.id)}]`;
  const matrix = buildMatrix(sorted);
  const timeline = buildTimeline(sorted);
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const L: string[] = [];
  L.push(`# 开题报告：${mdCell(query)}`);
  L.push("");
  L.push(`> 生成日期 ${date}；文献窗口 ${sorted.length} 篇（CCF 目录内检索 + 参考文献 1-hop 扩展，引用降序取前 ${REPORT_PAPER_CAP} 篇）。`);
  L.push("> 结构化部分（矩阵/时间线/参考文献）由 OpenAlex 元数据确定性生成，可逐条核对；标注 AI 的段落除外。");
  L.push("");
  L.push("## 一、研究背景");
  L.push("");
  L.push(slots.background ? `${AI_WARNING}\n\n${slots.background}` : "（待补充：可由 AI 生成或手动填写。）");
  L.push("");
  L.push("## 二、国内外研究现状对比矩阵");
  L.push("");
  L.push("| 口径 | 数量 | 占比 | 代表 venue | 代表论文（引用降序） | 年份跨度 |");
  L.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of matrix.rows) {
    const reps = r.topPapers.map((p) => `${ref(p)} ${mdCell(p.title)}`).join("；") || "—";
    const span = r.yearSpan ? `${r.yearSpan[0]}–${r.yearSpan[1]}` : "—";
    L.push(`| ${r.label} | ${r.count} | ${r.share}% | ${r.topVenues.map(mdCell).join("、") || "—"} | ${reps} | ${span} |`);
  }
  L.push("");
  L.push(`副口径（CN 合作比例）：${matrix.cnCollabCount}/${matrix.total} = ${matrix.cnCollabShare}%（任一作者机构含 CN）。`);
  L.push("");
  L.push("口径脚注：主口径按第一作者第一机构国家划分；未知单列不摊派；OpenAlex 机构元数据可能滞后或缺失，占比仅供开题参考。");
  L.push("");
  L.push("## 三、技术路线梳理");
  L.push("");
  if (!timeline.length) L.push("（窗口内无带年份文献。）");
  for (const t of timeline) {
    L.push(`### ${t.year}`);
    L.push("");
    for (const p of t.papers) L.push(`- ${ref(p)} ${mdCell(p.title)}（${mdCell(p.venue ?? "未知来源")}，引用 ${p.cited_by_count}）`);
    L.push("");
  }
  L.push("## 四、Research Gap（开放问题）");
  L.push("");
  L.push(slots.gap ? `${AI_WARNING}\n\n${slots.gap}` : "（待补充：可由 AI 基于上述文献摘要生成，或手动填写。）");
  L.push("");
  L.push("## 五、参考文献");
  L.push("");
  sorted.forEach((p, i) => {
    const authors = p.authors.length ? p.authors.join(", ") : "佚名";
    const doi = p.doi ? ` ${p.doi}` : "";
    L.push(`[${i + 1}] ${authors}. ${mdCell(p.title)}. ${mdCell(p.venue ?? "未知来源")}, ${p.publication_year ?? "n.d."}.${doi}`);
  });
  L.push("");
  L.push("### 附：BibTeX");
  L.push("");
  L.push("```bibtex");
  L.push(toBibtex(sorted.map((p) => paperToLibraryItem(p)).slice(0, REPORT_PAPER_CAP)));
  L.push("```");
  L.push("");
  return L.join("\n");
}

export function paperToLibraryItem(p: Paper): LibraryItem {
  return {
    workId: p.id,
    savedAt: new Date().toISOString(),
    snapshot: {
      title: p.title,
      authors: p.authors,
      year: p.publication_year,
      venue: p.venue,
      sourceId: p.sourceId,
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
}