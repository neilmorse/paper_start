# 比赛帖草稿（StudyHack 赛道）

> 用法：标题贴论坛标题栏，正文整体贴 Markdown 编辑器。
> 【截图占位】处需替换为真实 Qoder 过程截图（硬性凭证，见文末清单）。

---

## 标题

PaperStart：CCF 目录原生的文献调研工作台——从开题关键词到开题报告，零登录点开即用

## 正文

### 一、自我介绍

大家好，我是 NeilMorse（GitHub: [neilmorse](https://github.com/neilmorse)），一名高校 CS 学生开发者。这次参加 2026 Qoder 高校创造力大赛 StudyHack 赛道，独立完成了参赛作品 **PaperStart**。项目从第一天起就以 MIT 协议公开在 GitHub：[neilmorse/paper_start](https://github.com/neilmorse/paper_start)，全程用 Qoder 开发与部署。

### 二、这是什么

**公开站（无需登录，点开即用）**：<https://paperstart-8869ucovmdp.qoder.zone>

PaperStart 是一个以 **CCF 推荐目录（2026 年 3 月第七版，681 个期刊/会议）为一等公民**的文献调研工作台，面向中国 CS 学生「开题 / 进入新领域」的场景。核心闭环：

**开题关键词 → CCF 目录内检索（A/B/C 分级 + 10 领域过滤）→ 四阶段阅读路线图 → 引用图谱（1-hop 扩展）→ 中文开题报告草稿 → 收藏管理 → BibTeX/JSON/Markdown 导出**

几个代表性能力：

- **四阶段阅读路线图**：必读奠基作 → 领域权威综述 → 近两年 SOTA → Research Gap，直接回答「先读哪篇」。分层是公开的启发式规则（奠基 = 满 5 年且引用 ≥100；综述 = 类型/标题正则；SOTA = 近 2 年 CCF 优先），不是黑箱，更不是 LLM 幻觉。
- **中文开题报告草稿**：国内外研究现状对比矩阵（第一作者机构国家口径，unknown 单列不摊派）+ 技术路线时间线 + 编号参考文献 + BibTeX 附录，一键导出 .md 直接进开题文档。可选 AI 只补全「研究背景 / Research Gap」两节，且强制 AI 警示；结构化部分零 LLM 依赖。
- **引用图谱**：CCF 分级着色，虚线为 1-hop 引文扩展。演示查询「graph neural network」（CCF-A）可得到 149 节点 / 1452 边。
- **GitHub 相关仓库卡片**：按论文标题模糊匹配，展示 stars/语言/license/最近 push，UI 如实标注「非官方认证」。
- **收藏库零登录**：标签/状态/笔记全存浏览器 localStorage，导出不依赖网络。

### 三、为什么做这个

开题或进入一个新领域时，最大的痛点是「不知道先读哪篇」。现有工具都差一口气：

- SciSpace / Elicit 等 AI 工具收费贵，且对中文开题文档不友好；
- Connected Papers / Litmaps 给的是引用「蜘蛛网」，不是有顺序的阅读路线；
- **所有国际工具都不支持 CCF 目录**——而 CCF 分级恰恰是中国 CS 学生选刊选会、导师认可度的硬约束。

PaperStart 把 CCF 目录做成一等公民：只在目录内检索、按分级过滤、按分级着色图谱、按分级优先排 SOTA。

另一个刻意坚持的点是**数据诚实度**：路线图分层规则公开可核对；矩阵 unknown 单列不摊派；参考文献截断、SOTA 补充检索、GitHub 模糊匹配全部在 UI 如实标注；About 页公开 681 个 venue 的 OpenAlex 解析率（93.7%）、43 个未解析 venue 与 400 条低覆盖警告。诚实标注是卖点，不是遮羞布。

### 四、怎么用（5 步内跑通核心闭环）

1. 点开 <https://paperstart-8869ucovmdp.qoder.zone> → 首屏即检索台 + 3 个示例 chip（默认 CCF-A 预设）；
2. 点示例「graph neural network」→ 直接进入**阅读路线图**：奠基作 / 权威综述 / 近两年 SOTA / Research Gap 四阶段；
3. 切领域、年份或 CCF-B/C → 路线图与列表实时重算，URL 同步可分享；
4. 点「生成开题报告」→ 国内外现状对比矩阵 + 技术路线 + 参考文献，导出 .md；点论文标题可看摘要与 GitHub 相关仓库；
5. 收藏 2 篇 → 进「收藏」页打标签/写笔记 → 刷新仍在 → 导出 BibTeX。

演示深链（可直接点开）：

- 路线图：`https://paperstart-8869ucovmdp.qoder.zone/?q=graph+neural+network&rank=A&view=roadmap`
- 图谱：`https://paperstart-8869ucovmdp.qoder.zone/?q=graph+neural+network&rank=A&view=graph`

【演示 GIF/录屏占位：检索 → 路线图 → 开题报告 → 收藏导出 30 秒闭环】

### 五、Qoder 开发过程

项目全程在 Qoder 中完成规划、编码、测试与部署：

- **规划**：与 Qoder 对话产出完整实施计划（模块拆解 M0–M7、数据管线设计、四轮评审修订与砍线优先级），见仓库 [docs/implementation-plan.md](https://github.com/neilmorse/paper_start/blob/main/docs/implementation-plan.md)。
  【截图占位：Qoder 对话规划/评审修订】
- **数据管线**：CCF 2026 目录 681 venue → OpenAlex source 自建映射（解析率 93.7%），解析与覆盖度报告脚本化、可复现。
- **编码与测试**：React 19 + TypeScript + Vite 8 + Tailwind 4 + shadcn（Qoder Sites react-starter），226 个 Vitest 用例 TDD；每个里程碑独立 commit，历史公开可查。
  【截图占位：模块 commit / 测试通过】
- **部署**：Qoder Sites 托管前端 + 单个 Deno Edge Function（OpenAlex 代理 + 双层缓存 + 限流；额度耗尽自动切演示兜底，路线图离线可渲染）。密钥只存服务端 Secret，前端与仓库零密钥。
  【截图占位：Sites 部署确认 / Portal 录入】
- **主题**：通过 Qoder design-workbench Nudge 变量落地暗色学术主题。
  【截图占位：design-workbench 调整过程】

技术细节与数据来源声明见 [README](https://github.com/neilmorse/paper_start/blob/main/README.md)；欢迎点开公开站体验、提 Issue。

---

## 发帖前检查清单（不随正文发布）

- [ ] `docs/screenshots/` 目前不存在——**硬性凭证缺口**：需补 Qoder 对话规划、模块 commit、部署确认、Portal 录入截图（D1 起的过程截图若未留存，现在补当前会话可截的部分，并如实说明）
- [ ] 演示 GIF/录屏尚未制作（M7 材料）
- [ ] 5 个【截图占位】+ 1 个【GIF 占位】全部替换为真实素材
- [ ] 发帖前用无痕浏览器按「怎么用」5 步实测一遍公开站
- [ ] 核对 About 页解析率数字与正文一致（93.7% / 43 未解析 / 400 低覆盖）