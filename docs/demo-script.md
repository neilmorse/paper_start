# PaperStart 路演脚本（3 分钟）与评委 5 步

公开站：https://paperstart-8869ucovmdp.qoder.zone （无需登录，点开即用）

## 评委 5 步（无痕浏览器）

1. 点开公开链接 → 首屏即检索台 + 3 个示例 chip（默认 CCF-A 预设）
2. 点示例 chip「graph neural network」→ 默认进入**阅读路线图**：奠基作 5 / 权威综述 4 / 近两年 SOTA 8 / Research Gap
3. 切领域/年份筛选（或 CCF-B/C）→ 路线图与列表实时重算；URL 同步可分享
4. 点任一论文标题 → 详情 Sheet：摘要、CCF 徽章、「查找相关代码仓库」（GitHub 相关仓库，非官方认证标注）；回路线图点「生成开题报告」→ 国内外现状对比矩阵 + 技术路线 + 参考文献，导出 .md
5. 收藏 2 篇 → 进「收藏」页：打标签/改状态/写笔记 → 刷新仍在 → 导出 BibTeX（核对 entry 类型与转义）

深链（可直接投屏）：
- 路线图：`/?q=graph+neural+network&rank=A&view=roadmap`
- 图谱：`/?q=graph+neural+network&rank=A&view=graph`（149 节点 / 1452 边，CCF 分级着色，虚线=1-hop 扩展，点击节点出详情）
- 收藏：`/library`（SPA fallback 刷新 200）

## 3 分钟路演

- **0:00–0:30 痛点**：开题/进新领域时「不知道先读哪篇」。SciSpace/Elicit 贵且对中文开题不友好；Connected Papers 给的是蜘蛛网不是路线。PaperStart 把 CCF 目录当一等公民，直接给阅读顺序。
- **0:30–1:10 路线图**：示例 chip → 四阶段。强调**零幻觉**：分层规则公开（奠基=满 5 年且引用≥100；综述=type/标题正则；SOTA=近 2 年 CCF 优先），候选=结果窗口+参考文献 1-hop 扩展；refs 截断角标、空阶段诚实文案、SOTA 补充检索标注都在 UI 上。
- **1:10–1:50 开题报告**：Gap 阶段 → 生成开题报告。国内外对比矩阵（第一作者机构国家口径，unknown 单列不摊派，占比和=100）+ CN 合作副口径 + 技术路线时间线 + 编号参考文献 + BibTeX 附录；导出 .md 直接进开题文档。AI 只填背景/Gap 两节且强制警示（未配置 Secret 时置灰，结构化部分照常）。
- **1:50–2:20 垂直深度**：详情 Sheet → GitHub 相关仓库（stars/语言/license/最近 push/fork/archived），GNN 演示命中一作官方仓库；诚实标注「非官方认证，按标题模糊匹配」。
- **2:20–2:40 闭环与诚实度**：收藏→标签/状态/笔记→BibTeX/JSON 导出（localStorage 零登录）；About 页公开 681 venue 解析率 93.7%、43 个未解析与 400 条低覆盖警告——数据诚实度是卖点不是遮羞布。
- **2:40–3:00 工程**：Qoder Sites 单 Deno Function 代理+双层缓存+限流；额度数学（CCF-A 单请求≈$0.001，$1/天≈1000 次）；额度耗尽自动切演示兜底（含静态 refs，路线图离线可渲染）；226 个 vitest 用例 TDD。

## 兜底与降级演练（录屏备用）

- 改错 OPENALEX key / 断网 → 横幅「演示数据」+ 示例查询接管，路线图/图谱/报告仍完整（`public/data/demo/*-refs.json`）
- GitHub 限流 → 灰字「GitHub 查询限流」+ 重试按钮，**不**触发 OpenAlex 兜底
- 未配置 LLM → AI 按钮置灰 + tooltip，报告结构化部分完整
- 无痕 + 手机宽度：Tabs 换行、Sheet 全宽、报告表格横向滚动

## 过程凭证（帖子硬性）

`docs/screenshots/`：每个里程碑的 Qoder 对话/commit/部署确认/Portal 录入截图（D1 起随手截，事后补不了）。