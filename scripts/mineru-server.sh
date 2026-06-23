#!/usr/bin/env bash
# MinerU API server — lifecycle management for Tauri sidecar.
# Usage:
#   mineru-server.sh start    — start the API server in background
#   mineru-server.sh stop     — stop the server
#   mineru-server.sh status   — check if running
#   mineru-server.sh parse <file> — parse one file (blocking)

MINERU_ENV="/tmp/mineru-env"
PIDFILE="/tmp/mineru-api.pid"
PORT="${MINERU_API_PORT:-8000}"
HOST="127.0.0.1"

ensure_venv() {
    if [ ! -d "$MINERU_ENV" ]; then
        echo "MinerU venv not found at $MINERU_ENV" >&2
        exit 1
    fi
}

start() {
    ensure_venv
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "MinerU API already running (pid $(cat "$PIDFILE"))"
        return 0
    fi
    source "$MINERU_ENV/bin/activate"
    nohup mineru-api --host "$HOST" --port "$PORT" > /tmp/mineru-api.log 2>&1 &
    echo $! > "$PIDFILE"
    echo "MinerU API started (pid $!, port $PORT)"
    # Wait for it to be ready
    for i in $(seq 1 30); do
        if curl -s "http://$HOST:$PORT/health" > /dev/null 2>&1; then
            echo "MinerU API ready"
            return 0
        fi
        sleep 1
    done
    echo "MinerU API failed to start" >&2
    return 1
}

stop() {
    if [ -f "$PIDFILE" ]; then
        kill "$(cat "$PIDFILE")" 2>/dev/null || true
        rm -f "$PIDFILE"
        echo "MinerU API stopped"
    fi
}

status() {
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "running (pid $(cat "$PIDFILE"))"
        return 0
    else
        echo "stopped"
        return 1
    fi
}

parse_file() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo '{"status":"error","message":"File not found"}'
        exit 1
    fi
    # Ensure server is running
    start >&2
    # Send file for parsing (sync endpoint)
    curl -s -X POST "http://$HOST:$PORT/file_parse" \
        -F "files=@$file" \
        -F "return_md=true"
}

case "${1:-status}" in
    start) start ;;
    stop)  stop ;;
    status) status ;;
    parse) shift; parse_file "$@" ;;
    *)
        echo "Usage: $0 {start|stop|status|parse <file>}" >&2
        exit 1
        ;;
esac
