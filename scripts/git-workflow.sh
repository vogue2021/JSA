#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# JSA Git 工作流辅助脚本
# 用法：
#   ./scripts/git-workflow.sh feature <feature-name>  — 从 develop 创建功能分支
#   ./scripts/git-workflow.sh merge-to-main            — 将 develop 合并到 main（发布上线）
#   ./scripts/git-workflow.sh sync-develop             — 将 main 最新代码同步到 develop
#   ./scripts/git-workflow.sh status                   — 查看分支状态
#
# 标准开发流程：
#   1. 在 develop 分支（或功能分支）上开发
#   2. push 到 develop → 自动部署到 staging 环境验证
#   3. 验证通过后 → 执行 merge-to-main → 自动部署到生产环境
# ═══════════════════════════════════════════════════════════════════════

set -e

ACTION=${1:-status}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

case "$ACTION" in
  feature)
    FEATURE_NAME=${2:?"用法: $0 feature <feature-name>"}
    BRANCH_NAME="feature/$FEATURE_NAME"
    echo "🌿 从 develop 创建功能分支: $BRANCH_NAME"
    git checkout develop
    git pull origin develop
    git checkout -b "$BRANCH_NAME"
    echo "✅ 已创建并切换到 $BRANCH_NAME"
    echo "💡 开发完成后执行: git push origin $BRANCH_NAME"
    echo "   然后在 GitHub 创建 PR 合并到 develop"
    ;;

  merge-to-main)
    echo "🚀 将 develop 合并到 main（发布上线）"
    echo ""
    
    # 检查是否有未提交的更改
    if ! git diff-index --quiet HEAD --; then
      echo "❌ 有未提交的更改，请先 commit 或 stash"
      exit 1
    fi

    # 显示 develop 比 main 多出的提交
    git fetch origin
    echo "📋 以下提交将合并到 main:"
    echo "---"
    git log origin/main..origin/develop --oneline
    echo "---"
    echo ""
    read -p "确认合并到 main 并推送？(y/N) " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
      echo "❌ 已取消"
      exit 1
    fi

    # 执行合并
    git checkout main
    git pull origin main
    git merge develop --no-edit
    git push origin main
    echo ""
    echo "✅ develop 已合并到 main 并推送！"
    echo "🚀 Cloudflare Pages (jsa) 将自动构建生产环境"
    echo "💡 别忘了部署生产 Worker: ./scripts/deploy.sh prod --worker"
    
    # 切回 develop
    git checkout develop
    ;;

  sync-develop)
    echo "🔄 将 main 最新代码同步到 develop..."
    CURRENT_BRANCH=$(git branch --show-current)
    
    git checkout develop
    git pull origin develop
    git merge main --no-edit
    git push origin develop
    echo "✅ develop 已同步到 main 最新代码"
    
    # 切回原来的分支
    if [ "$CURRENT_BRANCH" != "develop" ]; then
      git checkout "$CURRENT_BRANCH"
    fi
    ;;

  status)
    echo "📊 JSA Git 分支状态"
    echo ""
    echo "当前分支: $(git branch --show-current)"
    echo ""
    echo "── 本地分支 ──"
    git branch -v
    echo ""
    echo "── 远程分支 ──"
    git fetch origin 2>/dev/null
    echo "main ↔ origin/main:"
    git log main..origin/main --oneline 2>/dev/null || echo "  (已同步)"
    echo ""
    echo "develop ↔ origin/develop:"
    git log develop..origin/develop --oneline 2>/dev/null || echo "  (已同步)"
    echo ""
    echo "develop 领先 main 的提交:"
    git log main..develop --oneline 2>/dev/null || echo "  (无领先提交)"
    ;;

  *)
    echo "用法: $0 {feature|merge-to-main|sync-develop|status} [args]"
    echo ""
    echo "  feature <name>     从 develop 创建功能分支"
    echo "  merge-to-main      将 develop 合并到 main（发布上线）"
    echo "  sync-develop       将 main 最新代码同步到 develop"
    echo "  status             查看分支状态"
    exit 1
    ;;
esac
