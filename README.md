# PaperStart

> CCF 目录原生的文献调研工作台 · 2026 Qoder 高校创造力大赛 StudyHack 赛道参赛作品
> 公开站：https://paperstart-8869ucovmdp.qoder.zone （零登录，点开即用）

以 **CCF 推荐目录（2026 年 3 月第七版，681 个期刊/会议）** 为一等公民的文献调研工具：只在 CCF 目录内检索、按 A/B/C 分级与 10 个领域过滤、**四阶段阅读路线图**（必读奠基作 → 领域权威综述 → 近两年 SOTA → Research Gap）、引用图谱按分级着色、**中文开题报告草稿**（国内外现状对比矩阵 + 技术路线 + 参考文献）、GitHub 相关仓库卡片、收藏管理带分级徽章与 BibTeX/JSON 导出。国际工具（Connected Papers / Litmaps / SciSpace）均不支持 CCF 目录，本项目面向中国 CS 学生开题与进入新领域的调研场景。

**核心闭环**：开题想法/关键词 → CCF 目录内检索 → 阅读路线图（1-hop 引文扩展）→ 开题报告草稿 → 收藏管理（标签/状态/笔记）→ BibTeX/JSON/Markdown 导出。可选 AI：仅补全报告的研究背景与 Research Gap 两节（强制 AI 警示），结构化部分零 LLM 依赖。

**数据诚实度**：路线图分层为公开启发式规则（非人工策展）；矩阵 unknown 单列不摊派；refs 截断、SOTA 补充检索、GitHub 模糊匹配均在 UI 如实标注；About 页公开 venue 解析率与低覆盖警告。

## 状态

M0–M6 完成并已发布（脚手架 / CCF 数据管线 / Function 代理 / 检索 UI / 路线图+图谱 / 收藏导出 / GitHub 卡片 / 开题报告+可选 AI）。模块拆解、数据管线、排期与修订记录见 [docs/implementation-plan.md](docs/implementation-plan.md)；路演与评委 5 步见 [docs/demo-script.md](docs/demo-script.md)。

## 技术栈

- 前端：React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + shadcn（Qoder Sites react-starter）
- 服务端：Qoder Sites 单个 Deno Edge Function（`functions/`，OpenAlex 代理 + 缓存 + LLM 转发）
- 收藏：浏览器 localStorage，零登录；snapshot 冗余存储，导出不依赖网络
- 测试：Vitest（node 环境）

## 开发

Node 要求 `^22.13.0 || >=24.0.0`；Function 本地运行需 [Deno](https://deno.com) 2.x。

```sh
npm ci                   # 安装依赖（模板自带 lockfile）
npm run dev              # 前端开发服务器（127.0.0.1:5173）
npm test                 # Vitest 单测
npm run build            # 类型检查 + 静态构建 → dist/
npm run preview          # 本地预览构建产物
npm run check:function   # Deno 类型检查 Function（build 的 tsc 不查 functions/）
npm run dev:function     # 本地 Function 服务（127.0.0.1:8000，Vite 已配同源代理）
```

## 本地环境变量（.env）

复制 `.env.example` 为 `.env`（已被 gitignore，不会提交）：

```sh
OPENALEX_API_KEY=...   # 生产检索必填：https://openalex.org/settings/api 免费申请，$1/天额度
# 可选 AI（OpenAI 兼容服务，仅补全报告背景/Gap 两节）：
# LLM_BASE_URL=...
# LLM_MODEL=...
# LLM_API_KEY=...
# 可选 GitHub 提额（未认证共享出口 60req/hr → 认证 5000req/hr）：
# GITHUB_TOKEN=...     # fine-grained，只读 public repo 权限
```

无 `OPENALEX_API_KEY` 时 Function 降级为无 key + mailto 模式（每 IP $0.10/天，仅够演示）；无 `LLM_*` 时 AI 入口置灰，核心功能不受影响；无 `GITHUB_TOKEN` 时 GitHub 查询走未认证额度 + 24h 缓存 + 限流 cooldown。密钥只存在于服务端 Secret 与本地 `.env`，前端与仓库不接触任何密钥。

## 数据来源与声明

- **文献元数据**：[OpenAlex](https://openalex.org)（唯一主源，经服务端 Function 代理 + 缓存调用）。
- **代码仓库信息**：GitHub 搜索 API（按论文标题模糊匹配，UI 标注「非官方认证」；PapersWithCode 已停运，不使用）。
- **CCF 目录底稿**：CCF 推荐国际学术会议和期刊目录 2026 年 3 月第七版（官方公开事实数据）。解析底稿来自 [hitfyd/ShowJCR](https://github.com/hitfyd/ShowJCR)（仓库 GPL-3.0）的 `CCF2026-UTF8.csv`，会议信息补充 [ccfddl/ccf-deadlines](https://github.com/ccfddl/ccf-deadlines)（MIT）。venue → OpenAlex source 映射为本项目自建资产，解析率与低覆盖警告将如实公开（About 页）。
- 模板来源与第三方样式许可见 [PROVENANCE.md](PROVENANCE.md)。

## 隐私

- 收藏库仅保存在你的浏览器 localStorage，不上传服务器；清理浏览器数据会丢失，请用 BibTeX/JSON 导出兜底。
- 可选 AI 补全会将选中论文的快照与摘要外发到你配置的第三方 LLM 服务（生成段落强制 AI 警示）；不配置则完全不外发。
- 代码仓库检索会将论文标题发送到 GitHub 搜索 API。路线图分层与开题报告的矩阵/时间线/参考文献为元数据确定性计算，不外发、可逐条核对。

## License

[MIT](LICENSE)