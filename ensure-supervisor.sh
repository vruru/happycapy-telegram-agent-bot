#!/bin/bash
# Ensure telegram_bot is registered in supervisord
# Called on sandbox boot to re-inject config that gets lost on restart

CONF="/etc/supervisord.conf"
MARKER="telegram_bot"

if grep -q "$MARKER" "$CONF" 2>/dev/null; then
  echo "[ensure-supervisor] telegram_bot already in supervisord config"
  exit 0
fi

echo "[ensure-supervisor] Injecting telegram_bot into supervisord config..."

cat << 'BLOCK' | tee -a "$CONF" > /dev/null

[program:telegram_bot]
command=bash run.sh
directory=/home/node/telegram-bot
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=350
startretries=5
startsecs=3
stopsignal=TERM
stopwaitsecs=10
BLOCK

supervisorctl reread && supervisorctl update
echo "[ensure-supervisor] telegram_bot injected and started"
