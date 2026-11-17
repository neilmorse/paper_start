import { matchKey } from "./normalize.mjs";

// 合并别名：去重（按 matchKey）、保序、跳过空值。幂等。
export function mergeAliases(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const raw of list ?? []) {
      const t = String(raw ?? "").trim();
      const k = matchKey(t);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

export function mergeSourceIds(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const id of list ?? []) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

// 歧义：前两名候选分数接近（差<0.1）且都非 low → 需人工裁决，不静默合并。
export function detectAmbiguity(candidates) {
  if (!candidates || candidates.length < 2) return false;
  const [a, b] = candidates;
  return a.confidence !== "low" && b.confidence !== "low" && Math.abs(a.score - b.score) < 0.1;
}

export function needsReview(v) {
  if (v.method === "override") return false; // override 优先，免审
  if (!v.sourceIds || v.sourceIds.length === 0) return true; // unresolved
  if (v.confidence === "medium") return true; // 中置信复核
  return detectAmbiguity(v.candidates); // 歧义
}

export function formatReviewMarkdown(reviewVenues) {
  const lines = [
    "# 人工核对清单（unresolved / 中置信 / 歧义）",
    "",
    `共 ${reviewVenues.length} 条，A 级优先。裁决方式：编辑 data/manual/overrides.json（指定 sourceIds）或 data/manual/aliases.json（补别名），重跑 node scripts/merge-aliases.mjs。裁不完标 unresolved 不阻塞——该 venue 退出 source 过滤，coverage 报告如实展示。`,
    "",
  ];
  const sorted = [...reviewVenues].sort(
    (a, b) => a.rank.localeCompare(b.rank) || a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
  );
  for (const v of sorted) {
    lines.push(`## [${v.rank}] ${v.abbr || v.name}（${v.type} · ${v.domain}）`);
    lines.push(`- 全称：${v.name}`);
    lines.push(`- 状态：${v.method} / confidence=${v.confidence}`);
    if (v.candidates?.length) {
      lines.push("- 候选：");
      for (const c of v.candidates.slice(0, 5)) {
        lines.push(
          `  - ${c.displayName} — ${c.id}（score ${c.score}, ${c.confidence}, works ${c.worksCount}）https://openalex.org/${c.id}`,
        );
      }
    } else {
      lines.push(`- 候选：无（手动检索 https://openalex.org/sources?search=${encodeURIComponent(v.name)}）`);
    }
    lines.push("");
  }
  return lines.join("\n");
}