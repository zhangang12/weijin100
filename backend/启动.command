#!/bin/bash
# 微金100 后端 · 一键启动（macOS 双击运行）
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm start
