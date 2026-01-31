#!/bin/bash
# 在项目根目录执行此脚本，将代码推送到 GitHub
# 用法：在终端运行：cd /Users/ronafan/Documents/cursor_projects/TableSync && bash push-to-github.sh

set -e
cd "$(dirname "$0")"

GITHUB_URL="https://github.com/rpistachio/TableSync.git"

if [ ! -d .git ]; then
  git init
  echo "已初始化 Git 仓库"
fi

git add .
git status

if git diff --cached --quiet 2>/dev/null && git rev-parse HEAD >/dev/null 2>&1; then
  echo "没有新的更改需要提交"
else
  git commit -m "chore: 归档当前代码 - 菜单/购物清单/步骤视图与小程序结构" || true
fi

if git remote get-url origin 2>/dev/null; then
  echo "远程仓库已存在: $(git remote get-url origin)"
else
  git remote add origin "$GITHUB_URL"
  echo "已添加远程仓库: $GITHUB_URL"
fi

git branch -M main
git push -u origin main

echo "已推送到 GitHub: $GITHUB_URL"
