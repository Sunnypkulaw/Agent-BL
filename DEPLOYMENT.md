# 🚀 AgentBL 部署指南

本文档提供多种将 AgentBL 部署为网页应用的方案。

---

## 📋 部署前准备

### 1. 环境变量配置

在部署平台上配置以下环境变量（从 `.env` 文件中获取）：

```bash
# 核心配置
INJECTIVE_NETWORK=testnet
INJECTIVE_CHAIN_ID=injective-888
PRIVATE_KEY=你的私钥

# Azure OpenAI（如果使用 AI 功能）
AZURE_OPENAI_ENDPOINT=你的端点
AZURE_OPENAI_API_KEY=你的密钥
AZURE_OPENAI_DEPLOYMENT_NAME=你的部署名称

# 合约地址
AGENTBL_RWA_ADDRESS=你的合约地址
```

⚠️ **重要**: 绝不要将 `.env` 文件提交到 Git 仓库！

---

## 方案 1: Vercel 部署（推荐 ⭐）

### 为什么选择 Vercel？
- ✅ 零配置部署
- ✅ 自动 HTTPS
- ✅ 全球 CDN 加速
- ✅ 免费额度足够个人项目
- ✅ 自动从 Git 部署

### 部署步骤

#### A. 通过 Vercel CLI（本地部署）

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   # 首次部署（会引导你配置项目）
   vercel
   
   # 生产环境部署
   vercel --prod
   ```

4. **配置环境变量**
   ```bash
   # 方式1: 通过 CLI
   vercel env add INJECTIVE_NETWORK
   vercel env add PRIVATE_KEY
   vercel env add AZURE_OPENAI_API_KEY
   
   # 方式2: 通过 Web 界面
   # 访问 vercel.com → 你的项目 → Settings → Environment Variables
   ```

5. **重新部署**（添加环境变量后）
   ```bash
   vercel --prod
   ```

#### B. 通过 Vercel Web 界面（推荐）

1. **准备 Git 仓库**
   ```bash
   git add .
   git commit -m "准备 Vercel 部署"
   git push origin main
   ```

2. **连接 Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 点击 "Import Project"
   - 选择你的 GitHub 仓库
   - Vercel 会自动检测配置

3. **配置环境变量**
   在 Vercel 项目设置中添加：
   - `INJECTIVE_NETWORK`
   - `PRIVATE_KEY`
   - `AZURE_OPENAI_API_KEY`
   - 等其他必需变量

4. **部署**
   - 点击 "Deploy"
   - 等待构建完成
   - 访问提供的 URL

#### C. 自定义域名（可选）

在 Vercel 项目设置中：
1. Settings → Domains
2. 添加你的域名
3. 按照指引配置 DNS

---

## 方案 2: Netlify 部署

### 部署步骤

1. **创建 `netlify.toml`**（已为你创建，见下方）

2. **通过 Netlify CLI**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify init
   netlify deploy --prod
   ```

3. **通过 Web 界面**
   - 访问 [netlify.com](https://netlify.com)
   - Import from Git
   - 选择仓库
   - 配置环境变量
   - Deploy

---

## 方案 3: Railway 部署

适合需要长期运行进程的场景。

### 部署步骤

1. **访问 [railway.app](https://railway.app)**

2. **New Project → Deploy from GitHub**

3. **配置**
   - 选择仓库
   - Railway 会自动检测 Node.js 项目
   - 添加环境变量

4. **启动命令**
   ```bash
   npm run dev
   ```

---

## 方案 4: 自托管（VPS/云服务器）

适合需要完全控制的场景。

### 使用 PM2 部署

1. **安装依赖**
   ```bash
   npm install
   npm install -g pm2
   ```

2. **启动应用**
   ```bash
   pm2 start src/app/server.js --name agentbl
   pm2 save
   pm2 startup
   ```

3. **配置 Nginx 反向代理**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **配置 HTTPS**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

---

## 方案 5: Docker 部署

### Dockerfile（已为你创建，见下方）

1. **构建镜像**
   ```bash
   docker build -t agentbl .
   ```

2. **运行容器**
   ```bash
   docker run -p 3000:3000 --env-file .env agentbl
   ```

3. **使用 Docker Compose**
   ```bash
   docker-compose up -d
   ```

---

## 🔧 部署后验证

### 检查清单

- [ ] 网站可以访问
- [ ] 静态资源加载正常（图片、CSS、JS）
- [ ] API 端点响应正常：
  - `GET /api/health` - 健康检查
  - `GET /api/cases` - 案例列表
  - `POST /api/price` - 定价接口
- [ ] WebSocket 连接正常（如果使用）
- [ ] 区块链连接正常
- [ ] AI 功能正常（如果启用）

### 测试命令

```bash
# 健康检查
curl https://your-domain.com/api/health

# 获取案例列表
curl https://your-domain.com/api/cases

# 测试定价（使用示例数据）
curl -X POST https://your-domain.com/api/price \
  -H "Content-Type: application/json" \
  -d @data/demo-case.json
```

---

## 🐛 常见问题

### 1. 环境变量未加载

**症状**: API 返回错误，提示缺少配置

**解决**:
- 确认在部署平台上配置了所有必需的环境变量
- 检查变量名是否正确（区分大小写）
- 重新部署项目

### 2. 静态文件 404

**症状**: 页面显示但样式丢失

**解决**:
- 确认 `public` 目录已包含在部署中
- 检查 `.vercelignore` 或 `.gitignore` 未排除 `public`

### 3. API 超时

**症状**: 请求长时间无响应

**解决**:
- Vercel Serverless Functions 有 10 秒超时限制
- 考虑将长时间运行的任务改为异步处理
- 或使用 Railway/自托管方案

### 4. CORS 错误

**症状**: 浏览器控制台显示跨域错误

**解决**: 服务器已配置 CORS，如果仍有问题，检查：
- API 路径是否正确
- 是否使用了正确的 HTTP 方法

---

## 📊 性能优化建议

### 生产环境优化

1. **启用压缩**（Vercel 自动启用）

2. **缓存静态资源**
   ```javascript
   // 在服务器中设置缓存头
   res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
   ```

3. **CDN 加速**
   - Vercel/Netlify 自带全球 CDN
   - 自托管可使用 Cloudflare

4. **监控**
   - 使用 Vercel Analytics
   - 或集成 Google Analytics

---

## 🔒 安全建议

1. **环境变量**
   - 永远不要提交 `.env` 到 Git
   - 使用平台提供的环境变量管理

2. **API 密钥**
   - 定期轮换密钥
   - 限制密钥权限范围

3. **HTTPS**
   - 确保使用 HTTPS（Vercel 自动配置）
   - 强制重定向 HTTP 到 HTTPS

4. **Rate Limiting**
   - 考虑添加请求频率限制
   - 防止 API 滥用

---

## 📞 获取帮助

- **GitHub Issues**: [github.com/LuBryant/AgentBL/issues](https://github.com/LuBryant/AgentBL/issues)
- **项目文档**: 查看 `README.md`
- **Vercel 文档**: [vercel.com/docs](https://vercel.com/docs)

---

## 🎉 快速开始（推荐路径）

**最快的部署方式**（5 分钟内完成）:

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel --prod

# 4. 配置环境变量（通过 Web 界面）
# 访问 vercel.com → 你的项目 → Settings → Environment Variables

# 5. 重新部署
vercel --prod
```

完成！你的 AgentBL 现在已经在线了 🚀
