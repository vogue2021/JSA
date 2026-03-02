# JSA Staging 环境 — Git 集成设置指南

> 由于 Cloudflare Wrangler CLI 不支持通过命令行配置 Pages Git 集成，需要在 Dashboard 手动操作。
> 旧的 `jsa-staging` 项目（无 Git 集成）已删除，请按以下步骤重新创建。

## 🚀 步骤1：在 Cloudflare Dashboard 创建新的 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → 点击 **Create**
3. 选择 **Pages** → **Connect to Git**
4. 选择 GitHub → 授权并选择仓库 `vogue2021/JSA`
5. 项目配置：
   - **Project name**: `jsa-staging`
   - **Production branch**: `develop`（⚠️ 这里选 develop，不是 main）
   - **Build settings**:
     - **Framework preset**: None
     - **Build command**: `npm run build -- --mode staging`
     - **Build output directory**: `dist`

6. 点击 **Save and Deploy**

## 🔧 步骤2：配置环境变量

部署完成后，进入 **jsa-staging** 项目设置：

1. 进入 **Settings** → **Environment variables**
2. 添加以下变量（**Production** 和 **Preview** 都要设置）：

| 变量名 | 值 | 类型 |
|--------|------|------|
| `API_BACKEND_URL` | `https://jsa-api-staging.jiangpeng527.workers.dev` | Plain text |

> 这个环境变量告诉 `functions/api/[[path]].js` 将 API 请求代理到 staging Worker 而不是生产 Worker。

## 🌿 步骤3：配置分支部署规则（可选）

进入 **Settings** → **Builds & deployments**：

1. **Production branch**: `develop`
2. **Preview branches**: 可以设为 `feature/*` 等，用于 PR 预览
3. **Branch build controls**: 可以选择 "Include" 模式，只构建 `develop` 分支

## ✅ 完成后的效果

设置完成后的自动化流程：

```
develop 分支 push → Cloudflare 自动构建 jsa-staging
                   → 部署到 jsa-staging.pages.dev
                   → 通过 Pages Function 代理 API 到 jsa-api-staging Worker
                   → 访问 jsa-db-staging 数据库
```

## 🔄 环境对比

| 维度 | 生产环境 (jsa) | 测试环境 (jsa-staging) |
|------|---------------|----------------------|
| Git 分支 | `main` | `develop` |
| Pages 域名 | `jsa-ac8.pages.dev` | `jsa-staging.pages.dev` |
| Worker API | `jsa-api.jiangpeng527.workers.dev` | `jsa-api-staging.jiangpeng527.workers.dev` |
| D1 数据库 | `jsa-db` | `jsa-db-staging` |
| 自动构建 | ✅ push to main 自动部署 | ✅ push to develop 自动部署（配置后） |

## ⚠️ 注意事项

1. **Worker 不会自动部署**：Pages Git 集成只自动构建前端。后端 Worker 仍需手动部署：
   ```bash
   cd workers && npx wrangler deploy --env staging
   ```
   或使用一键部署脚本：
   ```bash
   ./scripts/deploy.sh staging
   ```

2. **数据库迁移**：schema 变更需要手动在两个环境执行：
   ```bash
   # Staging
   npx wrangler d1 execute jsa-db-staging --file=workers/schema.sql --remote
   # Production
   npx wrangler d1 execute jsa-db --file=workers/schema.sql --remote
   ```
