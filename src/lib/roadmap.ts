import type { Paper, Rank } from "./types";

// 四阶段启发式分层（非人工策展）：奠基作→权威综述→近两年 SOTA→Gap（UI 占位接开题报告）。
// 阈值/上限定死保证可测与演示可复现；跨阶段去重优先级 milestone > survey > sota。
export const MILESTONE_CAP = 5;
export const SURVEY_CAP = 4;
export const SOTA_CAP = 8;
// 窗口内 SOTA 候选少于此数时，store 触发一次「近两年+引用降序」补充检索（单批来源才补，额度友好）。
export const SOTA_SUPPLEMENT_MIN = 3;
export const MILESTONE_MIN_CITED = 100;
export const SURVEY_MIN_CITED = 20;
export const MILESTONE_AGE = 5;
export const SOTA_WINDOW = 2;
const SURVEY_RE = /\b(survey|review|overview|tutorial|systematic)\b/i;

export interface Roadmap {
  milestone: Paper[];
  survey: Paper[];
  sota: Paper[];
}

export type RankOf = (sourceId: string) => Rank | undefined;

const rankWeight = (r: Rank | undefined): number => (r === "A" ? 0 : r === "B" ? 1 : r === "C" ? 2 : 3);
const byId = (a: Paper, b: Paper) => a.id.localeCompare(b.id);

function dedupById(papers: Paper[]): Paper[] {
  const seen = new Set<string>();
  const out: Paper[] = [];
  for (const p of papers) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

export function buildRoadmap(core: Paper[], expanded: Paper[], rankOf: RankOf, nowYear: number): Roadmap {
  const pool = dedupById([...core, ...expanded]);

  const milestone = pool
    .filter(
      (p) =>
        p.publication_year != null &&
        p.publication_year <= nowYear - MILESTONE_AGE &&
        p.cited_by_count >= MILESTONE_MIN_CITED,
    )
    .sort((a, b) => b.cited_by_count - a.cited_by_count || a.publication_year! - b.publication_year! || byId(a, b))
    .slice(0, MILESTONE_CAP);
  const taken = new Set(milestone.map((p) => p.id));

  const survey = pool
    .filter(
      (p) =>
        !taken.has(p.id) &&
        p.cited_by_count >= SURVEY_MIN_CITED &&
        (p.type === "review" || SURVEY_RE.test(p.title || p.display_name || "")),
    )
    .sort((a, b) => b.cited_by_count - a.cited_by_count || byId(a, b))
    .slice(0, SURVEY_CAP);
  for (const p of survey) taken.add(p.id);

  const sota = pool
    .filter((p) => !taken.has(p.id) && p.publication_year != null && p.publication_year >= nowYear - SOTA_WINDOW)
    .sort((a, b) => rankWeight(rankOf(a.sourceId)) - rankWeight(rankOf(b.sourceId)) || b.cited_by_count - a.cited_by_count || byId(a, b))
    .slice(0, SOTA_CAP);

  return { milestone, survey, sota };
}