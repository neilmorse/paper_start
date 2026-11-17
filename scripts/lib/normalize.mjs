export function collapseWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

// 归一化匹配键：NFKC → 小写 → 非字母数字折叠为空格。幂等。
export function matchKey(s) {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function dblpKeyFromUrl(url) {
  const m = /\/db\/(?:journals|conf)\/([^/]+)/.exec(url);
  return m ? m[1] : "";
}

// OpenAlex display_name 常无组织/类型前缀，且 search 为 AND 语义：
// 去掉停用词与组织前缀，保留核心内容词，提高会议命中率。
const STOPWORDS = new Set([
  "a", "an", "the", "on", "of", "and", "in", "for", "to", "with", "at", "by", "from", "as", "or",
  "symposium", "conference", "proceedings", "international", "annual", "workshop", "congress", "meeting",
  "usenix", "acm", "ieee", "springer", "elsevier", "association", "assoc", "society",
]);

export function coreSearchTerm(name) {
  return matchKey(name)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .join(" ");
}