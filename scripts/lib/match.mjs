import { matchKey } from "./normalize.mjs";

export function sourceIdFromUrl(url) {
  const m = /(S\d+)$/.exec(String(url ?? ""));
  return m ? m[1] : "";
}

export function normalizeSource(raw) {
  return {
    id: sourceIdFromUrl(raw.id),
    displayName: raw.display_name ?? "",
    alternateTitles: raw.alternate_titles ?? [],
    issnL: raw.issn_l ?? "",
    issn: raw.issn ?? [],
    type: raw.type ?? "",
    worksCount: raw.works_count ?? 0,
    citedByCount: raw.cited_by_count ?? 0,
    listedIn: raw.listed_in ?? [],
    relevanceScore: raw.relevance_score ?? null,
  };
}

function tokenSet(key) {
  return new Set(key.split(" ").filter(Boolean));
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// 候选打分：类型一致 + 缩写命中 + 名称相似度 + 包含关系。确定性，可单测。
export function scoreCandidate(venue, source) {
  const vAbbrKey = matchKey(venue.abbr ?? "");
  const vNameKey = venue.nameKey ?? matchKey(venue.name ?? "");
  const sKeys = [matchKey(source.displayName), ...source.alternateTitles.map(matchKey)].filter(Boolean);
  const vNameTokens = tokenSet(vNameKey);
  const typeOk = source.type === venue.type;
  // 缩写须词边界命中（杜绝 "fm" ⊂ "sefm" 这类子串误配）
  const abbrHit =
    vAbbrKey.length >= 2 &&
    sKeys.some((k) =>
      vAbbrKey.includes(" ")
        ? new RegExp(`\\b${vAbbrKey}\\b`).test(k)
        : tokenSet(k).has(vAbbrKey),
    );
  const nameSim = sKeys.length ? Math.max(...sKeys.map((k) => jaccard(vNameTokens, tokenSet(k)))) : 0;
  const containment = vNameKey && sKeys.some((k) => k.includes(vNameKey) || vNameKey.includes(k)) ? 1 : 0;

  const reasons = [];
  let score = 0;
  if (typeOk) {
    score += 0.1;
    reasons.push("type");
  }
  if (abbrHit) {
    score += 0.35;
    reasons.push("abbr");
  }
  score += 0.45 * nameSim;
  if (nameSim > 0) reasons.push(`nameSim=${nameSim.toFixed(2)}`);
  if (containment) {
    score += 0.15;
    reasons.push("containment");
  }
  score = Math.min(1, score);
  const confidence = score >= 0.7 ? "high" : score >= 0.45 ? "medium" : "low";
  return { score, confidence, reasons, nameSim, containment };
}

// 接受判定：仅缩写相同（名称相似度低且无包含关系）不足以接受——
// 防止 CAV→Cavitation、CRYPTO→区块链会议、FAST→海运会议这类误配污染检索。
export function isAcceptable(r) {
  return (r.confidence === "high" || r.confidence === "medium") && (r.nameSim >= 0.35 || r.containment === 1);
}

// 确定性排序：分数↓ → worksCount↓ → id↑（截断/复现可断言）
export function rankCandidates(venue, sources) {
  const scored = sources.map((s) => ({ source: s, ...scoreCandidate(venue, s) }));
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.source.worksCount - a.source.worksCount ||
      a.source.id.localeCompare(b.source.id),
  );
  return scored;
}