# 数据来源声明

本项目的 CCF 目录资产由以下公开来源解析、归并而成。抓取日期：**2026-11-17**（元数据见 `data/raw/fetch-meta.json`）。

## 1. CCF 目录底稿（权威计数来源）

- **来源**：[hitfyd/ShowJCR](https://github.com/hitfyd/ShowJCR) 仓库 `中科院分区表及JCR原始数据文件/CCF2026-UTF8.csv`（master 分支）
- **内容**：CCF 推荐国际学术会议和期刊目录 **2026 年 3 月第七版**，681 条（期刊 295：A37/B113/C145；会议 386：A58/B132/C196），8 列（刊物名称/Journal/年份/出版社/网址/领域/推荐类别/推荐类型）
- **许可证**：ShowJCR 仓库为 GPL-3.0；**CCF 目录本身是 CCF 官方公开发布的事实性数据**（事实不受版权保护），本项目仅使用其目录事实并自建 venue→OpenAlex source 映射资产，不复制 ShowJCR 的独创性表达（分区表/JCR 数据等）
- **落盘**：`data/raw/CCF2026-UTF8.csv`（115730 bytes，随仓库提交以便离线重跑）
- **硬校验**：`scripts/parse-csv.mjs` 对 681/295/386 与 A/B/C 分布逐项断言，不符即报错退出（防上游悄悄改版）

## 2. 会议补充源（别名 / DBLP key / 领域英文名）

- **来源**：[ccfddl/ccf-deadlines](https://github.com/ccfddl/ccf-deadlines)（main 分支，commit `683e441c6074c8c8c16789b58d6a2904d7083429`）
- **许可证**：MIT（复用需保留版权与许可声明，本文件即声明）
- **内容**：`conference/<领域>/<缩写>.yml` 共 **385 个会议**（抽取 title/description/sub/rank.ccf/dblp）；`conference/types.yml` 提供 **10 个领域**的 sub 代码与中英文名
- **落盘**：`data/raw/ccfddl.json`（抽取结果，随仓库提交）；原始克隆缓存于 `data/cache/ccfddl-repo/`（gitignore）
- **定位**：补充源而非权威计数——比 CSV 少 1 个会议，归并时以 CSV 681 为准，缺失者如实记录

## 3. 文献元数据主源（Step3 起使用）

- **来源**：[OpenAlex](https://openalex.org) API（`api.openalex.org`），唯一主源（DBLP 在线 API 被反爬弃用，S2 不稳定弃用）
- **认证**：免费 API key（<https://openalex.org/settings/api> 申请，$1/天额度）；无 key 每 IP $0.10/天（仅够演示）。生产经服务端 Function 代理 + 缓存，前端不接触密钥
- **计费**：search $0.001/次、filter $0.0001/次、单条 ID/DOI 查询免费；source 多值 OR 过滤上限 100；>100rps 返回 429
- **礼貌池**：请求携带 `mailto`（联系方式取 `OPENALEX_MAILTO` 环境变量）
- **落盘**：所有响应缓存 `data/cache/`（gitignore），重跑不烧额度

## 已知数据quirks（解析时实测）

- **48 条期刊/会议无缩写**（CSV 刊物名称列为空）：matchKey 回退全称归一化，Step3 按名匹配
- **HotSec 全称列为空**（仅有缩写）：name 回退 abbr
- 部分行出版社/全称含多余空格（如 `IEEE/  ACM`）：归一化折叠
- ccfddl 385 会议 vs CSV 386：差 1，以 CSV 为准

## 重跑命令

```sh
node scripts/fetch-raw.mjs           # 取底稿（复用缓存；--force 强制刷新）
node scripts/parse-csv.mjs           # 解析 + 硬校验 → data/parsed/venues.json
npm test                             # tests/ccf-csv.test.ts 覆盖解析/归一化/计数
```

## 10 领域对照（sub ↔ 中文 ↔ 英文）

| sub | 中文 | 英文 |
|---|---|---|
| DS | 计算机体系结构/并行与分布计算/存储系统 | Computer Architecture/Parallel Programming/Storage Technology |
| NW | 计算机网络 | Network System |
| SC | 网络与信息安全 | Network and System Security |
| SE | 软件工程/系统软件/程序设计语言 | Software Engineering/Operating System/Programming Language Design |
| DB | 数据库/数据挖掘/内容检索 | Database/Data Mining/Information Retrieval |
| CT | 计算机科学理论 | Computing Theory |
| CG | 计算机图形学与多媒体 | Graphics |
| AI | 人工智能 | Artificial Intelligence |
| HI | 人机交互与普适计算 | Computer-Human Interaction |
| MX | 交叉/综合/新兴 | Interdiscipline/Mixture/Emerging |