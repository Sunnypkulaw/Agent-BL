# ✅ AgentBL 部署检查清单

在部署之前，请确保完成以下步骤：

## 📋 部署前检查

### 1. 代码准备
- [ ] 所有代码已提交到 Git
- [ ] 没有未跟踪的重要文件
- [ ] `.gitignore` 正确配置（已排除 `.env`、`node_modules`）

### 2. 环境变量
- [ ] 已准备好所有必需的环境变量
- [ ] 私钥安全保存（不在代码库中）
- [ ] API 密钥有效且有足够配额

### 3. 依赖检查
- [ ] `package.json` 依赖完整
- [ ] 本地可以正常运行 (`npm run dev`)
- [ ] 测试通过 (`npm test`)

### 4. 静态资源
- [ ] `public` 目录包含所有必需文件
- [ ] 图片、CSS、JS 文件路径正确
- [ ] `index.html` 正确引用资源

---

## 🚀 快速部署命令

### 方式 1: 使用部署脚本（推荐）
```bash
npm run deploy
```

### 方式 2: 直接使用 Vercel CLI
```bash
# 预览部署
npm run deploy:vercel

# 生产部署
npm run deploy:vercel:prod
```

### 方式 3: 手动部署
```bash
# 1. 登录 Vercel
vercel login

# 2. 部署
vercel --prod
```

---

## 🔧 部署后配置

### 在 Vercel 面板中配置环境变量

1. 访问 https://vercel.com
2. 选择你的项目
3. Settings → Environment Variables
4. 添加以下变量：

#### 必需变量
```
INJECTIVE_NETWORK=testnet
INJECTIVE_CHAIN_ID=injective-888
PRIVATE_KEY=你的私钥
```

#### AI 功能变量（如果使用）
```
AZURE_OPENAI_ENDPOINT=你的端点
AZURE_OPENAI_API_KEY=你的密钥
AZURE_OPENAI_DEPLOYMENT_NAME=你的部署名称
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

#### 智能合约地址
```
AGENTBL_RWA_ADDRESS=你的合约地址
EBL_REGISTRY_ADDRESS=你的注册表地址
RWA_OFFERING_POOL_ADDRESS=你的资金池地址
RISK_PRICING_ORACLE_ADDRESS=你的预言机地址
RWA_TOKEN_ADDRESS=你的代币地址
```

5. 保存后重新部署：
```bash
vercel --prod
```

---

## ✅ 部署验证

### 1. 基础检查
```bash
# 访问首页
curl https://your-domain.vercel.app/

# 健康检查
curl https://your-domain.vercel.app/api/health

# 案例列表
curl https://your-domain.vercel.app/api/cases
```

### 2. 功能测试
- [ ] 网页可以正常打开
- [ ] 样式显示正常
- [ ] 可以选择贸易案例
- [ ] AI 定价功能正常
- [ ] 区块链连接正常
- [ ] 钱包可以连接

### 3. 性能检查
- [ ] 首页加载时间 < 3 秒
- [ ] API 响应时间 < 1 秒
- [ ] 无控制台错误

---

## 🐛 常见问题排查

### 问题 1: 部署失败
```bash
# 检查 Vercel 登录状态
vercel whoami

# 重新登录
vercel login

# 清除缓存重试
vercel --prod --force
```

### 问题 2: 环境变量未生效
- 确认在 Vercel 面板中已添加
- 检查变量名拼写（区分大小写）
- 添加变量后需要重新部署

### 问题 3: API 404 错误
- 检查 `vercel.json` 配置
- 确认 `api/index.js` 存在
- 查看 Vercel 部署日志

### 问题 4: 静态资源 404
- 确认 `public` 目录未被忽略
- 检查 `.vercelignore` 文件
- 确认资源路径正确

---

## 📊 监控和维护

### 查看日志
1. Vercel Dashboard → 你的项目 → Deployments
2. 点击最新部署 → Runtime Logs

### 性能监控
- 启用 Vercel Analytics
- 查看访问量和响应时间
- 监控错误率

### 更新部署
```bash
# 代码更新后
git add .
git commit -m "更新说明"
git push

# 如果开启了自动部署，Vercel 会自动重新部署
# 或手动触发：
vercel --prod
```

---

## 🎉 部署成功！

你的 AgentBL 应用现在已经在线：
- 🌐 生产地址: `https://your-project.vercel.app`
- 📊 管理面板: `https://vercel.com/dashboard`
- 📖 部署文档: 查看 `DEPLOYMENT.md`

---

## 📞 需要帮助？

- **部署文档**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **项目文档**: [README.md](./README.md)
- **GitHub**: [github.com/LuBryant/AgentBL](https://github.com/LuBryant/AgentBL)
- **Vercel 支持**: [vercel.com/support](https://vercel.com/support)
