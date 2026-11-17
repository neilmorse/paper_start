# PaperStart

> CCF 目录原生的文献调研工作台 · 2026 Qoder 高校创造力大赛 StudyHack 赛道参赛作品（开发中）

以 **CCF 推荐目录（2026 年 3 月第七版，681 个期刊/会议）** 为一等公民的文献调研工具：只在 CCF 目录内检索、按 A/B/C 分级与 10 个领域过滤、引用图谱按分级着色、收藏管理带分级徽章与 BibTeX/JSON 导出。国际工具（Connected Papers / Litmaps）均不支持 CCF 目录，本项目面向中国 CS 学生开题与进入新领域的调研场景。

**核心闭环**：开题想法/关键词 → CCF 目录内检索 → 引用图谱 → 收藏管理（标签/状态/笔记）→ BibTeX/JSON 导出。可选 AI：中文想法 → 英文检索词扩展、选中论文 → 综述草稿。

## 状态

脚手架阶段（M0）。模块拆解、数据管线与排期见 [docs/implementation-plan.md](docs/implementation-plan.md)。

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
# 可选 AI（M6 起，OpenAI 兼容服务）：
# LLM_BASE_URL=...
# LLM_MODEL=...
# LLM_API_KEY=...
```

无 `OPENALEX_API_KEY` 时 Function 降级为无 key + mailto 模式（每 IP $0.10/天，仅够演示）；无 `LLM_*` 时 AI 入口置灰，核心功能不受影响。密钥只存在于服务端 Secret 与本地 `.env`，前端与仓库不接触任何密钥。

## 数据来源与声明

- **文献元数据**：[OpenAlex](https://openalex.org)（唯一主源，经服务端 Function 代理 + 缓存调用）。
- **CCF 目录底稿**：CCF 推荐国际学术会议和期刊目录 2026 年 3 月第七版（官方公开事实数据）。解析底稿来自 [hitfyd/ShowJCR](https://github.com/hitfyd/ShowJCR)（仓库 GPL-3.0）的 `CCF2026-UTF8.csv`，会议信息补充 [ccfddl/ccf-deadlines](https://github.com/ccfddl/ccf-deadlines)（MIT）。venue → OpenAlex source 映射为本项目自建资产，解析率与低覆盖警告将如实公开（About 页）。
- 模板来源与第三方样式许可见 [PROVENANCE.md](PROVENANCE.md)。

## 隐私

- 收藏库仅保存在你的浏览器 localStorage，不上传服务器；清理浏览器数据会丢失，请用 BibTeX/JSON 导出兜底。
- 可选 AI 功能会将选中论文的快照与摘要外发到你配置的第三方 LLM 服务；不配置则完全不外发。

## License

[MIT](LICENSE)