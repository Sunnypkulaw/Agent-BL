# Wave B：链上可信与 Agent 可组合

状态：**Gate B 已达成（Injective Testnet，2026-06-29）**。

## 1. 可追溯的付费定价闭环

同一个 `report_hash` 将真实付费报告与链上定价连接起来：

```text
0.001 USDC payment
  → PaidReportEnvelope.report_hash
  → PaymentOracle.PaymentAttested.reportHash
  → RiskPricingOracle.PricingUpdated.evidenceHash
  → RWAOfferingPool #2 final quote = $0.80
```

| 证据 | 值 |
|---|---|
| USDC payment tx | [`0x6d796d…a0b49`](https://testnet.blockscout.injective.network/tx/0x6d796d39de0de3becd57f2c8b0ff72e6baf33e570259530cb294ff819d1a0b49) |
| PaidReportEnvelope hash | `0x994078c73bdb44f13007d7b6ff4ea899ff9dc44d11f1d3afae1320df418168ce` |
| `PaymentAttested` tx | [`0xa03ab9…ef6e`](https://testnet.blockscout.injective.network/tx/0xa03ab9622dbc1af7bd448af2a52b5322963abf65853916dc13c75a139adfef6e) |
| `PricingUpdated` tx | [`0xee6b65…bac3`](https://testnet.blockscout.injective.network/tx/0xee6b6520c040662f3644c2514de628baa2351abe185623e9c22dbbcab76bbac3) |
| 最终报价 | pool `2`，`$0.80`，`OPEN_OFFERING` |

公开证据见 [`evidence/wave-b-gate.json`](./evidence/wave-b-gate.json)。付费报告正文不公开，证据文件只保留通过运行时 schema 校验的承诺与脱敏字段。

## 2. Injective Testnet 五合约协议

| 合约 | 地址 | 部署交易 |
|---|---|---|
| AgentBLRWA | [`0x1e4998…48Ab`](https://testnet.blockscout.injective.network/address/0x1e499819cfbD847a3152CdFaD313C3229b9148Ab) | [`0xd66686…819e`](https://testnet.blockscout.injective.network/tx/0xd666868dadc99a1020a697ba71e40e8886c2dbe382259cefef65ba581749819e) |
| EBLRegistry V2 | [`0x99eBa4…d6ae`](https://testnet.blockscout.injective.network/address/0x99eBa4CD00B6650cac7dc57F3b1fB4Ed03Cfd6ae) | [`0xec930a…d808`](https://testnet.blockscout.injective.network/tx/0xec930a68ac9ab9a2f6d5d9c6f1c12be165708a6603d722e9d8bb3e0aba96d808) |
| RWAToken | [`0xDD32B1…2668`](https://testnet.blockscout.injective.network/address/0xDD32B186536d05d0E6218dAA834B5EB312642668) | [`0x1be641…7e55`](https://testnet.blockscout.injective.network/tx/0x1be641cf6d6d6cdfdbff557277019974b908f13cb7c41e276223a2e692c17e55) |
| RWAOfferingPool | [`0x61ac2E…529d`](https://testnet.blockscout.injective.network/address/0x61ac2E4E261fCa58725e5fe8a2E1aBEd48d6529d) | [`0x5a915a…6724`](https://testnet.blockscout.injective.network/tx/0x5a915ad39ba7421301c6d714c87496425b00a93a38ac4d9727b8df1cf1536724) |
| RiskPricingOracle | [`0xaE19a6…618b`](https://testnet.blockscout.injective.network/address/0xaE19a62e26B17B32B183DC89b365da898987618b) | [`0x24f3fc…2d78`](https://testnet.blockscout.injective.network/tx/0x24f3fcf0f34ea73f0f2e1da3be1de4fef5d56d3a8ee40d93937ddabf00782d78) |

部署脚本会合并而非覆盖 `public/chain-config.json`，随后执行 `mintEBLV2 → pledge → create → subscribe → reprice → pause → resume → settle`。最终链上状态为 `Repaid`，完整交易清单见 [`evidence/wave-b-protocol.json`](./evidence/wave-b-protocol.json)。

## 3. 标准 MCP：7 tools + 3 resources

`npm run mcp:stdio` 使用官方 Model Context Protocol SDK 和 stdio transport，支持 `initialize/listTools/callTool/listResources/readResource`，stdout 仅承载协议帧。

Tools：

1. `get_trade_case`
2. `generate_pricing_quote`
3. `search_knowledge_base`
4. `verify_trade_documents`
5. `purchase_premium_analysis`
6. `simulate_offering`
7. `push_pricing_to_oracle`

Resources：

1. `agentbl://cases/catalog`
2. `agentbl://risk/methodology`
3. `agentbl://contracts/deployments`

所有资源固定为 `application/json`，只公开摘要；未知 URI 返回协议错误。`tests/mcpProtocol.test.js` 通过真实 SDK client 对 7 个工具逐一调用并读取 3 个资源。

## 4. 官方 Injective MCP adapter 与安全边界

AgentBL 通过 `InjectiveMcpAdapter` 调用 InjectiveLabs 官方 MCP Server 的 `usdc_native_info` 与 `evm_broadcast`。已完成一次查询和一笔指向 allowlist 合约、value 为 0 的受控 testnet EVM 交易：[`0x1578c1…984f`](https://testnet.blockscout.injective.network/tx/0x1578c10144a6216d8580eabc1497ee02c99a435c20cd315c1492fc0d78d8984f)。脱敏 tool trace 见 [`evidence/injective-mcp-smoke.json`](./evidence/injective-mcp-smoke.json)。

所有写操作均 fail-closed：网络固定 `eip155:1439`、目标来自本地部署 allowlist、金额上限 `0.005 USDC`、默认 dry-run。真实写入必须同时具备 `approved=true` 与不进入模型上下文的本地 `MCP_HUMAN_APPROVAL_TOKEN`；raw-EVM smoke 还只允许 `nextPoolId()` 的 selector `0x18e56131`。prompt 或单据正文不参与授权判断。

当前官方 MCP 源码构造 `MsgEthereumTx` 时缺少 protobuf `from` 字段，testnet ante handler 会返回 `sender address missing`。复现官方 raw EVM smoke 前，对官方 checkout 应用仓库中的最小兼容补丁：

```bash
git -C <injective-mcp-server> apply <agentbl>/patches/injective-mcp-msg-sender.patch
npm --prefix <injective-mcp-server> run build
```

AgentBL adapter 另外固定非零 gas price，并将 Ethereum extension 交易的 Cosmos memo 留空；这些是协议兼容参数，不会放宽上述安全策略。

## 5. 复验命令

```bash
npm test
npm --prefix hardhat test
npm run verify:wave-b
npm run mcp:stdio
MCP_LIVE_CONFIRM=injective-testnet npm run smoke:mcp:injective
                              # 需要测试网私钥、gas 与官方 MCP build
npm run preflight
```

`verify:wave-b` 会再次读取 explorer 交易与事件并生成 Gate B 证据；它会发送新的 eBL / offering / pricing testnet 交易。普通离线验收只需 `npm test`，不会自动花费或写链。
