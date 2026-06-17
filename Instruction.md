# TradeShield Agent · 基础说明（团队协作与上手）

> 这是项目的**基础说明 / 团队协作手册**（原 `README.md`）。它照顾第一次参加黑客松、第一次用 Node.js、第一次提 PR 的同学，覆盖 Harness 背景、命令、目录、改数据、领任务、开分支、提 PR 的完整流程。
>
> 想快速了解项目「是什么 + 怎么用」，请看根目录新的 [`README.md`](./README.md)。本文件作为更细的背景与协作规范保留。

---

> AI Agent x Blockchain 黑客松仓库：**AI 动态定价的 eBL-backed RWA 折价发行协议**的文档、Mock Harness、测试框架和团队协作规范。

这份文档是给所有项目成员看的，尤其照顾第一次参加黑客松、第一次用 Node.js、第一次提 PR 的同学。你不需要一开始就懂完 Web3、国际贸易或后端测试，只要按下面步骤做，就能把项目跑起来、领任务、开发、验证、提交 PR。

---

## 0. 先读这一段：这个项目到底是什么

TradeShield Agent 是一个面向黑客松的 **AI Dynamic Pricing x eBL-backed RWA Trade Finance** 仓库。

项目一句话：

> 出口商把电子提单质押到智能合约，系统以货值为支撑发行 RWA；AI Pricing & Risk Agent 根据到账速度和贸易风险，动态给出 RWA 的折价发行价、可融资额度和风控动作，投资者在认购前就看到价格、目标兑付价和风险来源。

更白话一点：

```text
国际贸易里，货已经装船，但钱还没回来。
出口商想提前、快速拿到现金。
电子提单代表货物权利，可以质押。
我们用 AI 给这批货估值，再把"想多快拿钱 + 有多少风险"折算成一个发行折价（比如 1 RWA 卖 0.85）。
投资者按折价认购，AI 在运输途中根据风险改价、暂停或清算。
```

> ⚠️ 模型升级提示：早期版本是"RiskReport 风控 + 资金池放贷"；当前主线是 **AI 动态定价的 RWA 折价发行**（见 `docs/PRD.md` v0.2 + `docs/tasks.md`）。定价引擎 `src/core/pricingEngine.js` 已实现并输出 `PricingQuote`（pricing_action）；旧 `riskEngine.js` 的 `RiskReport`（contract_action）仍保留用于 legacy 流程与回归。本文件已标注哪些是"现状（Current）"、哪些是"目标（Target）"。

本仓库现在不是最终 Demo，而是一个 **准备仓库 + 可运行 Harness**。它的目标是让大家在正式开发前有统一背景、统一 PRD、统一数据、统一命令、统一验证方式。

---

## 1. Harness 是什么

### 1.1 一句话解释

**Harness 是一个小型、固定、可重复运行的测试环境。**

你可以把它理解成：

```text
一套固定的假数据
+ 一套固定的风险计算规则
+ 一套固定的流程模拟
+ 一套固定的 API
+ 一套固定的测试命令
```

它的作用是让我们在没有真实银行、真实电子提单平台、真实智能合约、真实船舶数据的情况下，仍然能把项目主流程跑通。

### 1.2 为什么黑客松需要 Harness

黑客松时间很短。如果每个人都随便改、随便接数据、随便写接口，最后很容易出现：

- PM 的故事和工程实现对不上；
- Agent 同学输出的 JSON 前端读不了；
- 前端页面期待字段 A，后端实际返回字段 B；
- 合约同学设计的状态机和 demo 剧情不一致；
- 最后 1 小时才发现主流程跑不起来。

Harness 的价值就是：

> 不管你做什么功能，都必须能回到同一条主流程，并且能被命令验证。

### 1.3 本项目 Harness 的主链路

请先记住这条线：

```text
data/demo-case.json
→ src/core/riskEngine.js
→ src/core/workflow.js
→ src/app/server.js
→ scripts / tests / public UI
```

每个文件在做什么：

| 文件 | 它是什么 | 小白理解 |
|---|---|---|
| `data/demo-case.json` | Demo 输入数据（legacy） | 一笔铜阴极板国际贸易案例，喂给旧风险引擎 |
| `data/uploads/` | 拟真上传单据 | 模拟用户上传的 eBL + 商业发票（新加坡铜 / 原油），见其 README |
| `data/cases/` | 结构化 case（新模型） | 对齐 PricingQuote 字段的案例 JSON |
| `src/core/riskEngine.js` | 定价/风险引擎 | 现状：算 RiskReport（旧）。目标：升级为输出 RWA 折价的 PricingQuote |
| `src/core/workflow.js` | 流程模拟器 | 模拟链上状态机（现状 Created→Funding→…，目标 Created→Priced→Open→…） |
| `src/agent/` | AI 估值 tool calling | LLM 调用「实时铜价 / 历史同类成交价 / 估值」工具，见 `docs/ai-valuation-tooling.md` |
| `src/app/server.js` | 最小 Web/API 服务 | 提供网页和 API，让前端或测试能访问数据 |
| `scripts/check.mjs` | 自检脚本 | 检查文件、脚本、seed 数据、引擎是否还正常 |
| `scripts/demo.mjs` | CLI Demo | 在终端打印完整演示流程 |
| `scripts/smoke.mjs` | 冒烟测试 | 启动一个临时 API server，检查关键 API 是否可用 |
| `scripts/agent-valuation.mjs` | 估值 CLI | 跑 AI 估值工具，离线有 deterministic fallback |
| `tests/*.test.js` | 自动测试 | 验证引擎和主流程没有被改坏 |
| `public/*` | 前端页面 | 浏览器看到的页面 |

### 1.4 Harness 不是什么

Harness 不是最终产品。当前阶段它不会做这些事：

- 不连接真实银行；
- 不连接真实电子提单平台；
- 不进行真实募资；
- 不部署真实主网合约；
- 不进行真实 KYC；
- 不处理真实跨境支付；
- 不承诺任何收益；
- 不面对公众融资。

它只是一个 **可运行、可解释、可验证的黑客松骨架**。

---

## 2. 第一次上手前需要准备什么

### 2.1 你需要安装的软件

至少需要：

1. **Git**
   用来拉代码、开分支、提交修改、推送 PR。

2. **Node.js >= 18.18.0**
   用来运行项目脚本、测试和本地 Web 服务。

3. **代码编辑器**
   推荐 VS Code，也可以用 Cursor、WebStorm 或其他编辑器。

4. **浏览器**
   Chrome、Edge、Firefox 都可以。

### 2.2 检查 Git 是否安装

打开终端，运行：

```bash
git --version
```

如果看到类似：

```text
git version 2.x.x
```

说明 Git 已安装。

如果提示找不到 `git`，说明你还没装 Git，先安装 Git 再继续。

### 2.3 检查 Node 是否安装

运行：

```bash
node -v
```

如果看到类似：

```text
v18.18.0
v20.x.x
v22.x.x
```

说明 Node 已安装。版本必须大于等于 18.18.0。

再检查 npm：

```bash
npm -v
```

如果能输出版本号，就可以继续。

### 2.4 Windows PowerShell 小提醒

如果你在 Windows PowerShell 里运行 `npm run check`，遇到类似：

```text
无法加载文件 npm.ps1，因为在此系统上禁止运行脚本
```

不是项目坏了，是 PowerShell 执行策略限制。可以改用：

```powershell
npm.cmd run check
npm.cmd run test
npm.cmd run demo
npm.cmd run dev
```

下面文档里写 `npm run xxx` 的地方，Windows 同学都可以替换成 `npm.cmd run xxx`。

---

## 3. 第一次把项目跑起来

### 3.1 进入项目目录

如果你已经拿到项目文件，终端进入：

```bash
cd TradeShield-Agent-Starter
```

如果你是从 GitHub clone：

```bash
git clone <repo-url>
cd TradeShield-Agent-Starter
```

`<repo-url>` 换成真实仓库地址。

### 3.2 确认自己在正确目录

运行：

```bash
ls
```

Windows PowerShell 也可以运行：

```powershell
dir
```

你应该能看到这些文件或目录：

```text
README.md
package.json
data
docs
public
scripts
src
tests
```

如果看不到 `package.json`，说明你不在项目根目录，需要先 `cd` 到正确位置。

### 3.3 安装项目

运行：

```bash
npm install
```

当前项目没有外部依赖，所以它只会打印提示：

```text
No external dependencies are required for this preparation harness.
Next: npm run check && npm run test && npm run demo
```

这一步的意义：

- 让所有成员形成统一启动习惯；
- 后续如果项目加入依赖，大家不需要改流程；
- 确认 npm 能正常运行。

### 3.4 跑第一条自检命令

运行：

```bash
npm run check
```

这条命令会检查：

- 必需文件是否存在；
- `package.json` 里脚本是否完整；
- `data/demo-case.json` 是否能读取；
- 风险引擎是否能生成 `evidence_hash`；
- 风险动作是否是合法值。

成功时应该看到：

```text
check passed: files, scripts, seed data and risk engine are valid.
```

如果失败，不要慌。先看错误提示，一般是文件缺失、JSON 格式写坏、或者 Node 没有正确运行。

### 3.5 跑测试

运行：

```bash
npm run test
```

这条命令会运行 `tests/*.test.js`。

它主要验证：

- 风险引擎规则有没有被改坏；
- workflow 主流程是否还能跑；
- 关键输出字段是否还存在。

成功时你会看到 Node test 的通过结果。

### 3.6 跑命令行 Demo

运行：

```bash
npm run demo
```

这条命令会读取 `data/demo-case.json`，然后打印：

```text
TradeShield Agent mock demo flow
==========================================
1. [Created] ...
2. [Funding] ...
...

Risk report
{
  ...
}
```

这一步的意义：

- PM 可以用它理解 demo 剧情；
- Agent 同学可以看风险输出；
- Web3 同学可以看状态机；
- 前端同学可以知道页面应该展示哪些字段。

### 3.7 启动网页和 API

运行：

```bash
npm run dev
```

成功时会看到：

```text
TradeShield Agent harness running at http://localhost:3000
```

打开浏览器访问：

```text
http://localhost:3000
```

注意：`npm run dev` 会一直占着终端运行。如果你想停止它，在终端按：

```text
Ctrl + C
```

### 3.8 检查 API

启动 `npm run dev` 后，可以在浏览器打开：

```text
http://localhost:3000/api/health
```

如果看到：

```json
{
  "ok": true,
  "service": "tradeshield-agent-harness"
}
```

说明 server 正常。

再打开：

```text
http://localhost:3000/api/demo-data
```

你会看到 `data/demo-case.json` 的内容。

---

## 4. 每个命令到底在干什么

### 4.1 `npm run check`

适合什么时候跑：

- 第一次拉项目后；
- 每次提交前；
- 改了 `package.json`、`data/demo-case.json`、`scripts/check.mjs` 后；
- 不确定项目有没有被改坏时。

它会做什么：

```text
检查 README、docs、data、src、tests 等关键文件是否存在
检查 package.json 里 install/dev/test/check/demo/smoke 脚本是否存在
读取 demo-case.json
调用 calculateRisk(data)
确认 risk report 有 evidence_hash
确认 contract_action 是合法动作
```

你要记住：

> `check` 是最低成本的健康检查。先跑它。

### 4.2 `npm run test`

适合什么时候跑：

- 改了 `src/core/riskEngine.js`；
- 改了 `src/core/workflow.js`；
- 改了测试文件；
- 改了 RiskReport 字段。

它会做什么：

```text
运行 tests/riskEngine.test.js
运行 tests/smoke.test.js
检查核心逻辑是否符合预期
```

你要记住：

> 改核心逻辑必须跑 `test`。

### 4.3 `npm run smoke`

适合什么时候跑：

- 改了 `src/app/server.js`；
- 改了 API；
- 改了 workflow；
- 改了前端调用 API 的方式；
- 准备提交主流程相关 PR 前。

它会做什么：

```text
临时启动一个 server
请求 /api/health
请求 /api/demo-data
请求 /api/workflow/simulate
确认返回结果可用
关闭 server
```

你要记住：

> `smoke` 检查 API 主流程有没有冒烟起火。

### 4.4 `npm run demo`

适合什么时候跑：

- PM 写路演脚本；
- Agent 同学调风险解释；
- Web3 同学看状态机；
- 准备最终演示；
- 改了 demo case 后。

它会做什么：

```text
读取 demo-case.json
调用 simulateWorkflow(data)
打印每一步状态变化
打印 RiskReport JSON
```

你要记住：

> `demo` 是我们的兜底演示方案。网页坏了也可以用它讲完整流程。

### 4.5 `npm run dev`

适合什么时候跑：

- 做前端页面；
- 手动看 API；
- 给队友演示当前页面；
- 检查浏览器里的效果。

它会做什么：

```text
启动本地 Web server
提供 public/index.html
提供 /api/health
提供 /api/demo-data
提供 /api/risk/analyze
提供 /api/workflow/simulate
```

你要记住：

> `dev` 是人工调试用的，跑起来后要打开浏览器看。

---

## 5. 项目目录怎么读

第一次看仓库时，不要从所有文件一起看。按这个顺序看：

### 5.1 先看文档

```text
docs/background.md
docs/PRD.md
docs/tasks.md
docs/acceptance.md
```

它们分别回答：

| 文件 | 回答什么问题 |
|---|---|
| `docs/background.md` | 这个领域是什么，提单/eBL/RWA/贸易融资是什么 |
| `docs/PRD.md` | 我们具体要做什么产品、什么 MVP、什么页面和 API |
| `docs/tasks.md` | 每个人可以领什么任务，怎么验证 |
| `docs/acceptance.md` | 什么叫做完成，什么命令必须通过 |

### 5.2 再看数据

```text
data/demo-case.json
```

这是整个 Harness 的输入。它是一笔模拟贸易融资案例。

你可以把它理解成：

```text
一张电子提单
+ 一份保险
+ 一笔融资请求
+ 一个市场价格
+ 一些运输风险事件
```

### 5.3 再看核心逻辑

```text
src/core/riskEngine.js
src/core/workflow.js
```

`riskEngine.js` 做风险计算。

`workflow.js` 把风险动作变成流程状态。

### 5.4 最后看 Web 和测试

```text
src/app/server.js
public/*
tests/*
scripts/*
```

这些文件负责把核心逻辑暴露给网页、API、测试和命令行。

---

## 6. 如何修改 Demo 数据

### 6.1 为什么先改 Demo 数据

对小白最友好的练习方式是先改 `data/demo-case.json`，因为不用理解很多代码，也能看到风险结果的变化。

> 这一节改的是 **legacy** seed（旧 RiskReport 引擎）。新模型的拟真数据在 `data/uploads/`（eBL + 商业发票）和 `data/cases/`（结构化 case），字段对齐 PricingQuote，见 `data/uploads/README.md`。

### 6.2 可以改哪些字段

打开：

```text
data/demo-case.json
```

可以尝试改：

- `bill_of_lading.shipper`：出口商；
- `bill_of_lading.consignee`：进口商；
- `bill_of_lading.vessel`：船名；
- `bill_of_lading.cargo`：货物名称；
- `bill_of_lading.quantity_mt`：货物数量；
- `bill_of_lading.declared_value_usd`：申报货值；
- `insurance.insured_value_usd`：保险金额；
- `financing.requested_amount_usd`：融资金额；
- `market.current_price_usd_per_mt`：当前市场价格；
- `shipment_events`：运输事件，比如坏天气、延误、保险风险。

### 6.3 改完要跑什么

改完后运行：

```bash
npm run check
npm run test
npm run demo
```

看 `npm run demo` 输出里的这些字段有没有变化：

- `risk_level`
- `cargo_health_score`
- `verified_cargo_value_usd`
- `health_factor`
- `contract_action`
- `detected_risks`
- `explanation`

### 6.4 常见错误

JSON 文件最容易写坏。注意：

- 字符串必须用双引号；
- 每个字段之间要有逗号；
- 最后一项后面不要多逗号；
- 数字不要加引号，除非原本就是字符串。

错误示例：

```json
{
  "cargo": "Copper Cathodes",
  "quantity_mt": 1000,
}
```

最后一行多了逗号，会导致 JSON 解析失败。

正确示例：

```json
{
  "cargo": "Copper Cathodes",
  "quantity_mt": 1000
}
```

---

## 7. 如何手动测试 API

### 7.1 启动 server

运行：

```bash
npm run dev
```

保持这个终端不要关。

### 7.2 浏览器测试 GET API

打开：

```text
http://localhost:3000/api/health
```

这表示服务是否活着。

打开：

```text
http://localhost:3000/api/demo-data
```

这表示 seed 数据是否能读出来。

### 7.3 终端测试 POST API

新开一个终端，运行：

```bash
curl -X POST http://localhost:3000/api/risk/analyze
```

它会返回风险报告。

再运行：

```bash
curl -X POST http://localhost:3000/api/workflow/simulate
```

它会返回状态机模拟结果。

如果你的 Windows 没有 `curl`，可以先只用浏览器看 GET API，或者直接跑：

```bash
npm run smoke
```

`smoke` 会自动帮你测关键 API。

---

## 8. 如何领取任务

任务文件在：

```text
docs/tasks.md
```

### 8.1 任务表怎么看

任务按角色分组：

- PM / Business；
- Agent / AI；
- Frontend；
- Web3 / Contract；
- Backend / Integration；
- QA / Integrator。

每行任务长这样：

```text
| AI-2 | 优化 riskEngine 规则和权重 | Unassigned | Todo | `npm run test` | - |
```

每一列的意思：

| 列 | 含义 |
|---|---|
| ID | 任务编号，PR 里要写 |
| Task | 具体要做的事 |
| Owner | 谁负责 |
| Status | 当前状态 |
| Verification | 怎么验证 |
| Done Evidence | 完成证据，比如 PR 链接或 commit |

### 8.2 状态是什么意思

| 状态 | 含义 |
|---|---|
| `Todo` | 还没人做 |
| `In Progress` | 有人在做 |
| `Review` | 已提交 PR，等待 review |
| `Done` | 已完成并合并 |
| `Blocked` | 被卡住，需要队友帮助 |

### 8.3 领取任务前先做什么

先确保自己在最新主分支：

```bash
git checkout main
git pull
```

如果主分支不叫 `main`，按仓库实际主分支名字来。

然后打开 `docs/tasks.md`，找 `Owner` 是 `Unassigned` 且 `Status` 是 `Todo` 的任务。

### 8.4 如何认领任务

假设你要领：

```text
AI-2 | 优化 riskEngine 规则和权重
```

把这一行从：

```text
| AI-2 | 优化 riskEngine 规则和权重 | Unassigned | Todo | `npm run test` | - |
```

改成：

```text
| AI-2 | 优化 riskEngine 规则和权重 | your-name | In Progress | `npm run test` | - |
```

`your-name` 可以写你的名字、GitHub ID 或队内昵称。

### 8.5 认领任务后要不要先提交

建议要。

因为这样别人能看到你已经在做，避免撞车。

```bash
git checkout -b feature/ai-risk-weight
git add docs/tasks.md
git commit -m "chore(tasks): claim AI-2"
git push -u origin feature/ai-risk-weight
```

如果你们团队不想为认领任务单独提交，也可以把认领和功能改动放在同一个 PR。但一定要在群里说清楚，避免两个人做同一个任务。

---

## 9. 如何开分支开发

### 9.1 为什么要开分支

不要直接在 `main` 上改。原因：

- main 应该保持稳定；
- 每个任务应该有独立 PR；
- 出错时好回滚；
- 队友容易 review。

### 9.2 分支命名规则

推荐：

```text
feature/ai-risk-schema
feature/frontend-dashboard
feature/contract-mock
fix/smoke-api
docs/update-readme
chore/update-tasks
```

命名建议：

```text
类型/简短说明
```

常见类型：

| 类型 | 用途 |
|---|---|
| `feature` | 新功能 |
| `fix` | 修 bug |
| `docs` | 文档 |
| `test` | 测试 |
| `chore` | 任务表、脚本、配置等杂项 |

### 9.3 开分支命令

先确保主分支最新：

```bash
git checkout main
git pull
```

再开新分支：

```bash
git checkout -b feature/your-task-name
```

示例：

```bash
git checkout -b feature/ai-risk-weight
```

---

## 10. 如何开发一个任务

### 10.1 先看 Verification

每个任务都有 `Verification` 列。那一列告诉你完成后必须跑什么。

例如：

```text
AI-2 | 优化 riskEngine 规则和权重 | Verification: `npm run test`
```

意思是你做完后至少要跑：

```bash
npm run test
```

如果你改了主流程，建议多跑：

```bash
npm run check
npm run test
npm run smoke
npm run demo
```

### 10.2 按任务类型找文件

| 任务类型 | 常改文件 |
|---|---|
| PM / Business | `docs/*`、`README.md` |
| Agent / AI | `src/core/riskEngine.js`、`data/demo-case.json`、`tests/riskEngine.test.js` |
| Frontend | `public/index.html`、`public/app.js`、`public/styles.css` |
| Web3 / Contract | `src/core/workflow.js`、`docs/PRD.md`、`hardhat/contracts/*` |
| Backend / Integration | `src/app/server.js`、`scripts/smoke.mjs`、`tests/*` |
| QA | `scripts/*`、`tests/*`、`docs/acceptance.md` |

### 10.3 小白最推荐的开发方式

不要一次改很多。

推荐节奏：

```text
改一点
→ 跑一次相关命令
→ 看输出
→ 再改一点
→ 再跑
```

比如改风险规则：

```bash
npm run test
npm run demo
```

比如改 API：

```bash
npm run smoke
```

比如改页面：

```bash
npm run dev
```

然后打开浏览器看。

### 10.4 不知道自己改坏了什么怎么办

先看当前改了哪些文件：

```bash
git status
```

看具体差异：

```bash
git diff
```

跑最低成本检查：

```bash
npm run check
```

如果 `check` 过了，再跑任务对应命令。

---

## 11. 如何更新任务状态

### 11.1 开始做时

在 `docs/tasks.md` 中：

```text
Owner: Unassigned → your-name
Status: Todo → In Progress
```

### 11.2 提 PR 前

如果你的团队希望任务表体现 review 状态，可以改成：

```text
Status: In Progress → Review
Done Evidence: PR 链接或先写 Pending PR
```

如果你还没有 PR 链接，可以先不填 Done Evidence，在 PR 创建后再补一次提交。

### 11.3 合并后

PR 合并后，把任务改成：

```text
Status: Done
Done Evidence: PR 链接 / commit hash / 测试命令输出
```

如果团队节奏很快，也可以由 integrator 统一在合并后更新任务表。

---

## 12. 提交代码前要检查什么

### 12.1 看工作区状态

运行：

```bash
git status
```

你会看到哪些文件被改了。

确认：

- 只包含你这次任务相关的文件；
- 没有误改奇怪文件；
- 没有把本地临时文件提交进去；
- 没有包含 API Key、私钥、密码。

### 12.2 跑验证命令

最低要求：

```bash
npm run check
npm run test
```

如果改了 API、server、workflow、前端、demo 数据：

```bash
npm run smoke
npm run demo
```

如果改了页面：

```bash
npm run dev
```

然后手动打开：

```text
http://localhost:3000
```

### 12.3 记录验证结果

PR 里要写类似：

```text
Verification:
- npm run check: passed
- npm run test: passed
- npm run smoke: passed
- npm run demo: passed
```

如果某个命令没跑，也要诚实写：

```text
Not run:
- npm run smoke: not needed, docs-only change
```

---

## 13. 如何提交 commit

### 13.1 添加文件

查看状态：

```bash
git status
```

添加你要提交的文件：

```bash
git add README.md
git add docs/tasks.md
git add src/core/riskEngine.js
```

如果你确定所有改动都属于本任务，也可以：

```bash
git add .
```

小白建议优先一个个 `git add 文件名`，更不容易误提交。

### 13.2 写 commit message

推荐格式：

```text
type(scope): short description
```

示例：

```bash
git commit -m "docs(readme): explain harness workflow"
git commit -m "feat(agent): tune cargo health scoring"
git commit -m "fix(api): validate empty request body"
git commit -m "test(risk): cover insurance expiry risk"
git commit -m "chore(tasks): claim FE-1"
```

常见 type：

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档 |
| `test` | 测试 |
| `chore` | 杂项、任务表、配置 |
| `refactor` | 重构但不改行为 |

### 13.3 提交前发现错了怎么办

如果还没 commit，直接改文件，然后重新跑验证。

如果已经 commit 但还没 push，可以追加修改：

```bash
git add <file>
git commit --amend
```

小白如果不熟 `amend`，也可以再提交一个修复 commit：

```bash
git add <file>
git commit -m "fix: address review notes"
```

---

## 14. 如何推送分支

第一次推送当前分支：

```bash
git push -u origin feature/your-task-name
```

示例：

```bash
git push -u origin feature/ai-risk-weight
```

以后同一个分支继续推送：

```bash
git push
```

如果 push 失败，常见原因：

- 没有权限；
- 分支名写错；
- 网络问题；
- 本地落后远端；
- 还没有配置 GitHub SSH / token。

遇到权限问题，找团队 repo 管理员。

---

## 15. 如何提交 PR

### 15.1 在 GitHub 页面创建 PR

推送分支后，打开 GitHub 仓库页面。

通常 GitHub 会提示：

```text
Compare & pull request
```

点击它。

如果没有提示：

1. 打开仓库的 Pull requests 页面；
2. 点击 New pull request；
3. base 选择 `main`；
4. compare 选择你的分支；
5. 创建 PR。

### 15.2 PR 标题怎么写

推荐格式：

```text
[Task ID] type(scope): short description
```

示例：

```text
[AI-2] feat(agent): tune risk scoring weights
[FE-1] feat(frontend): add exporter dashboard card
[PM-2] docs(demo): add 3-minute script
[BE-5] fix(api): validate invalid case input
```

### 15.3 PR 描述模板

复制下面模板到 PR 描述里：

````markdown
## Task

- Task ID:
- Owner:

## What changed

-

## Files changed

-

## How to verify

- [ ] npm run check
- [ ] npm run test
- [ ] npm run smoke
- [ ] npm run demo
- [ ] Manual browser check at http://localhost:3000

## Verification result

```text
Paste command output or summarize results here.
```

## Screenshots / demo notes

-

## Risk / notes

-
````

如果是纯文档 PR，可以写：

```text
Not run: npm run smoke / npm run demo, docs-only change.
```

但如果改了代码，尽量跑对应命令。

### 15.4 PR 创建后要做什么

1. 把 PR 链接发到团队群；
2. 在 `docs/tasks.md` 里把任务状态改成 `Review`；
3. 如果有 PR 链接，把 Done Evidence 暂时填 PR 链接；
4. 等队友 review；
5. 按 review 意见修改；
6. 再 push；
7. 等 CI / 人工验证通过；
8. 合并。

---

## 16. Review 和合并后要做什么

### 16.1 收到 review 意见

不要重新开分支。直接在原分支继续改：

```bash
git status
git add <changed-files>
git commit -m "fix: address review feedback"
git push
```

GitHub PR 会自动更新。

### 16.2 合并后更新本地 main

PR 合并后，本地回到 main：

```bash
git checkout main
git pull
```

### 16.3 更新任务状态

如果还没更新 `docs/tasks.md`，把任务改成：

```text
Status: Done
Done Evidence: PR 链接或 commit hash
```

如果这个更新需要单独 PR，可以开一个小 PR：

```bash
git checkout -b chore/mark-task-done
git add docs/tasks.md
git commit -m "chore(tasks): mark AI-2 done"
git push -u origin chore/mark-task-done
```

团队也可以约定由 PM / Integrator 统一维护任务状态。

---

## 17. 不同角色的详细上手路径

### 17.1 PM / Business

你主要负责让评委听懂。

先读：

```text
docs/background.md
docs/PRD.md
docs/acceptance.md
```

常见任务：

- 写 3 分钟 demo 脚本；
- 准备一句话 pitch；
- 准备合规边界 Q&A；
- 准备最终演示故事线。

常跑命令：

```bash
npm run demo
```

你应该关注输出里的：

- 状态机每一步；
- 风险报告解释；
- `contract_action`；
- `detected_risks`。

### 17.2 Agent / AI

你主要负责让风险判断可信、稳定、结构化。

先看：

```text
data/demo-case.json
src/core/riskEngine.js
tests/riskEngine.test.js
```

常见任务：

- 调整风险规则；
- 固定 RiskReport schema；
- 增加单据一致性检查；
- 生成自然语言风险解释；
- 接入 Qwen / DeepSeek mock fallback。

常跑命令：

```bash
npm run test
npm run demo
```

注意：

- 输出必须是 JSON；
- 不要只返回自然语言；
- 字段改动要同步前端和测试。

### 17.3 Frontend

你主要负责让 Demo 可视化。

先看：

```text
public/index.html
public/app.js
public/styles.css
src/app/server.js
```

常见任务：

- Exporter Dashboard；
- Risk Agent Report；
- Investor Pool；
- Settlement Timeline；
- Run Demo 按钮。

常跑命令：

```bash
npm run dev
npm run smoke
```

浏览器打开：

```text
http://localhost:3000
```

注意：

- 页面展示的数据应该来自 API；
- 不要在前端写死太多字段；
- API 字段变了要和 Agent / Backend 同学同步。

### 17.4 Web3 / Contract

你主要负责把 workflow 映射成合约思维。

先看：

```text
src/core/workflow.js
docs/PRD.md
docs/background.md
```

常见任务：

- 设计 EBLRegistry 接口；
- 设计 RWAOfferingPool 接口（createOffering / subscribe / reprice / pause / settle）；
- 设计 RiskPricingOracle 接口（updatePricing + PricingUpdated 事件）；
- 做 JS contract mock；
- 可选实现最小 Solidity 合约。

常跑命令：

```bash
npm run test
npm run smoke
npm run demo
```

注意：

- 黑客松 MVP 可以先用 JS mock；
- 合约状态必须和 demo 状态机对齐；
- 风险动作来自 Agent 输出，不是凭空切状态。

### 17.5 Backend / Integration

你主要负责 API 和主流程稳定。

先看：

```text
src/app/server.js
scripts/smoke.mjs
tests/smoke.test.js
```

常见任务：

- 维护 `/api/health`；
- 维护 `/api/demo-data`；
- 维护 `/api/risk/analyze`；
- 维护 `/api/workflow/simulate`；
- 增加错误输入校验。

常跑命令：

```bash
npm run smoke
npm run test
```

### 17.6 QA / Integrator

你主要负责防止大家把主流程改坏。

先看：

```text
scripts/check.mjs
scripts/smoke.mjs
tests/*
docs/acceptance.md
```

常见任务：

- 维护 check/test/smoke；
- 补测试；
- 做最终演示兜底清单；
- 最后 6 小时功能冻结。

常跑命令：

```bash
npm run check
npm run test
npm run smoke
npm run demo
```

---

## 18. Demo 流程

### 18.1 当前（legacy）CLI demo

命令：

```bash
npm run demo
```

当前 `npm run demo` 跑的还是旧 RiskReport 引擎，展示：

```text
Created → Funding → Funded → InTransit
→ AI Risk Agent analyzes cargo / market / insurance events
→ Warning / Frozen / Liquidation
```

当前 seed case（`data/demo-case.json`）：

```text
Shanghai Metals Export Co. → Hamburg Industrial GmbH
Cargo: Copper Cathodes, 1,000 MT
Financing: 5,600,000 USDC
Risk events: bad weather, delay, insurance expiry risk, copper price drop
```

### 18.2 目标（Target）定价 demo

新模型的 demo 用 `data/uploads/` 的拟真数据（新加坡 → 上海铜阴极板 500 吨）：

```text
出口商上传 eBL + 商业发票
→ AI 调用工具：实时 LME 铜价 + 历史同类成交价 + 估值（npm run agent:value）
→ AI 输出 PricingQuote：发行价 ≈ 0.80（FAST 到账，让出约 60% 盈利）
→ Created → Priced → Open（投资者按 ≈ 0.80 认购）
→ 霍尔木兹战争升级 + 铜价剧烈波动 → AI 把价压到 ≈ 0.76
→ Repriced / Paused，RiskPricingOracle 记录新价 + 证据哈希
```

评委应该看到：

```text
AI 调用工具拉了真实价格和历史成交价
→ 把"速度 + 风险"折算成发行价（≈ 0.80 → ≈ 0.76）
→ pricing_action / offering 状态变化
→ 前端或 CLI 展示价格、目标兑付价、风险来源、证据哈希
```

---

## 19. API 预览

当前 API 是 Mock 版本，后续可以替换为真实 AI Agent、合约、Oracle 或 RAG 服务。

当前已实现（Current）：

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/health` | Harness 健康检查 |
| GET | `/api/demo-data` | 返回 seed 电子提单案例 |
| GET | `/api/cases` | 返回结构化 case 目录（前端场景选择器用） |
| POST | `/api/risk/analyze` | 返回结构化 AI 风险报告（旧 RiskReport） |
| POST | `/api/workflow/simulate` | 模拟主流程状态机 |
| POST | `/api/pricing/quote` | 生成 AI PricingQuote（折价 + 额度 + 动作；空 body 用 demo case，`?compare=true` 返回三种到账速度 + 推荐） |
| POST | `/api/offering/simulate` | 模拟 RWA 发行、认购、改价、暂停、结算（`events` 可在途中升级风险） |
| POST | `/api/workflow/pricing-simulate` | 合并 PricingQuote + RiskReport + offering 生命周期为一次模拟 |
| POST | `/api/oracle/pricing-update` | 返回链上 oracle 更新载荷（issue price/risk/action + quote_hash/evidence_hash） |
| GET | `/api/scenarios` | 返回多场景回归摘要 |
| POST | `/api/scenarios/run` | 跑单个场景 |
| GET | `/api/mcp/tools` | MCP 工具清单 |
| POST | `/api/mcp/call` | 调用 MCP 工具 |
| POST | `/api/rag/search` | 检索风险情报知识库 |
| GET | `/api/rag/judge-qa` | 评委 Q&A 问答对 |

POST API 的 body 可以为空。为空时会自动读取：

```text
data/demo-case.json
```

---

## 20. 目录结构

```text
.
├── README.md                   # 项目介绍 + 使用指南（新）
├── 基础说明.md                 # 本文件：团队协作与上手基础
├── Makefile
├── package.json
├── .env.example
├── data/
│   ├── demo-case.json          # legacy seed (RiskReport 引擎)
│   ├── scenarios/              # 多场景回归 fixtures
│   ├── pricing-scenarios/      # AI 定价场景 fixtures
│   ├── uploads/                # 拟真上传单据：eBL + 商业发票（新加坡铜 / 原油）
│   ├── cases/                  # 结构化 case（对齐新模型 PricingQuote 字段）
│   └── risk-intel/             # RAG 风险情报 feed
├── docs/
│   ├── background.md
│   ├── PRD.md
│   ├── tasks.md
│   ├── acceptance.md
│   ├── contracts.md
│   ├── award-roadmap.md
│   └── ai-valuation-tooling.md
├── public/                     # 前端（零依赖 ES module SPA）
│   ├── index.html
│   ├── app.js
│   ├── api.js
│   ├── format.js
│   └── styles.css
├── scripts/
│   ├── check.mjs / demo.mjs / smoke.mjs / scenarios.mjs
│   ├── price.mjs / pricing-scenarios.mjs / agent-valuation.mjs
│   ├── judge-qa.mjs / mcp.mjs / install.mjs
├── src/
│   ├── app/server.js
│   ├── core/                   # pricingEngine / pricingSchema / offeringSimulator / oracle / ...
│   ├── agent/                  # AI 估值 tool calling + LLM client + 文档一致性 + 风险情报
│   ├── mcp/                    # MCP server + tools
│   ├── rag/                    # 知识库 + 检索 + judge QA
│   └── skill/                  # pricingAnalyst / demoOperator
├── hardhat/                    # Solidity 合约（RiskPricingOracle / RWAOfferingPool / ...）
└── tests/                      # node --test
```

---

## 21. 当前不做什么

本仓库刻意不做：

- 开放式二级市场；
- AMM；
- 真实 KYC；
- 真实跨境支付；
- 真实 AIS 船舶数据接入；
- 真实 OCR 高精度审单；
- 真实智能合约主网部署；
- 面向公众募资；
- 保本保收益承诺。

这些不是忘了做，而是为了让 48 小时黑客松主流程稳定。

---

## 22. 提交 PR 前最终检查清单

提交 PR 前，请逐项确认：

```text
[ ] 我已经从最新 main 开了自己的分支
[ ] 我已经在 docs/tasks.md 认领任务
[ ] 我的改动只包含本任务相关文件
[ ] 我没有提交 API Key、私钥、密码、本地临时文件
[ ] 我已经跑过任务要求的验证命令
[ ] 我已经把验证结果写进 PR 描述
[ ] 如果改了页面，我手动打开 http://localhost:3000 看过
[ ] 如果改了主流程，我跑过 npm run smoke 和 npm run demo
[ ] PR 标题包含任务 ID
[ ] PR 描述说明了做了什么、如何验证、有什么风险
```

最低验证：

```bash
npm run check
npm run test
```

主流程相关验证：

```bash
npm run check
npm run test
npm run smoke
npm run demo
```

---

## 23. 最后 6 小时规则

进入黑客松最后 6 小时：

- 不再新增大功能；
- 只修影响演示的 bug；
- 保持 CLI demo 可用；
- 保持 Web 页面可用；
- `npm run check`、`npm run test`、`npm run smoke` 必须通过；
- 如果 AI provider 挂了，用 mock fallback；
- 如果网页挂了，用 `npm run demo` 兜底演示。

这时最重要的不是"再多做一个功能"，而是：

> 主流程稳定，演示讲得清楚，评委看得懂。

---

## 24. 一句话记住协作规则

```text
先读文档
→ 跑通 Harness
→ 领取任务
→ 开分支
→ 小步修改
→ 跑验证
→ 提交 commit
→ push 分支
→ 创建 PR
→ review 后合并
```

如果你是小白，不知道下一步做什么，先跑：

```bash
npm run check
npm run demo
```

然后去 `docs/tasks.md` 选一个 `Unassigned` 的小任务。稳稳地来，项目就会一点点长起来。

---

## 25. Scenario Harness

为了让项目更接近真实参赛作品，Harness 支持多场景回归：

```bash
npm run scenarios
```

它会跑两套引擎的回归：

```text
1. legacy RiskReport 谐波：data/demo-case.json + data/scenarios/*.json
   （低风险批准、预警保证金、严重风险清算）
2. AI 动态定价场景：data/pricing-scenarios/*.json
   （fast / balanced 正常开盘、high-risk 途中降价 reprice、high-risk 暂停 pause）
```

第 2 套直接驱动 AI 定价引擎（risk discount = AI-4，high-risk pause/reprice = AI-10），
所以 `npm run scenarios` 是这两个 AI 任务的验证命令。以后新增 AI、MCP、RAG、合约或前端功能时，
至少要说明它影响哪个 scenario，并跑：

```bash
npm run check
npm run test
npm run smoke
npm run scenarios
```

## 26. Judge Q&A assistant（AI-12）

彩排时用来回答评委追问的接地气问答助手（默认离线、确定性，可选 LLM 润色并自动兜底）：

```bash
npm run qa                          # 跑完整评委彩排问答（6 个标准问题）
npm run qa -- "why discount to 0.80?"   # 回答单个自由问题
npm run qa -- --llm "is it guaranteed?"  # 让已配置的 LLM 润色（出错自动回退到确定性答案）
```

每个回答都用**真实定价引擎数字**（`compareSpeeds` / `quoteFromCase`）和**检索到的风险情报引用**
（`src/agent/riskIntel.js`）拼出，所以助手永远不会和定价引擎自相矛盾，也始终保留
"target redemption 不是保本" 的合规口径。实现见 `src/agent/judgeAssistant.js`。
