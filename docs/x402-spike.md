# Injective x402 兼容性 Spike（X402-1）

> 核验时间：2026-06-29 04:50–05:05 CST（UTC+8）  
> 结论状态：**SDK 兼容；Injective Testnet facilitator 可发现；Mainnet facilitator 未验证**

## 1. 结论与项目决策

AgentBL 可以采用官方 `@injectivelabs/x402`，但必须区分“SDK 支持”和“facilitator 已支持”：

| 层级 | 核验结论 | AgentBL 决策 |
|---|---|---|
| npm SDK | `latest=0.0.1`，`next=0.1.0-rc.1`；内置 `eip155:1776` 与 `eip155:1439` | X402-2 锁定稳定版 `0.0.1`，不使用 RC |
| Runtime | npm 包要求 Node `>=20`；AgentBL 实测 Node `v22.9.0` | 接入时把项目 `engines.node` 从 `>=18.18.0` 提升到 `>=20` |
| Web framework | `express` 是 optional peer dependency，允许 `^4 || ^5`，不会随包自动安装 | 使用官方 middleware 时必须显式安装并锁定 Express；不要假设已有 `node:http` server 已满足依赖 |
| Testnet | 官方 Demo 的 `/supported` 实际返回 `exact + eip155:1439 + Testnet USDC + EIP-3009` | 允许用一次性测试钱包做真实测试网 smoke，并在 UI/CLI 显示 `TESTNET` |
| Mainnet | 文档示例使用 `eip155:1776`，SDK 也内置主网；但本次没有发现可通过 `/supported` 验证的 HTTPS 生产 facilitator | 先保留 mainnet 配置能力，默认禁用；X402-15 前必须重新验活，不能宣称主网实付 |
| Demo settlement | 不依赖 facilitator，不是真实链上支付 | 必须显示 `DEMO SETTLEMENT · NOT ONCHAIN`；不得生成可点击的伪 tx/explorer 链接 |

因此，当前实施路线是：

1. 默认开发链路：`eip155:1439` + Testnet USDC + 官方 V2/EIP-3009 challenge。
2. CI 和离线路演：显式 Demo settlement，所有 receipt 使用 `demo_` 前缀且 `onchain=false`。
3. Mainnet live：只有当 HTTPS facilitator 的 `/supported` 同时返回 `eip155:1776`、正确 USDC 地址和 `exact/eip3009` 时才能开启。
4. 当前发现的测试网 facilitator 是 staging 明文 HTTP ELB，只允许隔离的一次性测试钱包；不得承载主网签名、生产密钥或真实资金。

## 2. 版本与依赖核验

执行：

```powershell
node --version
npm.cmd --version
npm.cmd view @injectivelabs/x402 version dist-tags engines dependencies peerDependencies exports repository time --json
```

实际摘要：

```text
Node: v22.9.0
npm:  11.17.0

@injectivelabs/x402:
  latest: 0.0.1
  next:   0.1.0-rc.1
  node:   >=20
  dependencies:
    viem: ^2.39.3
    zod:  ^3.23.8
  peerDependencies:
    express: ^4.0.0 || ^5.0.0
  module: ESM only
```

`0.0.1` 和 `0.1.0-rc.1` 均于 2026-05-13 发布。`0.0.1` 的 Express peer dependency 被标为 optional，原因是 core/client/facilitator exports 不一定使用 Express；但导入 `@injectivelabs/x402/middleware` 时，应用仍必须自己提供 Express。

### 文档与包约束冲突

Injective x402 教程写的是 Node.js 18+，已发布 npm 包的 `engines` 却是 Node `>=20`。实现必须服从可执行包的更严格约束，即 **Node >=20**。AgentBL 当前运行环境满足；`package.json` 中原有的 `>=18.18.0` 只在 X402-2 安装依赖时调整，本 spike 不改运行时依赖。

## 3. 网络与资产矩阵

| 环境 | CAIP-2 | Chain ID | USDC | Decimals | EIP-3009 | RPC | Explorer |
|---|---|---:|---|---:|---|---|---|
| Mainnet | `eip155:1776` | 1776 | `0xa00C59fF5a080D2b954d0c75e46E22a0c371235a` | 6 | 是，EIP-712 version `2` | `https://sentry.evm-rpc.injective.network` | `https://blockscout.injective.network` |
| Testnet | `eip155:1439` | 1439 | `0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d` | 6 | 是，EIP-712 version `2` | `https://k8s.testnet.json-rpc.injective.network` | `https://testnet.blockscout.injective.network` |

官方包的网络注册表同时包含两条链，并明确把两份 USDC 标记为 Circle FiatTokenV2_2、`TransferWithAuthorization`。USDT、WINJ 和旧 IBC USDC 不具备 EIP-3009，不能替换为 x402 支付资产。

## 4. 实际 HTTP 请求与响应

以下是现场请求的关键字段；支付 challenge 的 Base64 header 只保留标记，解码内容来自同一响应 JSON。

### 4.1 官方 Demo 状态

```http
GET https://agents.injective.com/api/x402/status

HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "mode": "live",
  "configured": true,
  "available": true,
  "network": "eip155:1439",
  "usdcAddress": "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d",
  "priceUsdc": "0.01",
  "amountAtomic": "10000",
  "facilitator": {
    "status": "configured",
    "url": "http://x402-staging-alb-1300061645.us-east-1.elb.amazonaws.com",
    "missing": []
  }
}
```

结论：官方 Demo 当前实际运行在 Testnet，不是教程示例中的 Mainnet；公开状态端点暴露的是 staging HTTP facilitator。

### 4.2 未支付资源返回标准 V2 challenge

```http
GET https://agents.injective.com/api/x402/perps/market-data

HTTP/1.1 402 Payment Required
Access-Control-Expose-Headers: PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE
Payment-Required: <base64 omitted>
Content-Type: application/json
```

响应中的核心 payment requirements：

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:1439",
      "amount": "10000",
      "asset": "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d",
      "payTo": "0x2968698c6b9ed6d44b667a0b1f312a3b5d94ded7",
      "maxTimeoutSeconds": 60,
      "extra": {
        "name": "USDC",
        "version": "2",
        "assetTransferMethod": "eip3009",
        "chainId": 1439,
        "primaryType": "TransferWithAuthorization"
      }
    }
  ],
  "extensions": {
    "mode": "live",
    "facilitatorStatus": "configured"
  }
}
```

这证明 402、V2 headers、CAIP-2、Testnet USDC 和 EIP-3009 challenge 均已由官方 Demo 实际返回；它不证明结算成功，真实 settlement tx 仍由 X402-15 验收。

### 4.3 Facilitator `/supported`

```http
GET http://x402-staging-alb-1300061645.us-east-1.elb.amazonaws.com/supported

HTTP/1.1 200 OK
Content-Type: application/json
x-request-id: dc77196a-ac21-4e12-8665-c88f33d3b967
```

```json
{
  "kinds": [
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:1439",
      "extra": {
        "supportedAssets": [
          {
            "address": "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d",
            "decimals": 6,
            "assetTransferMethod": "eip3009",
            "eip712": {
              "name": "USDC",
              "version": "2",
              "primaryType": "TransferWithAuthorization"
            }
          }
        ]
      }
    }
  ],
  "extensions": [],
  "signers": {
    "eip155:1439": ["0x7a6d1bb95b3AC77EcFBF3D3EB92E4e5a7df2b57c"]
  }
}
```

判定：**1439 支持；1776 未列出。** `/supported` 是运行时真相，SDK 里存在 `eip155:1776` 常量不能替代这项验证。

### 4.4 负向可用性探测

```text
GET https://x402-staging-alb-1300061645.us-east-1.elb.amazonaws.com/supported
=> curl: (28) Connection timed out after 30010 milliseconds

GET https://x402.injective.network/supported
=> curl: (6) Could not resolve host: x402.injective.network
```

因此当前发现的 facilitator 不能作为 AgentBL 的生产依赖。X402-3 必须允许配置 URL；X402-4/6 启动或执行前必须调用 `/supported` fail closed，而不是硬编码或静默回退为“成功”。

## 5. X402-2/3/4 的实施约束

### 依赖选择

```text
必须：@injectivelabs/x402@0.0.1
必须（使用官方 middleware 时）：express，版本锁在官方 peer range 内
暂不加入：@x402/core / @x402/evm / @x402/fetch
```

只有官方客户端能力缺失并有测试证明时，才引入 x402 Foundation 包，避免两套协议对象和 headers 并存。

### 启动门禁

Live mode 启动必须满足：

```text
GET {facilitatorUrl}/supported == 200
kinds 包含 x402Version=2
scheme == exact
network == 配置的 CAIP-2
supportedAssets 包含配置的 USDC 地址（忽略大小写）
decimals == 6
assetTransferMethod == eip3009
HTTPS：mainnet 强制；testnet staging 只允许显式 ALLOW_INSECURE_TESTNET=true
```

任一条件不满足就拒绝 Live mode，不得自动伪装为已结算。Demo mode 可以继续运行，但返回结构必须包含：

```json
{
  "mode": "demo",
  "onchain": false,
  "settlement": "simulated",
  "txHash": null,
  "explorerUrl": null
}
```

### Live 支持矩阵

| 模式 | 当前允许 | 对外文案 | 真实 tx 要求 |
|---|---|---|---|
| Demo | 是，默认 | `Demo settlement · not onchain` | 无，且不得伪造 |
| Testnet 1439 | 条件允许 | `Injective Testnet payment` | X402-15 保存 Testnet explorer tx；一次性钱包；允许 insecure staging 必须显式 opt-in |
| Mainnet 1776 | 否，默认关闭 | 不展示 `live` / `paid onchain` | HTTPS `/supported` 验出 1776 + 主网 USDC 后，再做小额实付 |

## 6. 已知风险

1. npm 包还是 `0.0.1`，API 稳定性较低；必须锁版本并用 contract tests 固定 challenge/settlement schema。
2. 官方教程的 Node 18+ 与 npm 的 Node >=20 不一致；CI 以 >=20 为准。
3. 官方教程突出 Mainnet，但官方 Demo 当前返回 Testnet；路演必须展示响应中的实际 network。
4. staging facilitator 只有 HTTP，签名 payload 可能被监听或抢先提交；只限无价值测试资产和一次性钱包。
5. `/supported` 未列出 1776；在生产 facilitator 可验证前，主网只算 SDK/config 支持，不算已集成。
6. Demo 页面当前链接的 `InjectiveLabs/x402-facilitator-injective` 公共仓库返回 404；不要把不可访问源码写成“已审计开源 facilitator”。

## 7. 复验命令

```powershell
npm.cmd view @injectivelabs/x402 version dist-tags engines dependencies peerDependencies --json
curl.exe -sS -D - --max-time 30 https://agents.injective.com/api/x402/status
curl.exe -sS -D - --max-time 30 https://agents.injective.com/api/x402/perps/market-data
curl.exe -sS -D - --max-time 30 http://x402-staging-alb-1300061645.us-east-1.elb.amazonaws.com/supported
```

facilitator 是外部运行时依赖，以上探测结果有时效性。X402-15 和每次路演 preflight 都必须重新执行，不能仅引用本文件的历史响应。

## 8. 资料来源

- [Injective x402 官方教程](https://docs.injective.network/developers-ai/x402)
- [Injective EVM Network Information](https://docs.injective.network/developers-evm/network-information)
- [USDC on Injective](https://docs.injective.network/developers-defi/usdc-stablecoin)
- [npm: @injectivelabs/x402](https://www.npmjs.com/package/@injectivelabs/x402)
- [已发布包的 network registry](https://unpkg.com/@injectivelabs/x402@0.0.1/dist/networks/index.js)
- [Injective 官方 x402 Demo](https://agents.injective.com/x402/)
- [x402 Network & Token Support](https://docs.x402.org/core-concepts/network-and-token-support)

