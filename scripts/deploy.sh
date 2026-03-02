#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# JSA 部署脚本
# 用法：
#   ./scripts/deploy.sh staging          — 完整部署到测试环境（Worker + 构建前端 + Pages）
#   ./scripts/deploy.sh prod             — 完整部署到生产环境
#   ./scripts/deploy.sh staging --worker — 仅部署 staging Worker（前端由 Git 自动构建）
#   ./scripts/deploy.sh prod --worker    — 仅部署生产 Worker
#   ./scripts/deploy.sh staging --sync   — 同步 develop 分支到 main 最新代码
#
# 环境架构：
#   staging:  jsa-staging.pages.dev → jsa-api-staging.workers.dev → jsa-db-staging
#   prod:     jsa-ac8.pages.dev     → jsa-api.jiangpeng527.workers.dev → jsa-db
#
# Git 集成说明：
#   如果 jsa-staging 已在 Cloudflare Dashboard 关联 Git（develop 分支），
#   则 push 到 develop 会自动触发前端构建，此时只需用 --worker 部署后端即可。
#   详见 docs/staging-setup-guide.md
# ═══════════════════════════════════════════════════════════════════════

set -e

ENV=${1:-staging}
MODE=${2:-""}  # --worker 或 --sync
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "═══════════════════════════════════════════"
echo "  JSA 部署工具  —  目标环境: $ENV ${MODE}"
echo "═══════════════════════════════════════════"

# ─── 分支同步模式 ─────────────────────────────────────────────────────
if [ "$MODE" = "--sync" ]; then
  echo ""
  echo "🔄 同步 develop 分支到 main 最新代码..."
  CURRENT_BRANCH=$(git -C "$ROOT_DIR" branch --show-current)

  git -C "$ROOT_DIR" checkout develop
  git -C "$ROOT_DIR" merge main --no-edit
  git -C "$ROOT_DIR" push origin develop
  echo "✅ develop 已同步到 main 最新代码并推送"

  # 切回原来的分支
  git -C "$ROOT_DIR" checkout "$CURRENT_BRANCH"
  exit 0
fi

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

# 如果是 --worker 模式，只部署 Worker 就结束
if [ "$MODE" = "--worker" ]; then
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  ✅ Worker 部署完成！（--worker 模式，跳过前端）"
  echo "  💡 前端将由 Cloudflare Pages Git 集成自动构建"
  echo "═══════════════════════════════════════════"
  exit 0
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
  echo "═══════════════════════════════════════════"
fi
