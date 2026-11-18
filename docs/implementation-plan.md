# paper_start：CCF 目录原生文献调研工作台

> 本计划移植自国际版 Qoder 会话产出（原文件 `/home/neil/.qoder/plans/graceful-pebble-swallow.md`），已合并 2026-11-17 二审（A–G）与三审（H–Q，Qoder CN 本机实测复核）全部修订，见文末修订记录。

## Context

参加 **2026 Qoder 高校创造力大赛 StudyHack 赛道**（截止 2026-11-30 18:00，今天 11-17，13 天）。痛点：开题/进入新领域时文献调研工具零散（搜索、图谱、管理各管一段）。产品差异化：**以 CCF 推荐目录（2026 年 3 月第七版，681 venue）为一等公民**——只在 CCF 目录内检索、按 A/B/C 分级与 10 领域过滤、引用图谱按分级着色、收藏管理带分级徽章与 BibTeX 导出。国际工具（Connected Papers/Litmaps）均不支持 CCF，这是中国 CS 学生刚需。

核心闭环：**开题想法/关键词 → CCF 目录内检索 → 引用图谱 → 收藏管理（标签/状态/笔记）→ BibTeX/JSON 导出**。可选 AI：中文想法→英文检索词扩展、选中论文→综述草稿。

已定决策：
- 架构：Qoder Sites 官方 react-starter（React 19+TS+Vite 8+Tailwind 4+shadcn）SPA + **1 个 Deno Edge Function**（OpenAlex 代理+缓存+LLM 转发）+ 自建 CCF 映射 JSON 资产
- 数据源：**OpenAlex 唯一主源**（DBLP 在线 API 被反爬弃用，S2 不稳定弃用）；BibTeX 用元数据自拼（doi.org 协商对 IEEE 404）
- 收藏管理：**localStorage + 导出兜底，零登录**（不用 Sites 数据库）
- AI：通用 OpenAI 兼容客户端，`LLM_BASE_URL/LLM_MODEL/LLM_API_KEY` 三 Secret 可配置，无 key 优雅降级，整体可砍
- 工程偏好：**TDD 增量，每模块完成即 commit+push 再继续**；项目同时是申请 Codex for Open Source 的公开 OSS 仓库（MIT，第一天公开）
- 评审约束：评委点开公开链接 **5 步内用起来**；开发与部署均用 Qoder 并**留存过程截图**（帖子硬性凭证）

## 已验证的关键事实

- CCF 第七版 681 venue：期刊 295（A37/B113/C145）+ 会议 386（A58/B132/C196）。底稿：`hitfyd/ShowJCR` 的 `中科院分区表及JCR原始数据文件/CCF2026-UTF8.csv`（字段含缩写/全称/DBLP URL/领域/类型/等级）；会议补充 `ccfddl/ccf-deadlines`（MIT，yml 含 rank.ccf/dblp/sub）。三审经 GitHub API 证实：CSV 路径存在、ShowJCR GPL-3.0、ccf-deadlines MIT
- OpenAlex：期刊原生带 `listed_in:ccf-a/b/c` 标签（与第七版几乎对齐，B 差 2，**以自建映射为准**）；会议无标签需自建映射。`works?search=` 返回完整 `referenced_works`/`cited_by_count`/`primary_location.source`；source ID 多值 OR 过滤**上限 100**；批量取文 `filter=ids.openalex:W..|W..` 可行；`sources?filter=listed_in:ccf-a` 可批量拉期刊（含 id/aliases/issn）
- OpenAlex 计费：无 key 每 IP $0.10/天（≈100 次搜索），**免费 key $1/天**（search $0.001/次、filter $0.0001/次、**单条 ID/DOI 查询免费**），用户需去 openalex.org/settings/api 申请；生产必须走 Function 代理+缓存。**二审修正：一次全目录检索 ≈8 个 search 类请求 ≈$0.008，$1/天 ≈120 次全目录检索；默认 CCF-A 预设单请求 ≈$0.001 → ≈1000 次/天**；三审获多独立来源佐证（X-RateLimit-* 用量头、>100rps 返回 429）；D1 仍复核响应头
- 已知 source 锚点：TPAMI=S199944782、ICML=S4306419644、NeurIPS=S4363606243（仅 2.16 万条，**会议覆盖不全是最大数据坑**：一会多 source、改名期刊分裂，需别名+issn_l 归并）
- 平台：仅静态托管 + 1 个名为 app 的 Deno Function（`functions/index.ts` 一行 `Deno.serve(handler)`，handler 纯函数可 vitest 直测）；前端同源调 `/functions/v1/app/<子路径>`；**网关会替换路径中的函数名段，路由按子路径尾部匹配**；**平台无出站域名配置参数（三审核实 prepare_site/ensure_backend 均无），出站目标在代码内固定，可达性需部署实测（D4 探针）**；Secret 经 `prepare_site.secretNames`（只声明代码实际依赖的名字）+ Portal 录入 + `Deno.env.get`；**新站默认私有，公开需 `update_access_policy(confirmPublic:true)`**；SPA fallback 支持；避开保留路径 `/api /internal /__qoder_auth /__qoder_internal /functions /storage /rest/v1 /supabase`
- 模板（三审已在 CN 本机实读核实）：`vite.config.ts` 已内置 `/functions/v1/app → 127.0.0.1:8000` 代理（dev+preview）；别名 `@` 指向项目根；shadcn 在顶层 `components/ui/`；自带 package-lock.json（`npm ci` 可行）；**check-node.mjs 要求 22.13+（22.x）或 24+，本机 24.22.1 直接可用，无需装 Node**；`create-site.mjs` 拒绝非空目录（仅容 `.git/.DS_Store`）、不自动 git init；**`dev:function` 原脚本仅 `--allow-net=127.0.0.1:8000`，无 --allow-env/出站权限，M2 前必须改造**；gitignore.template 需手动改名 .gitignore；tsconfig 排除 functions/dev（build 的 tsc 不查 Function，用 `check:function`=deno check 补）
- 本机：gh 已登录（neilmorse）、deno 2.9.8 已装（支持 --env-file）、Node 24.22.1（nvm.fish 管理；fish 环境，Bash 工具需 `fish -ic` 执行 node/npm 命令）

模板与文档根路径（三审已在 CN 本机定位并实读，下称 `<skill>`；开工时仍先加载 sites:sites-building skill 复核契约）：
`/usr/lib/qoder-cn/extensions/qoder.sites/dist/plugin/skills/sites-building/`（sites-hosting 同级；与国际版 CLI 缓存版本不同：vite 8.0.16、Node 24 支持、schemaRef 取代 requiredSchemaVersion）

## 模块拆解（每模块：vitest 绿 + build 过 + 冒烟 → commit+push → 下一模块；M2 起加 `npm run check:function`，因 tsconfig 排除 functions/，build 不查 Deno 代码）

### 立即执行：计划落盘到项目 docs/
- 将本计划全文写入 `/home/neil/Projects/paper_start/docs/implementation-plan.md`（用户要求，先于一切开发动作）
- M0 注意：create-site.mjs 拒绝非空目录——届时把 docs/ 临时移出项目 → 跑脚手架 → 移回 docs/，随首个 commit 提交

### M0 脚手架 + 公开仓库（D1 上午）
1. Node 24.22.1 直接可用（CN 模板校验 22.13+ 或 24+，**无需装 Node**）；仓库已 git init；docs/ 临时移出（见上「立即执行」）→ `node <skill>/scripts/create-site.mjs /home/neil/Projects/paper_start` → 移回 docs/ → `npm ci`（模板自带 lockfile）→ `npm run dev` 冒烟
2. devDeps 加 `vitest`（node 环境，不引 jsdom）；deps 加 `zustand`、`react-router-dom`（react-force-graph-2d 留到 M4）；`vitest.config.ts` include `tests/**/*.test.ts`；package.json 加 `"test": "vitest run"`
3. `LICENSE`(MIT)、`README.md`（定位+数据来源声明+开发命令+本地 .env 说明）、模板 `gitignore.template` **手动改名 `.gitignore`** 再追加 `data/cache/`、`.env*`
4. `gh repo create paper_start --public --source . --push`
5. 哨兵测试 `tests/smoke.test.ts`（测模板 `lib/utils.ts` 的 cn()）确认链路
6. **`open_design_workbench` 注册 `.qoder.site`**（CN 硬性契约：每个新站必须；design.pages=检索/收藏/关于 + Nudge 变量 appearance/radius/spacing/typography；工具生成禁手写，M7 主题精修须消费这些变量）
- commit: `chore: scaffold from qoder react-starter with vitest`

### M1 CCF 数据资产管线（D1 下午–D3，核心）
交付：`public/data/ccf-venues.json` + `public/data/coverage-report.json` + 人工核对清单 + 可重跑脚本。网络响应全部落盘 `data/cache/`（gitignore），重跑不烧额度。

- **Step1 取底稿** `scripts/fetch-raw.mjs`：下载 ShowJCR CSV → `data/raw/`；抽 ccf-deadlines yml 的 rank.ccf/dblp/sub → `data/raw/ccfddl.json`；`docs/data-sources.md` 注明来源/抓取日期/许可证情况（ShowJCR 仓库 GPL-3.0，CCF 目录本身是官方公开事实数据；ccf-deadlines MIT）
- **Step2 解析** `scripts/parse-csv.mjs` + `scripts/lib/{csv,normalize}.mjs`：手写 CSV 解析（BOM/引号内逗号换行）；归一化 matchKey；**硬校验计数 681/295/386 与 A/B/C 分布，不符即报错退出**（防上游悄悄改版）
- **Step3 sources 解析** `scripts/resolve-sources.mjs`：
  - **期刊侧捷径**：`sources?filter=listed_in:ccf-a/b/c` 批量拉全部 CCF 期刊（约 5 次 filter 请求，per-page≤100 分页），按 issn_l/归一化名与 CSV 匹配；匹配不上的回落逐个 search
  - **会议侧**：逐个 `sources?search=<缩写>`，**全称 search 仅作低置信回落**，候选打分（名称相似度+type+ISSN 线索），记 confidence 与全部候选；限速 ≤5rps、重试 2 次、缓存落盘、请求加 mailto；**额度跨 D2–D3 两天规划**（386 会议 ×≤2 次 search ≈$0.77 逼近 $1/天；D2 期刊+会议 A/B，D3 上午 C 级收尾，裁不完标 unresolved 不阻塞）
  - 锚点写死 `data/manual/overrides.json`（TPAMI/ICML/NeurIPS）
- **Step4 归并+人工核对** `scripts/merge-aliases.mjs` + `scripts/lib/merge.mjs`：issn_l 归并改名期刊（一 venue→`sourceIds[]`）；合并 ccfddl 别名与 `data/manual/aliases.json`；low confidence/歧义生成 `data/review/unresolved.md`（候选+works 数+链接），**人工裁决半天封顶（预计 30–80 条，A 级优先）**，裁不完标 unresolved 不阻塞（该 venue 退出 source 过滤，报告如实展示）
- **Step5 产出** `scripts/build-venues.mjs`：`ccf-venues.json` schema：`{version:"ccf-2026-03", generatedAt, attribution, domains[10], venues[{key,abbr,name,type,rank,domain,sourceIds[],issns[],aliases[],dblpKey,confidence,worksCount}]}`；`coverage-report.json` 按 rank×type×domain 解析率 + 低覆盖 venue 标 `coverageWarning`（如 NeurIPS）+ 与 listed_in 的 diff；`docs/coverage-report.md` 人类可读版（**About 页用 React 直接渲染 coverage-report.json**，不依赖 M6 才引入且可砍的 react-markdown；数据诚实度加分）
- 测试：`tests/ccf-{csv,merge,build}.test.ts` + `tests/fixtures/`（计数校验、BOM/引号、归一化幂等、issn 归并、override 优先、歧义不静默合并、无空 sourceIds 脏数据）
- commit: `feat(data): CCF 2026 venue→OpenAlex source mapping pipeline + coverage report`

### M2 Function 代理（D4）
文件：`functions/{index.ts(保持一行),handler.ts,openalex.ts,cache.ts,llm.ts(桩)}`

| 端点（`/functions/v1/app/` 下） | 说明 |
|---|---|
| GET `/health` | `{ok, openalexKeyConfigured, llmConfigured}` 只暴露布尔 |
| GET `/search` | `q, sources(≤100 个 S ID), yearFrom, yearTo, perPage(≤50), cursor, sort, type`；校验 `^S\d+$` 与数量；拼 `filter=primary_location.source.id:...,from_publication_date:YYYY-01-01,to_publication_date:YYYY-12-31`（**四审实测修正：上游拒绝 from/to_publication_year**）；`sort`∈{cited_by_count:desc,publication_year:desc}、`type`∈{article,review} 白名单；`select=` 裁剪 + 服务端二次投影（作者裁前 8 只留名，**列表不返回 abstract_inverted_index**；含 biblio 与 source.type、referenced_works≤50+refsTotal/refsTruncated、countries/firstAuthorCountry，供收藏 snapshot 离线导出与路线图/报告） |
| GET `/works` | `ids=W..\|W..` ≤100 批量取文（图谱 1-hop） |
| GET `/work` | 单篇详情含 abstract_inverted_index（前端还原摘要） |
| POST `/ai/keywords`、`/ai/survey` | M6 实现；M2 起校验 method/body≤64KB |

要点：**代码内**固定出站目标仅 api.openalex.org + 部署期固定的 LLM host（不接受用户传 URL；平台无出站域名配置参数，可达性 D4 探针实测）；**打包契约：functions 内相对导入+显式 .ts 扩展名，禁 @ 别名，依赖自包含**；`AbortSignal.timeout(15s)`；key 缺失降级无 key+mailto 并在 health 暴露；内存 LRU+TTL（search 10min/works 30min，上限 500 条，isolate 内 best-effort）；上游 429→`quota_exhausted`、401/403→`upstream_auth_error`、超时→`upstream_timeout`，不透传原始异常；Secret 缺失→`service_not_configured`；简易 per-IP 令牌桶 120req/min（一次全目录检索 ≈8 个底层请求，按 30/min 计会误伤共享 NAT 的评委）；未知路径 404、非 GET 打 GET 端点 405。
测试：`tests/function-handler.test.ts`（vitest mock 全局 fetch + **stub `globalThis.Deno={env:{get}}`**——Node 环境无 Deno 全局：子路径路由含网关改名、404/405/400、裁剪断言、错误映射、缓存命中不二次 fetch、**per-IP 令牌桶 120req/min、缓存 TTL 过期、LRU 500 条逐出**）。
本地验证：**先改造 `dev:function` 脚本**为 `deno run --allow-net --allow-env --env-file=.env dev/function-local.ts`（原脚本无 --allow-env/出站权限，真实调用必失败；此脚本仅本地开发用，不进部署包），本地 `.env` 放 OPENALEX_API_KEY（已 gitignore）→ `npm run dev:function` + `npm run check:function` + curl `http://127.0.0.1:8000/functions/v1/app/search?q=graph+neural+network&sources=S199944782` 真实返回；再经 Vite 代理 curl 5173。
**D4 私有探针部署（三审新增，把最大平台未知前移）**：`npm run build` → `prepare_site`（secretNames:[]，探针走**免 key 单条 ID 查询**，零 Secret 依赖）→ `ensure_backend`（**需用户当日授权 backend 分配**）→ `publish_site`（**保持私有，不动 access policy**）→ curl 部署 URL 验证 api.openalex.org 出站可达+子路径路由+运行时。D6 仍是首次公开锚点；探针通过≠D6 免验，公开后 curl 复验保留。
commit: `feat(function): OpenAlex proxy with cache, trimming and error mapping`

### M3 检索 UI + 首次公开部署（D5–D6，**D6=11/22 死线锚点**）
文件：`src/App.tsx`（路由 `/` 检索、`/library`、`/about`）、`src/pages/SearchPage.tsx`、`src/components/{SearchBar,FilterPanel,ResultList,PaperCard,PaperDetailSheet,QuotaBanner}.tsx`、`src/lib/{api,ccf,filters,types}.ts`、`src/store/search.ts`

- 启动 fetch ccf-venues.json 建双向索引（sourceId→venue 打徽章；筛选→sourceIds）
- 筛选：A/B/C 多选、10 领域中文标签、期刊/会议、年份区间；**筛选状态同步 URL query**（`/?q=...&rank=A&domain=AI` 可分享深链，评委直达演示态）
- `filters.ts`（必须单测）：筛选→venue 子集→sourceIds **按 ≤100 切片**；并行分批（并发 ≤4，perPage=50）按 id 去重合并；**合并后默认按 cited_by_count 降序**（跨批 relevance_score 各自相对本批、不可比，相关性仅作 API 原序参考），可切年份（客户端在取回窗口内排序并如实标注）；**结果窗口明示：每批取前 50、全目录 ≤~350 条、不做深度翻页（cursor 预留）；跨批 meta.count 不可加总，UI 总数标「窗口内 N 条」**
- **默认筛选预设为 CCF-A**（A 期刊 37 + A 会议 58 ≈95 venue，通常单请求；多 sourceIds 归并后可能超 100，切片逻辑兜底；额度友好且契合"开题先看顶会顶刊"）；全目录为显式选项（7 批，UI 提示耗时与额度消耗）
- 卡片：标题/作者/年份/venue+CCF 彩色徽章/引用数/DOI/OA 链接（**href 渲染前校验 http(s) 协议**，上游数据不可信，lib 工具+单测）；详情 Sheet 摘要由 inverted index 还原；收藏按钮（M3 落 store 骨架，snapshot 含 type/biblio 供离线导出）
- 首页 3 个示例 chip（graph neural network / large language model / diffusion model）；**把示例查询真实响应存 `public/data/demo/*.json`，quota_exhausted/upstream_auth_error/断网自动切换+横幅注明"演示数据"并引导使用示例查询（兜底仅覆盖示例查询，自定义查询额度耗尽时不可用；触发含 upstream_auth_error 使「改错 key」演练真实可触发）**
- 空态/skeleton/错误码中文文案；功能优先，深色学术风主题精修与基本响应式适配移 M7（D5 一天做 UI+主题偏紧）
- 测试：`tests/{filters,ccf-index,api-shape}.test.ts`（切片边界 100/101/681、反查、畸形 payload 拒绝、**兜底切换触发条件**）
- **D6 首次公开部署**（SOP 见 M7）+ 开公开访问
- commit: `feat(search): CCF-filtered search UI` / `chore: first public deployment`

### M4 引用图谱（D7–D8）
文件：`src/components/GraphView.tsx`（React.lazy 独立 chunk）、`src/lib/graph.ts`（纯函数必须单测）

- **库：react-force-graph-2d**（150 节点规模接入成本最低、canvas 性能够、自带缩放/拖拽/点击；cytoscape 过重、sigma 过剩、裸 d3 工期不允许）
- 构图：节点=结果集论文+1-hop 扩展节点；边=`referenced_works ∩ 全部展示节点 id 集`（有向，含扩展节点之间/与核心之间）；颜色 A=金红/B=蓝/C=绿/未分级=灰；大小 `4+sqrt(cited_by_count)` 封顶；孤立节点可开关
- 列表/图谱 Tab 切换；点击节点→详情面板（复用 PaperDetailSheet）+收藏；hover tooltip
- **1-hop 扩展（核心，单独 commit）**：结果集内互引往往稀疏（近期论文互引少，图谱可能全是孤立节点），1-hop 是图谱可读性与演示价值的关键；取集合外 referenced_works 分批调 `/works`（filter 类计费便宜，≈$0.0001/次），**总节点硬上限 150**，扩展节点**确定性选取：集内被引频次↓ → cited_by_count↓ → id**（保证截断测试可断言、演示可复现），虚线描边；主演示查询选引用密集方向
- 测试：`tests/graph.test.ts`（边只连展示节点集内、去重、上限截断、映射、空集合）
- commit: `feat(graph): citation graph with react-force-graph-2d`

### M5 收藏管理 + 导出（D9–D10）
文件：`src/store/library.ts`（zustand+persist）、`src/lib/{bibtex,storage}.ts`、`src/pages/LibraryPage.tsx`、`src/components/{LibraryTable,TagEditor,ExportMenu}.tsx`

- localStorage 单 key `paperstart:library`：`{schemaVersion:1, items:[{workId, savedAt, snapshot{title,authors,year,venue,sourceId,rank,type,biblio,doi,url,citedByCount}, tags[], status:unread|reading|done, note}]}`——**存 snapshot 冗余（含 type/biblio，BibTeX entry 类型与 volume/issue/pages 离线可定）**，收藏页离线可渲染、导出不依赖网络
- persist `version:1` + 显式 `migrate()`（单测：损坏 JSON 回退空库、未知版本拒绝、未来版本迁移路径；绿地项目无 v0，不造虚拟版本测试）；写入配额超限→toast 引导导出
- 收藏页：标签筛选、三态切换、行内笔记、批量选择
- **BibTeX 自拼**（单测+golden fixture）：key=第一作者姓氏+年份+标题首实词（冲突 a/b/c）；journal→`@article`、conference→`@inproceedings`、未知→`@misc`；author 用 ` and ` 连接；title 外加 `{}`；转义 `& % $ # _ { } ~ ^ \`；year/doi/url(优先 OA)/biblio 的 volume/issue/pages 缺省省略；`note={CCF-A, 人工智能}`
- JSON 导出=store 原样下载；**JSON 导入可砍**（校验版本+按 workId 去重合并）；Blob+a[download]，文件名 `paperstart-YYYYMMDD.bib/.json`
- 测试：`tests/{bibtex,storage}.test.ts`
- commit: `feat(library): localStorage library with tags/status/notes and BibTeX/JSON export`

### M6 AI 增强（D11，整体可砍）
文件：`functions/llm.ts`、`src/components/AiPanel.tsx`、`src/lib/ai.ts`

- 通用 OpenAI 兼容客户端：`fetch(LLM_BASE_URL+"/chat/completions")`，Bearer key，model=LLM_MODEL，timeout 50s（**平台 Function 超时上限未文档化，M6 部署后实测**），非流式（流式是砍项）
- `/ai/keywords`：固定输出 JSON `{queries:[3-5条英文检索式], explanation}`；服务端剥 markdown 围栏容错解析，失败→`ai_bad_response`；前端 queries 渲染为可点击 chip 一键检索（闭环回 M3）
- `/ai/survey`：入参选中论文 snapshot+摘要（≤20 篇），产出 markdown 综述草稿（脉络/方法对比/开放问题，[n] 引用），前端渲染+复制/下载 .md；**markdown 渲染禁原始 HTML**（react-markdown 默认转义，不引 rehype-raw；LLM 输出不可信，防 XSS）
- 降级：启动读 `/health`，llmConfigured:false→AI 入口置灰+tooltip，不影响核心功能；**M6 重部署才把 LLM_* 三 Secret 加入 secretNames**（D6 首发不声明，见 M7 SOP）；About/README 注明**AI 功能会将论文快照+摘要外发第三方 LLM**（隐私声明）
- 测试：`tests/llm.test.ts`（mock fetch：请求体形状、围栏剥离、畸形容错、secret 缺失、超时）
- commit: `feat(ai): optional keyword expansion and survey draft via OpenAI-compatible API`

### M7 部署固化 + 发帖材料（D12–D13；部署动作首次发生在 D4 私有探针，首次公开在 D6）
- **部署 SOP**（每次发版相同）：`npm run build` → `prepare_site(webDirectory:"dist", functionDirectory:"functions", spa:true)`，**secretNames 分期：D4 探针 [] → D6 首发 ["OPENALEX_API_KEY"] → D11 M6 加 LLM_BASE_URL/LLM_MODEL/LLM_API_KEY**（只声明代码实际依赖的名字，避免首发被未录 LLM Secret 卡死）；displayName/slug 建议 paperstart，先 check_subdomain；参数以 CN skill 实时 schema 为准 → `ensure_backend`(functions) → `get_publish_status` 等就绪（**首发需用户 Portal 录 OPENALEX_API_KEY 并确认同步后才 publish**）→ `publish_site` 验证 published:true → 首发 `update_access_policy(confirmPublic:true)` → 公开 URL 真实调用验证 → **Desktop 交付 `show_publish_confirmation` + 原文复制 deliveryMarkdown**；**未知结果先查 get_publish_status，禁换 actionId 重试**；排障用 `get_function_logs(type:requests/output)`
- **UI 精修**（从 M3 移入）：shadcn 深色学术风主题 + 基本响应式适配（评委可能手机点开链接），首屏即产品；**主题必须消费 .qoder.site 已声明的 Nudge 变量（appearance/radius/spacing/typography），不散改 CSS 绕过**（workbench 验收项）
- 材料：`docs/demo-script.md`（路演 3 分钟脚本+评委 5 步+演示深链）、`docs/screenshots/`（**Qoder 过程截图：对话规划/模块 commit/部署确认/Portal 录入，D1 起每个里程碑随手截，事后补不了**）、README 补公开 URL/架构/数据来源声明/**隐私声明（AI 外发第三方 LLM、收藏仅存浏览器本地）**、**演示 GIF/录屏**、比赛帖草稿（痛点→闭环演示→技术亮点：681 venue 映射管线/覆盖度报告/分批检索/零登录；帖子五部分：自我介绍/是什么/为什么/怎么用≤5步/Qoder 过程）；**可选：社交传播奖**（小红书/抖音/X 带话题发帖 @qoder，零钱包奖限 1000 名额）
- 最终验收：无痕浏览器评委 5 步 + Function 真实调用 + 额度兜底演练
- commit: `docs: demo script, screenshots and contest materials`

## 目录结构

```
paper_start/
├── src/{pages,components,lib,store}/   # 页面/组件/纯逻辑/zustand
├── components/ui/  hooks/  lib/utils.ts  # 模板原有（shadcn 顶层，@ 别名指根）
├── functions/      index.ts handler.ts openalex.ts cache.ts llm.ts
├── dev/            function-local.ts（模板原有）
├── scripts/        fetch-raw/parse-csv/resolve-sources/merge-aliases/build-venues.mjs + lib/
├── data/           raw/ intermediate/ manual/ review/（提交） cache/（gitignore）
├── public/data/    ccf-venues.json coverage-report.json demo/*.json
├── tests/          *.test.ts + fixtures/
├── docs/           data-sources.md coverage-report.md demo-script.md screenshots/
└── package.json vite.config.ts vitest.config.ts README.md LICENSE(MIT) .qoder.site（工具生成）
```

## 排期与砍线

| 日期 | 里程碑 |
|---|---|
| D1 11/17 | M0 + M1 Step1/2（用户当日：申请 OpenAlex key、天池报名+认证、**Sites 配额预检**；Node 24 直接可用无需装） |
| D2 11/18 | M1 Step3 期刊侧 + 会议 A/B（额度跨两天） |
| D3 11/19 | M1 Step3 上午 C 级收尾 + Step4/5 人工核对半天封顶 + 产出 |
| D4 11/20 | M2 Function + **私有探针部署**（用户授权 backend 分配） |
| D5 11/21 | M3 检索 UI（功能优先，主题精修移 M7） |
| **D6 11/22** | **首次公开部署（死线锚点；「早于 11/24」为内部锚点，非官方规则，出处待核）** |
| D7–D8 11/23–24 | M4 图谱（1-hop 为核心）+ 重部署 |
| D9–D10 11/25–26 | M5 管理+导出（导入可砍）+ 重部署 |
| D11 11/27 | M6 AI（可砍）+ LLM 三 Secret 重部署 |
| D12 11/28 | M7 材料+演练 |
| D13 11/29 | 最终发布+提交帖子 |
| 11/30 上午 | 纯复查，18:00 前确认提交 |

**砍线顺序**（核心闭环永不砍；二审调整：1-hop 是图谱演示价值关键，后移）：① JSON 导入 → ② AI 综述 → ③ AI 检索词扩展 → ④ 图谱 1-hop 降为仅集合内互引 → ⑤ 图谱降为引用列表（最后手段）。不可砍：CCF 过滤检索、图谱核心（含 1-hop 优先保留）、收藏、BibTeX 导出、公开部署、过程截图。

## 验证方案

**本地黄金路径**（D6 起每次发版前必跑，`npm run dev` + `npm run dev:function`）：
1. `http://127.0.0.1:5173/?q=graph+neural+network&rank=A` → 结果全带 CCF-A 徽章（抽 3 条人工核对 venue）
2. 切图谱 → 颜色/大小/引用边正确、点击出详情
3. 收藏 2 篇 → 打标签/改状态/写笔记 → 刷新仍在
4. 导出 .bib 核对 entry 类型/作者/转义；.json 核对 schemaVersion
5. 改错 key 演练（upstream_auth_error）→ 横幅+演示兜底接管

**Function 真实调用**（本地与部署后各一遍）：
```
curl -f 'https://<站点>/functions/v1/app/health'
curl -f 'https://<站点>/functions/v1/app/search?q=graph+neural+network&sources=S199944782&perPage=5'
curl -f 'https://<站点>/functions/v1/app/works?ids=<真实Wid>'
curl -f 'https://<站点>/functions/v1/app/work?id=<真实Wid>'   # 单条 ID 查询免费
curl -i 'https://<站点>/functions/v1/app/nonexistent'   # 必须 404
curl -i -X POST 'https://<站点>/functions/v1/app/search' # 必须 405
```
断言：search 无 abstract_inverted_index、作者≤8、referenced_works 存在；错误为稳定错误码。

**部署后评委 5 步**（无痕、未登录）：① 点开公开链接（首屏即检索台+示例 chip）→ ② 点示例 chip → ③ 切领域/年份筛选（默认已 CCF-A）→ ④ 切图谱点节点看详情 → ⑤ 收藏并进收藏页导出 BibTeX。另验 `/library` 深链刷新 200 且正确渲染（SPA fallback）。

## 风险与对策

| 风险 | 对策 |
|---|---|
| 会议 source 覆盖不全（NeurIPS 2.16 万、一会多 source、改名分裂） | 别名+issn_l 归并多 sourceIds；coverageWarning 角标如实标注；兜底：低覆盖 venue 追加无过滤 search 客户端按 venue 别名补录（标"未验证来源"）；路演主演示选期刊覆盖好的查询（TPAMI/TKDE 系） |
| OpenAlex 额度耗尽（访客共享 Function 出口 IP） | **额度数学（三审分列）：默认 CCF-A 预设 ≈1 个 search 请求 ≈$0.001 → ≈1000 次/天；全目录 ≈8 请求 ≈$0.008 → ≈120 次/天**；默认 CCF-A 预设大幅降耗；公开部署前必须配免费 key；Function+前端双层缓存；**演示兜底数据**自动切换+横幅引导示例查询；429 稳定错误码；D1 复核计费响应头（若恢复免费无限额度则风险降级，代理缓存仍保留） |
| M1 人工核对超量 | 半天封顶；unresolved 不阻塞；A 级优先 |
| 工期延误 | 按砍线顺序；D6 首发后每模块独立可发布，任何时刻站点都是完整产品 |
| Node 版本（三审已解决） | CN 模板要求 22.13+ 或 24+，本机 24.22.1 直接可用，无需装 Node |
| **Function 配额/出站可达性（平台侧未知）** | D1 预检 sites_total/backend_sites/部署存储配额；**D4 私有免 key 探针实测出站**；backend_sites=0 → 仅静态托管，决策：升级订阅（首选）或降级纯前端无 key 直连（额度极小仅演示兜底）；部署存储历史版本也占配额，多次发版留意 |
| Secret 未同步就发布 | SOP 强制 Portal 录入→确认同步→才 publish；/health 布尔探测作发布验收；secretNames 分期避免首发被 LLM Secret 卡死 |
| 上游 CSV 改版 | 计数硬校验失败即管线报错 |

## 用户侧行动项

| 时点 | 事项 |
|---|---|
| D1 立即 | openalex.org/settings/api 申请免费 key；天池报名（**选 StudyHack 赛道**）+实名+大学生认证（审核有周期，**遇阻及时联系主办方**）；**Sites 配额预检（sites_total/backend_sites/部署存储，能查则查）**；GitHub 仓库（gh 已登录 neilmorse，可 `gh repo create`）；复核 OpenAlex 计费响应头（`x-ratelimit-*`）；Node 24.22.1 直接可用无需装 |
| D1 起持续 | **每个里程碑截 Qoder 过程截图**存 docs/screenshots/（帖子硬性凭证） |
| D3 | 完成 unresolved.md 人工核对（30–80 条，半天） |
| D4 探针 | **授权 Function backend 分配**（ensure_backend 需用户授权）；私有探针部署验证出站可达 |
| D6 首发 | Portal 录 OPENALEX_API_KEY（**仅此一个，LLM 三 Secret 到 D11**）；确认 Function 就绪与 Secret 同步；确认公开访问 |
| D11 前 | 备好 OpenAI 兼容 LLM 的 BASE_URL/MODEL/KEY，Portal 录三 Secret 并**重部署（secretNames 此时才加 LLM_*）** |
| D12–D13 | 路演设备/网络检查；比赛帖提交（公开 URL+截图+演示 GIF）；可选社交传播奖发帖（小红书/抖音/X 带话题 @qoder）；11/30 18:00 前确认 |

## 复用资产

- 模板脚手架：`node <skill>/scripts/create-site.mjs`（仅容 .git/.DS_Store，仓库已 git init）；`<skill>/templates/react-starter/` 的 vite 代理、`dev/function-local.ts` 本地 Function 服务（**脚本需改造加权限**）、`functions/handler.ts` 纯函数模式、`lib/utils.ts` cn()、shadcn 组件、zod/sonner 已含、`check:function`(deno check)；`<skill>/assets/database-react/api.ts` 请求 helper（401/403 处理）可复用到 src/lib/api.ts
- Function 写法契约：`<skill>/references/functions.md`（子路径路由、错误码、Secret、出站要求）
- 部署参考：`<skill>/../sites-hosting/references/deployment.md`
- 数据底稿：ShowJCR CCF2026 CSV + ccf-deadlines yml（M1 下载）
- **本会话注意**：`<skill>` 已定位为 CN 本机路径（见上）；开工时仍先加载 `sites:sites-building` skill 复核契约（CN 新增设计工作台/交付契约）；node/npm 命令经 `fish -ic` 执行（nvm.fish 环境）

## 修订记录

**2026-11-17 二审合并**（源自国际版会话二审，原修订未落盘，已从导出对话合并）：
- **A 额度数学修正（高）**：一次全目录检索 ≈8 个 search 请求 ≈$0.008，$1/天 ≈120 次用户检索（原文误写 ≈1000 次）→ 默认 CCF-A 预设（95 venue 单请求）+ 全目录显式选项 + per-IP 限流 30→120req/min + D1 复核计费响应头
- **B 图谱 1-hop 核心化（高）**：集合内互引稀疏，1-hop 是图谱可读性关键 → 从"可砍"提为核心，砍线顺序后移至第④位
- **C 跨批排序修正（中）**：分批 relevance_score 不可比 → 合并后默认 cited_by_count 降序
- **D 测试细节（中）**：vitest 测 Deno handler 需 stub `globalThis.Deno={env:{get}}`
- **E 安全（中）**：AI 综述 markdown 渲染禁原始 HTML（不引 rehype-raw），防 LLM 输出 XSS
- **F 排期（中）**：D5 主题精修移 M7，M7 补基本响应式适配
- **G 小项**：报名选 StudyHack 赛道；可选社交传播奖；localStorage 迁移测试去掉虚拟 v0；兜底横幅引导示例查询（兜底仅覆盖 3 示例）

**2026-11-17 移植到 Qoder CN 会话**：计划全文记录于本文件；环境差异已标注（Node 24.22.1、nvm.fish/fish -ic、skill 路径需重新定位）。

**2026-11-17 三审合并（H–Q，Qoder CN 本机实测复核 + 国际版 diff + 独立完整性审查）**：
- **H 环境契约修正（高）**：CN 模板 Node 校验实为 22.13+ 或 24+，本机 24.22.1 直接可用，删「装 Node 22」5 处；dev:function 脚本缺 --allow-env/出站权限需改造（--env-file=.env）；gitignore.template 手动改名；create-site 仅容 .git/.DS_Store、自带 lockfile；「出站白名单」实为代码内固定目标（平台无配置参数）；打包契约相对导入+.ts 扩展；模块门禁加 check:function；保留路径全集 8 个；CN skill 根路径已定位；ShowJCR/ccf-deadlines/计费获证实（单条 ID 查询免费）
- **I 配额预检+D4 私有探针（高）**：D1 预检 sites_total/backend_sites/存储配额（backend_sites=0 仅静态站，架构级风险）；M2 完成即私有免 key 探针部署验证出站可达（需用户授权 backend），D6 公开锚点不变
- **J secretNames 分期（高）**：D4 [] → D6 仅 OPENALEX_API_KEY → D11 加 LLM×3，解除首发被未录 LLM Secret 卡死的死锁
- **K 兜底触发扩展（高）**：加 upstream_auth_error，使「改错 key」黄金路径演练真实可触发；补切换单测
- **L CN 设计工作台/交付契约（中）**：M0 open_design_workbench 注册 .qoder.site（禁手写）；M7 主题消费 Nudge 变量；SOP 补 show_publish_confirmation/deliveryMarkdown、未知结果查状态禁换 actionId、get_function_logs 排障、schema 以 CN 实时为准
- **M snapshot 补 type/biblio（中）**：离线 BibTeX 导出 entry 类型与 volume/issue/pages 自包含；M2 投影/M3 骨架同步
- **N 图谱规格补全（中）**：1-hop 确定性选取（集内被引频次↓→cited_by_count↓→id）；边集合含扩展节点
- **O M1 额度/排期一致（中）**：Step3 跨 D2–D3 上午（386 会议×≤2 search≈$0.77 逼近 $1/天）；全称仅低置信回落；scripts 加 mailto
- **P M2 测试补 3 例（中）**：令牌桶 120req/min、TTL 过期、LRU 500 逐出
- **Q 小项包（低）**：恢复 Codex for Open Source 动机（移植遗漏）；额度数学分列（CCF-A ≈1000 次/天 vs 全目录 ≈120 次/天）；95 venue 措辞；About 页 React 渲染 JSON；结果窗口/计数明示；评委第③步改切领域/年份；GIF 入材料；AI 隐私声明；href 协议校验；站点定名 check_subdomain；LLM 50s 超时待实测；11/24 改内部锚点；存储历史版本占配额；认证遇阻联系主办方

**2026-11-18 四审合并（差异化方向落地 + 实测修正，Qoder CN 会话）**：
- **R1 进度事实**：M0–M3 于 D1（11/17）完成并推送（站点含发布记录），超前原排期约 4 天；剩余窗口按 R14 重排，11/22 首次公开锚点不变
- **R2 三个差异化方向（用户确认）**：①阅读路线图为主视图（M4 改形态：路线图默认 Tab，力导向图谱降辅 Tab，1-hop 共用）②开题报告「元数据为骨、LLM 为翼」（M6 升级：结构化零 LLM 依赖先锁定，LLM 只填背景/Gap）③GitHub 资产卡片（新增 M5.5，双段探针门禁）
- **R3 数据层扩展**：WORK_SELECT + referenced_works（REFS_CAP=50 上游顺序截断 + refsTotal/refsTruncated 如实标注）；投影 + countries（全作者机构国家去重排序）/firstAuthorCountry（第一作者第一机构，**不跨作者回落**）；/search + sort/type 白名单（非法 400）
- **R4 年份过滤 bug 修复（实测）**：上游 400 拒绝 `from_publication_year`/`to_publication_year`（合法字段为 from/to_publication_date）；改 `from_publication_date:YYYY-01-01`/`to_publication_date:YYYY-12-31`；M2 起潜伏、SOTA 补充检索首次真实触发才暴露；handler 测试断言同步
- **R5 路线图规则定死（可测/可复现）**：milestone=year≤Y−5 且 cited≥100，cited↓→year↑→id↑，cap5；survey=type review 或标题 /\b(survey|review|overview|tutorial|systematic)\b/i 且 cited≥20，cap4；sota=year≥Y−2，rank(A0/B1/C2/无3)↑→cited↓→id↑，cap8；跨阶段去重优先级 milestone>survey>sota；Gap=开题报告 CTA；顶部启发式声明（非人工策展）+ 空阶段诚实文案 + refsTruncated 角标
- **R6 SOTA 补充检索（实测偏差适配）**：GNN 演示 relevance 窗口 SOTA 仅 1 篇 → 候选 <SOTA_SUPPLEMENT_MIN=3 且来源单批时补 1 次 `yearFrom=Y−2 + sort=cited_by_count:desc + type=article + perPage=25`；多批/兜底不补（避免部分样本冒充全量）；UI 标注「SOTA 阶段含补充检索」；store 测试覆盖触发/不触发四态
- **R7 1-hop 两段式确定性选取**：取回前 cited_by_count 不可知 → 预选 freq↓→id↑ 截 budget=min(150−core,200)（≤2 次 /works filter 请求）；取回后终排 freq↓→cited↓→id↑；图谱 CORE_CAP=100 保扩展席位、总节点 150；路线图用全量 core+≤200 扩展
- **R8 demo 兜底重生成**：3 主文件含 refs/countries + 新增 `<slug>-refs.json` 静态 1-hop 批次；兜底模式路线图/图谱离线可渲染；api-shape 守卫断言新字段存在 + GNN 三阶段非空（评委演示价值锁定）
- **R9 GitHub（M5.5）**：`GET /github?title=`（4..200 字符）代码内固定出站 api.github.com；24h LRU(200) + 403/429 cooldown（读 X-RateLimit-Reset，缺省 now+60s）；可选 GITHUB_TOKEN（5000/hr vs 共享出口未认证 60/hr）；scoreRepo=标题词命中×3+log(stars)+近半年活跃−fork/archived，**仅排序不声称权威**；UI 强制「相关仓库（非官方认证，按标题模糊匹配）」；Sheet 按钮懒加载 + Card 徽章仅用缓存；GitHub 错误**不触发** OpenAlex demo 兜底；本地探针通过（GAT Top1=一作官方仓库 PetarV-/GAT ★3559）；**平台出口探针待部署授权，不可达即砍线①**；PapersWithCode 已停运不使用（写入 data-sources/About）
- **R10 开题报告（M6-1，不可砍）**：五节中文 markdown（研究背景/国内外现状对比矩阵/技术路线梳理/Research Gap/参考文献+BibTeX 附录复用 bibtex 库）；矩阵主口径=第一作者第一机构国家三行（**unknown 单列不摊派**、最大余数法占比整数和=100）+ CN 合作副口径 + 口径脚注（机构元数据滞后声明）；时间线 year 降序分组 top3；REPORT_PAPER_CAP=40（引用降序）；react-markdown + remark-gfm（GFM 表格）**禁 rehype-raw**；ProposalPanel lazy chunk；Gap 阶段 CTA 接入
- **R11 M6-2 双插槽隔离**：`POST /ai/proposal` 只产 {background,gap}（各≤4000、合计≤8000），矩阵/时间线/参考文献永远确定性生成 → 幻觉不污染结构化部分；围栏剥离 + 畸形→ai_bad_response(502)；50s 超时（**平台 Function 上限未文档化，部署后实测再调**）；无 key 503 前端置灰 + tooltip；AI 段落强制警示行；摘要补取走免费单条 /work（top8）；隐私声明 About 更新（AI 外发 + GitHub 标题外发 + 结构化本地计算）；/ai/keywords 仍 501（砍线③）
- **R12 收藏 M5 完成**：persist migrate + **同版本 merge 归一化**（旧 snapshot 缺 countries/domain 补齐）；配额安全 storage（超限 toast 引导导出）；标签/三态/笔记/批量选择/批量状态/批量删除（confirm）；BibTeX golden fixture（entry type 按 venue type、key 冲突 a/b/c、转义、缺省省略）；JSON 导出 {schemaVersion:1,items}；snapshot + countries/domain
- **R13 工程**：store (query,filters) memoize 防重复烧额度（**兜底态允许重试真实检索**）；扩展失败不阻塞主结果（expandError 灰字）；StrictMode dev 双调用属开发态现象（生产不重复）；GraphView/ProposalPanel lazy chunk（主包 gzip ≈123KB）
- **R14 新排期（supersede 原排期表）**：D2–D3 11/18–19 M4a（数据层+纯函数+主视图）→ D4 11/20 M4b 图谱 → D5–D6 11/21–22 M5 + **首次公开（锚点不变）** → D7 11/23 GitHub 双段探针（不可达当场砍①）→ D8 11/24 GitHub UI + 缓冲垫 → D9 11/25 M6-1 锁定 → D10 11/26 M6-2 + 平台超时实测 → D11 11/27 主题精修（消费 Nudge 变量）→ D12 11/28 材料+演练 → D13 11/29 最终发布+提交 → 11/30 上午纯复查。**砍线序**：①GitHub → ②LLM 叙述（M6-1 已完整）→ ③图谱 Tab/keywords → ④JSON 导入 → ⑤1-hop 降集合内。**不可砍**：CCF 检索、路线图核心、收藏、BibTeX、公开部署、过程截图、结构化开题报告
- **R15 Secret 分期更新**：D6 ["OPENALEX_API_KEY"] → D8 +GITHUB_TOKEN（仅用户已录才声明）→ D10 +LLM_BASE_URL/LLM_MODEL/LLM_API_KEY；SOP 其余沿用 M7（未知结果先 get_publish_status、禁换 actionId、ensure_backend 需用户授权）
- **R16 上游稳定性实测**：tokeasy.ai 间歇 TLS unexpected eof（与 git push 瞬时 TLS 错误同源）；LLM 直连简单 prompt 200/6.2s 正常；客户端错误映射（ai_timeout/ai_upstream_error/ai_bad_response）+ 前端重试覆盖该抖动；若平台出口持续不可用按砍线②处理