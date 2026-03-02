#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# JSA 部署脚本
# 用法：
#   ./scripts/deploy.sh staging   — 部署到测试环境
#   ./scripts/deploy.sh prod      — 部署到生产环境
# ═══════════════════════════════════════════════════════════════════════

set -e

ENV=${1:-staging}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "═══════════════════════════════════════════"
echo "  JSA 部署工具  —  目标环境: $ENV"
echo "═══════════════════════════════════════════"

# ─── 1. 部署后端 Worker ──────────────────────────────────────────────
echo ""
echo "📦 [1/3] 部署后端 Worker..."
cd "$ROOT_DIR/workers"

if [ "$ENV" = "prod" ] || [ "$ENV" = "production" ]; then
  npx wrangler deploy
  echo "✅ Worker 已部署到生产环境: https://jsa-api.jiangpeng527.workers.dev"
else
  npx wrangler deploy --env staging
  echo "✅ Worker 已部署到测试环境: https://jsa-api-staging.jiangpeng527.workers.dev"
fi

# ─── 2. 构建前端 ─────────────────────────────────────────────────────
echo ""
echo "🔨 [2/3] 构建前端..."
cd "$ROOT_DIR"

if [ "$ENV" = "prod" ] || [ "$ENV" = "production" ]; then
  npm run build
  # 生产环境使用默认的 _redirects（指向 jsa-api）
  echo "✅ 前端已构建（生产环境）"
else
  npm run build -- --mode staging
  # 测试环境：替换 _redirects 指向 staging Worker
  cp public/_redirects.staging dist/_redirects
  echo "✅ 前端已构建（测试环境，API → staging Worker）"
fi

# ─── 3. 部署前端到 Cloudflare Pages ─────────────────────────────────
echo ""
echo "🚀 [3/3] 部署前端到 Cloudflare Pages..."

if [ "$ENV" = "prod" ] || [ "$ENV" = "production" ]; then
  echo "y" | npx wrangler pages deploy dist --project-name=jsa
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  ✅ 生产环境部署完成！"
  echo "  🌐 前端: https://jsa-ac8.pages.dev"
  echo "  🔧 后端: https://jsa-api.jiangpeng527.workers.dev"
  echo "  🗄️ 数据库: jsa-db (生产)"
  echo "═══════════════════════════════════════════"
else
  echo "y" | npx wrangler pages deploy dist --project-name=jsa-staging
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  ✅ 测试环境部署完成！"
  echo "  🌐 前端: https://jsa-staging.pages.dev"
  echo "  🔧 后端: https://jsa-api-staging.jiangpeng527.workers.dev"
  echo "  🗄️ 数据库: jsa-db-staging (测试)"
  echo "═══════════════════════════════════════════"
fi
