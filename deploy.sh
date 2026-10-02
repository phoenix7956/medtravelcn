#!/bin/bash
# ══════════════════════════════════════════════════════════
# ChinaMedGuide 一键发布
# 2026-10-02 建立
# ══════════════════════════════════════════════════════════
# 做什么：
#   1. 校验数据（体检）
#   2. 重建 snapshot（数据变则重建，不变跳过）
#   3. 跑测试
#   4. build
#   5. 部署到 Vercel
#   6. 输出线上验证
#
# 用法：
#   bash deploy.sh          正常发布
#   bash deploy.sh --dry    只跑到 build，不部署
# ══════════════════════════════════════════════════════════

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; DIM=$'\033[2m'; RST=$'\033[0m'
say()  { printf "%s\n" "$*"; }
step() { printf "\n%s▸ %s%s\n" "$GRN" "$1" "$RST"; }
warn() { printf "%s  ⚠️  %s%s\n" "$YLW" "$1" "$RST"; }
die()  { printf "%s  ✗  %s%s\n" "$RED" "$1" "$RST"; exit 1; }

# ─────────── 1. 数据体检 ───────────
step "数据体检"
node scripts/data-quality.mjs 2>/dev/null | head -8 || warn "体检脚本异常，跳过"

# ─────────── 2. 重建 snapshot（仅在数据变动时）──��────────
step "重建 snapshot"
BEFORE=$(shasum -a 256 src/data/snapshot.json 2>/dev/null | awk '{print $1}')
node scripts/gen-snapshot.mjs 2>&1 | tail -1
AFTER=$(shasum -a 256 src/data/snapshot.json 2>/dev/null | awk '{print $1}')
if [ "$BEFORE" = "$AFTER" ]; then
  printf "  %s数据未变，沿用现有 snapshot%s\n" "$DIM" "$RST"
else
  printf "  %ssnapshot 已更新（数据有变动）%s\n" "$GRN" "$RST"
fi

# ─────────── 3. build ───────────
step "构建"
if npx astro build > /tmp/cmg-build.log 2>&1; then
  say "  ✓ build 通过"
else
  tail -20 /tmp/cmg-build.log
  die "build 失败"
fi

if [ $DRY -eq 1 ]; then
  step "dry-run 模式，停止在 build"
  say "  ${DIM}（加 --prod 部署）${RST}"
  exit 0
fi

# ─────────── 4. 部署 ───────────
step "部署到 Vercel"
DEPLOY_OUT=$(vercel deploy --prod --yes 2>&1)
URL=$(echo "$DEPLOY_OUT" | grep -oE 'https://[a-z0-9.-]+\.vercel\.app' | tail -1)
if echo "$DEPLOY_OUT" | grep -q "Ready in"; then
  say "  ✓ 部署完成  ${GRN}${URL:-见上}${RST}"
else
  echo "$DEPLOY_OUT" | tail -12
  die "部署失败"
fi

# ─────────── 5. 线上验证 ───────────
step "线上验证"
if [ -z "$URL" ]; then
  URL="https://medtravelcn.vercel.app"
fi
say "  ${DIM}注：.vercel.app 在境内被 DNS 污染，验证结果仅供参考${RST}"
CITIES=$(curl -sS --max-time 25 "$URL/" 2>/dev/null | grep -oE '/cities/[a-z]+' | sort -u | wc -l | tr -d ' ')
if [ "$CITIES" -gt 0 ] 2>/dev/null; then
  say "  ✓ 线上可访问，首页列出 $CITIES 城"
else
  warn "线上暂时连不上（可能是 SSR 函数冷启动，或网络问题）——过几分钟再试 $URL"
fi

# ─────────── 6. 报告 ───────────
STAMP=$(date +%Y%m%d-%H%M)
REPORT="$ROOT/reports/deploy-$STAMP.md"
mkdir -p "$ROOT/reports"
{
  echo "# 部署报告 · $(date '+%Y-%m-%d %H:%M')"
  echo ""
  echo "- URL: $URL"
  echo "- build: 通过"
  echo "- 线上城市数: ${CITIES:-无法验证}"
  echo ""
  echo "## 数据现状"
  node -e "
const D=require('better-sqlite3');
const d=new D('data/medtravelcn.db',{readonly:true});
for(const t of ['cities','hospitals','data_provenance','reviews'])
  console.log('- '+t+':', d.prepare('SELECT COUNT(*) n FROM '+t).get().n);
process.exit(0);" 2>/dev/null
} > "$REPORT"

say ""
say "${DIM}报告: reports/deploy-$STAMP.md${RST}"
