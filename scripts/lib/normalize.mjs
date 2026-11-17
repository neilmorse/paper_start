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