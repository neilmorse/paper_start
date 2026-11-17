// M1 Step5 纯函数：ccf-venues 记录组装 + coverage 计算 + 报告渲染。可单测。
import { mergeSourceIds } from "./merge.mjs";

const LOW_WORKS = 2000;

export function buildVenueRecord(v) {
  const issns = [...new Set([v.issnL, ...(v.issn ?? [])].filter(Boolean))];
  return {
    key: v.key,
    abbr: v.abbr ?? "",
    name: v.name,
    type: v.type,
    rank: v.rank,
    domain: v.domain,
    domainSub: v.ccfddlSub ?? null,
    sourceIds: mergeSourceIds(v.sourceIds), // 过滤空值，杜绝脏数据
    issns,
    aliases: v.aliases ?? [],
    dblpKey: v.dblpKey ?? "",
    confidence: v.confidence ?? "low",
    worksCount: v.worksCount ?? null,
    method: v.method,
    note: v.note ?? null,
  };
}

export function coverageWarningReasons(v) {
  const reasons = [];
  if (!v.sourceIds || v.sourceIds.length === 0) reasons.push("unresolved：未解析到 OpenAlex source，退出检索过滤");
  else if (v.worksCount != null && v.worksCount < LOW_WORKS) reasons.push(`OpenAlex 收录偏少（works=${v.worksCount}）`);
  if (v.note) reasons.push(v.note);
  return reasons;
}

const rate = (resolved, total) => (total ? +(resolved / total).toFixed(3) : 0);

export function computeCoverage(venues, listedInDiff = []) {
  const resolved = (v) => v.sourceIds.length > 0;
  const group = (keyFn) => {
    const map = new Map();
    for (const v of venues) {
      const k = keyFn(v);
      if (!map.has(k)) map.set(k, { total: 0, resolved: 0 });
      const g = map.get(k);
      g.total++;
      if (resolved(v)) g.resolved++;
    }
    return [...map.entries()].map(([k, g]) => ({ key: k, ...g, rate: rate(g.resolved, g.total) }));
  };

  const byRankType = group((v) => `${v.rank}-${v.type}`);
  const byDomain = group((v) => v.domain);
  const byRankTypeDomain = group((v) => `${v.rank}|${v.type}|${v.domain}`).map((g) => {
    const [rank, type, domain] = g.key.split("|");
    return { rank, type, domain, total: g.total, resolved: g.resolved, rate: g.rate };
  });

  const warnings = [];
  const unresolved = [];
  for (const v of venues) {
    const reasons = coverageWarningReasons(v);
    if (reasons.length) warnings.push({ key: v.key, abbr: v.abbr, name: v.name, rank: v.rank, type: v.type, domain: v.domain, worksCount: v.worksCount, reasons });
    if (!resolved(v)) unresolved.push({ key: v.key, abbr: v.abbr, name: v.name, rank: v.rank, type: v.type, domain: v.domain });
  }

  const total = venues.length;
  const resolvedCount = venues.filter(resolved).length;
  return {
    overall: {
      total,
      resolved: resolvedCount,
      resolutionRate: rate(resolvedCount, total),
      journal: { total: venues.filter((v) => v.type === "journal").length, resolved: venues.filter((v) => v.type === "journal" && resolved(v)).length },
      conference: { total: venues.filter((v) => v.type === "conference").length, resolved: venues.filter((v) => v.type === "conference" && resolved(v)).length },
    },
    byRankType,
    byDomain,
    byRankTypeDomain,
    coverageWarnings: warnings,
    unresolved,
    listedInDiff,
  };
}

export function renderCoverageMarkdown(cov, domains = []) {
  const pct = (r) => `${(r * 100).toFixed(1)}%`;
  const lines = [
    "# CCF 2026 → OpenAlex 覆盖率报告",
    "",
    `总 venue ${cov.overall.total}，解析 ${cov.overall.resolved}（**${pct(cov.overall.resolutionRate)}**）。期刊 ${cov.overall.journal.resolved}/${cov.overall.journal.total}，会议 ${cov.overall.conference.resolved}/${cov.overall.conference.total}。`,
    "",
    "## 按 rank × type",
    "",
    "| 分组 | 解析/总数 | 解析率 |",
    "|---|---|---|",
    ...cov.byRankType.sort((a, b) => a.key.localeCompare(b.key)).map((g) => `| ${g.key} | ${g.resolved}/${g.total} | ${pct(g.rate)} |`),
    "",
    "## 按领域",
    "",
    "| 领域 | 解析/总数 | 解析率 |",
    "|---|---|---|",
    ...cov.byDomain.map((g) => `| ${g.key} | ${g.resolved}/${g.total} | ${pct(g.rate)} |`),
    "",
    `## 覆盖警告（${cov.coverageWarnings.length}）`,
    "",
    ...cov.coverageWarnings.slice(0, 60).map((w) => `- [${w.rank}] ${w.abbr || w.name}（${w.type}）：${w.reasons.join("；")}`),
    "",
    `## 与 OpenAlex listed_in 的分级差异（${cov.listedInDiff.length}）`,
    "",
    ...cov.listedInDiff.map((d) => `- ${d.abbr || d.name}：CSV ${d.csvRank} vs listed_in ${d.listedInRank}（以自建映射为准）`),
    "",
    `## 未解析 venue（${cov.unresolved.length}，退出检索过滤，如实展示）`,
    "",
    ...cov.unresolved.slice(0, 80).map((u) => `- [${u.rank}] ${u.abbr || u.name}（${u.type} · ${u.domain}）`),
    "",
    "> 数据诚实度声明：解析率与低覆盖如实公开；未解析 venue 不参与 source 过滤。About 页直接渲染 coverage-report.json。",
  ];
  return lines.join("\n");
}