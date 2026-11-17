import { collapseWhitespace, dblpKeyFromUrl, matchKey } from "./normalize.mjs";

// CCF 2026 年 3 月第七版硬计数：不符即报错退出，防上游悄悄改版。
export const EXPECTED_COUNTS = {
  total: 681,
  journal: { total: 295, A: 37, B: 113, C: 145 },
  conference: { total: 386, A: 58, B: 132, C: 196 },
};

const TYPE_BY_LABEL = {
  推荐国际学术刊物: "journal",
  推荐国际学术会议: "conference",
};

export function rowToVenue(row) {
  if (row.length !== 8) {
    throw new Error(`CSV 行列数应为 8，实际 ${row.length}：${row.join("|")}`);
  }
  const [abbrRaw, nameRaw, yearRaw, publisherRaw, urlRaw, domainRaw, typeRaw, rankRaw] = row;
  const type = TYPE_BY_LABEL[collapseWhitespace(typeRaw)];
  if (!type) throw new Error(`未知 CCF 推荐类别：${typeRaw}`);
  const rankMatch = /^([ABC])类$/.exec(collapseWhitespace(rankRaw));
  if (!rankMatch) throw new Error(`未知 CCF 推荐类型：${rankRaw}`);
  const year = Number(collapseWhitespace(yearRaw));
  if (!Number.isInteger(year)) throw new Error(`非法年份：${yearRaw}`);
  const abbr = collapseWhitespace(abbrRaw);
  const name = collapseWhitespace(nameRaw) || abbr;
  if (!name) throw new Error(`刊物名称与缩写均为空：${row.join("|")}`);
  const url = collapseWhitespace(urlRaw);
  return {
    abbr,
    name,
    year,
    publisher: collapseWhitespace(publisherRaw),
    url,
    domain: collapseWhitespace(domainRaw),
    type,
    rank: rankMatch[1],
    dblpKey: dblpKeyFromUrl(url),
    matchKey: matchKey(abbr || name),
    nameKey: matchKey(name),
  };
}

export function tally(venues) {
  const t = {
    total: venues.length,
    journal: { total: 0, A: 0, B: 0, C: 0 },
    conference: { total: 0, A: 0, B: 0, C: 0 },
  };
  for (const v of venues) {
    const g = t[v.type];
    if (!g) throw new Error(`未知 venue 类型：${v.type}`);
    g.total++;
    g[v.rank]++;
  }
  return t;
}

export function assertExpectedCounts(actual) {
  const diffs = [];
  if (actual.total !== EXPECTED_COUNTS.total) {
    diffs.push(`total 期望 ${EXPECTED_COUNTS.total} 实际 ${actual.total}`);
  }
  for (const type of ["journal", "conference"]) {
    for (const key of ["total", "A", "B", "C"]) {
      const e = EXPECTED_COUNTS[type][key];
      const a = actual[type]?.[key];
      if (a !== e) diffs.push(`${type}.${key} 期望 ${e} 实际 ${a}`);
    }
  }
  if (diffs.length) {
    throw new Error(`CCF 目录计数校验失败（上游可能改版）：\n  ${diffs.join("\n  ")}`);
  }
}