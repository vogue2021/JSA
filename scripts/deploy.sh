#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# JSA 部署脚本
# 用法：
#   ./scripts/deploy.sh staging   — 部署到测试环境
#   ./scripts/deploy.sh prod      — 部署到生产环境
#
# 环境架构：
#   staging:  jsa-staging.pages.dev → jsa-api-staging.workers.dev → jsa-db-staging
#   prod:     jsa-ac8.pages.dev     → jsa-api.jiangpeng527.workers.dev → jsa-db
#
# API 代理机制：
#   前端通过 functions/api/[[path]].js 代理 /api/* 请求到后端 Worker。
#   后端地址由 Pages 环境变量 API_BACKEND_URL 控制：
#     - jsa 项目（生产）：未配置或默认 → https://jsa-api.jiangpeng527.workers.dev
#     - jsa-staging 项目（测试）：已配置 → https://jsa-api-staging.jiangpeng527.workers.dev
#   如需修改，请到 Cloudflare Dashboard → Pages → 项目设置 → 环境变量 中配置。
# ═══════════════════════════════════════════════════════════════════════

set -e

ENV=${1:-staging}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "═══════════════════════════════════════════"
echo "  JSA 部署工具  —  目标环境: $ENV"
echo "═══════════════════════════════════════════"

# ─── 0. Git 分支检查 ─────────────────────────────────────────────────
CURRENT_BRANCH=$(git -C "$ROOT_DIR" branch --show-current)
echo ""
echo "📌 当前 Git 分支: $CURRENT_BRANCH"

if [ "$ENV" = "prod" ] || [ "$ENV" = "production" ]; then
  if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  警告: 生产部署建议在 main 分支上执行（当前: $CURRENT_BRANCH）"
    read -p "   是否继续？(y/N) " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
      echo "❌ 已取消"
      exit 1
    fi
  fi
else
  if [ "$CURRENT_BRANCH" != "develop" ]; then
    echo "⚠️  提示: Staging 部署建议在 develop 分支上执行（当前: $CURRENT_BRANCH）"
  fi
fi

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
  echo "✅ 前端已构建（生产环境）"
else
  npm run build -- --mode staging
  echo "✅ 前端已构建（测试环境）"
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
  echo "  📌 API代理: 由 Pages 环境变量 API_BACKEND_URL 控制"
  echo "═══════════════════════════════════════════"
fi
