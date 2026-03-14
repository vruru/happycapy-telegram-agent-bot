#!/bin/bash
# Auto-restart wrapper for the Telegram bot
cd "$(dirname "$0")"

# ── Auto-register with supervisord if missing ──
# /etc/supervisord.conf lives on the overlay FS and gets reset on sandbox restart.
# This ensures the telegram_bot entry is always present.
if ! grep -q "telegram_bot" /etc/supervisord.conf 2>/dev/null; then
  echo "$(date) - Injecting telegram_bot into supervisord config..."
  sed -i '/; === Priority group 2/i\
[program:telegram_bot]\
command=bash run.sh\
directory=/home/node/telegram-bot\
autostart=true\
autorestart=true\
stdout_logfile=/dev/stdout\
stdout_logfile_maxbytes=0\
stderr_logfile=/dev/stderr\
stderr_logfile_maxbytes=0\
priority=350\
startretries=5\
startsecs=3\
stopsignal=TERM\
stopwaitsecs=10\
' /etc/supervisord.conf
  echo "$(date) - supervisord config updated."
fi

PIDFILE="/tmp/telegram-bot.pid"

# ── PID lock: prevent multiple instances ──
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "$(date) - Another instance already running (PID $OLD_PID), exiting."
    exit 1
  fi
  echo "$(date) - Stale PID file found, removing."
  rm -f "$PIDFILE"
fi

echo $$ > "$PIDFILE"
trap 'rm -f "$PIDFILE"' EXIT

# Load environment variables from .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

CONFLICT_COUNT=0
MAX_CONFLICTS=3

while true; do
  echo "$(date) - Starting bot..."
  node src/bot.js 2>&1
  EXIT_CODE=$?
  echo "$(date) - Bot exited with code $EXIT_CODE"

  if [ $EXIT_CODE -eq 42 ]; then
    echo "$(date) - Restart requested, restarting in 3s..."
    CONFLICT_COUNT=0
    sleep 3
    continue
  fi

  # Exit code 43 = polling conflict
  if [ $EXIT_CODE -eq 43 ]; then
    CONFLICT_COUNT=$((CONFLICT_COUNT + 1))
    if [ $CONFLICT_COUNT -ge $MAX_CONFLICTS ]; then
      echo "$(date) - Too many polling conflicts ($CONFLICT_COUNT), stopping."
      exit 1
    fi
    DELAY=$((CONFLICT_COUNT * 5 + 5))
    echo "$(date) - Polling conflict #$CONFLICT_COUNT, retrying in ${DELAY}s..."
    sleep $DELAY
    continue
  fi

  CONFLICT_COUNT=0
  echo "$(date) - Unexpected exit, restarting in 8s..."
  sleep 8
done
