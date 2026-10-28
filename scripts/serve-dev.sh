#!/bin/bash
# 把 ChinaMedGuide dev server 后台化（4321，脱离 shell 会话，跨命令存活）
# 用法：bash scripts/serve-dev.sh [start|stop|status]
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; cd "$DIR"
PORT=4321

case "${1:-start}" in
  stop)
    npx astro dev stop 2>/dev/null || true
    OLD=$(lsof -nP -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)
    [ -n "$OLD" ] && { echo "killing $OLD"; kill $OLD 2>/dev/null; }
    echo "stopped"
    ;;
  start)
    OLD=$(lsof -nP -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$OLD" ]; then echo "already up (pid $OLD)"; else
      npx astro dev --port $PORT > /tmp/cmg-dev.out 2>&1 &
      echo "launched, pid $!"
    fi
    ;;
  status)
    echo -n "port $PORT: "; lsof -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null | tail -1 || echo down
    ;;
esac
