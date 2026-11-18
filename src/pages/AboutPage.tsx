import { useEffect, useState } from "react";

interface Coverage {
  overall: { total: number; resolved: number; resolutionRate: number; journal: { total: number; resolved: number }; conference: { total: number; resolved: number } };
  byRankType: Array<{ key: string; total: number; resolved: number; rate: number }>;
  byDomain: Array<{ key: string; total: number; resolved: number; rate: number }>;
  coverageWarnings: Array<{ rank: string; abbr: string; name: string; type: string; reasons: string[] }>;
  unresolved: Array<{ rank: string; abbr: string; name: string; type: string; domain: string }>;
  listedInDiff: Array<{ abbr: string; name: string; csvRank: string; listedInRank: string }>;
}

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

export default function AboutPage() {
  const [cov, setCov] = useState<Coverage | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/data/coverage-report.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCov)
      .catch(() => setErr(true));
  }, []);

  return (
    <div className="flex flex-col gap-6 text-sm">
      <section>
        <h2 className="text-lg font-semibold">关于 PaperStart</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          以 CCF 推荐目录（2026 年 3 月第七版，681 个期刊/会议）为一等公民的文献调研工作台：目录内检索、A/B/C 分级与领域过滤、四阶段阅读路线图（奠基作→综述→近两年 SOTA→Research Gap）、引用图谱、开题报告草稿、收藏管理与 BibTeX 导出。文献元数据来自 OpenAlex，经服务端代理与缓存调用。
        </p>
      </section>

      {err && <p className="text-destructive">覆盖率报告加载失败。</p>}
      {cov && (
        <>
          <section>
            <h3 className="font-semibold">解析覆盖率（数据诚实度）</h3>
            <p className="mt-1 text-muted-foreground">
              总 {cov.overall.total} 个 venue，解析 {cov.overall.resolved}（{pct(cov.overall.resolutionRate)}）。期刊 {cov.overall.journal.resolved}/{cov.overall.journal.total}，会议 {cov.overall.conference.resolved}/{cov.overall.conference.total}。
            </p>
            <table className="mt-3 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1">分组</th>
                  <th>解析/总数</th>
                  <th>解析率</th>
                </tr>
              </thead>
              <tbody>
                {cov.byRankType.sort((a, b) => a.key.localeCompare(b.key)).map((g) => (
                  <tr key={g.key} className="border-b border-border/50">
                    <td className="py-1">{g.key}</td>
                    <td>{g.resolved}/{g.total}</td>
                    <td>{pct(g.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="font-semibold">未解析 venue（{cov.unresolved.length}，退出检索过滤，如实展示）</h3>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {cov.unresolved.slice(0, 40).map((u) => (
                <li key={`${u.rank}-${u.name}`}>[{u.rank}] {u.abbr || u.name}（{u.type} · {u.domain}）</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">覆盖警告（{cov.coverageWarnings.length}，OpenAlex 收录偏少等）</h3>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {cov.coverageWarnings.slice(0, 30).map((w) => (
                <li key={`${w.rank}-${w.name}`}>[{w.rank}] {w.abbr || w.name}：{w.reasons.join("；")}</li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section>
        <h3 className="font-semibold">隐私</h3>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          收藏库仅保存在你的浏览器 localStorage，不上传服务器；清理浏览器数据会丢失，请用导出兜底。可选 AI 补全会将选中论文的快照与摘要外发到你配置的第三方 LLM 服务（生成段落强制标注 AI 警示）；不配置则完全不外发。代码仓库检索会将论文标题发送到 GitHub 搜索 API（按标题模糊匹配，非官方认证）。路线图分层与开题报告的矩阵/时间线/参考文献为元数据确定性计算，不外发、可逐条核对。
        </p>
      </section>

      <section>
        <h3 className="font-semibold">数据来源</h3>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          CCF 目录底稿来自 hitfyd/ShowJCR（仓库 GPL-3.0，目录本身为官方公开事实数据）与 ccfddl/ccf-deadlines（MIT）；文献元数据来自 OpenAlex；代码仓库信息来自 GitHub 搜索 API（PapersWithCode 已停运，不使用）。venue→source 映射为本项目自建资产。
        </p>
      </section>
    </div>
  );
}