#!/usr/bin/env bash
PORT=4173

# Check if port 4173 is occupied, and auto-free or find open port
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 || fuser $PORT/tcp >/dev/null 2>&1 ; then
    echo "⚠️  Port $PORT is currently occupied. Freeing port $PORT..."
    fuser -k $PORT/tcp 2>/dev/null || kill $(lsof -t -i:$PORT) 2>/dev/null || true
    sleep 1
fi

echo "=========================================================="
echo "🤖 Starting Drive Systems Kinematics Lab"
echo "🌐 Open your browser at: http://localhost:$PORT"
echo "=========================================================="
cd "$(dirname "$0")"
python3 -m http.server $PORT
