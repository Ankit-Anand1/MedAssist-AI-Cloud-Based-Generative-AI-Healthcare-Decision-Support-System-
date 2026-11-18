#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo "  🚀 Starting MedAssist AI Demonstration Environment"
echo "=========================================================="

# 1. MongoDB Check & Launch
MONGOD_BIN=""
if [ -x "/opt/anaconda3/envs/mongodb_env/bin/mongod" ]; then
    MONGOD_BIN="/opt/anaconda3/envs/mongodb_env/bin/mongod"
elif command -v mongod >/dev/null 2>&1; then
    MONGOD_BIN="$(command -v mongod)"
fi

if ! lsof -i :27017 >/dev/null 2>&1; then
    echo "⏳ Starting MongoDB daemon on port 27017..."
    mkdir -p "$DIR/backend/data/db"
    rm -f "$DIR/backend/data/db/mongod.lock"
    
    if [ -n "$MONGOD_BIN" ]; then
        "$MONGOD_BIN" --dbpath "$DIR/backend/data/db" --logpath "$DIR/backend/data/mongodb.log" --port 27017 &
        MONGOD_PID=$!
    else
        echo "❌ Error: mongod binary not found!"
        exit 1
    fi
    
    # Wait for MongoDB to be ready
    echo "Waiting for MongoDB to accept connections..."
    for i in {1..15}; do
        if lsof -i :27017 >/dev/null 2>&1; then
            echo "✓ MongoDB is listening on port 27017"
            break
        fi
        sleep 1
    done
else
    echo "✓ MongoDB is already running on port 27017"
fi

# 2. Seed Database if needed
echo "⏳ Checking database seed state..."
NEED_SEED=$(cd "$DIR/backend" && "$DIR/backend/venv/bin/python3" -c '
import asyncio
from database import db

async def check():
    await db.connect()
    count = await db.users.count_documents({"email": "dr.priya@medcare.in"})
    print("0" if count > 0 else "1")
    await db.close()

asyncio.run(check())
' 2>/dev/null || echo "1")

if [ "$NEED_SEED" = "1" ]; then
    echo "🌱 Database empty or missing demo users. Seeding now..."
    "$DIR/backend/venv/bin/python3" "$DIR/backend/seed.py" --populate-dev
else
    echo "✓ Database already populated with demo users (dr.priya@medcare.in exists)."
fi

# 3. Start Backend if not already running
BACKEND_PID=""
if ! lsof -i :8000 >/dev/null 2>&1; then
    echo "⏳ Starting FastAPI Backend on http://127.0.0.1:8000..."
    (cd "$DIR/backend" && "$DIR/backend/venv/bin/uvicorn" main:app --host 127.0.0.1 --port 8000) &
    BACKEND_PID=$!
    
    for i in {1..20}; do
        if curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
            echo "✓ Backend API is ready on http://127.0.0.1:8000"
            break
        fi
        sleep 1
    done
else
    echo "✓ FastAPI Backend is already running on port 8000"
fi

# Cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down demo servers..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    echo "✓ Done."
}
trap cleanup EXIT INT TERM

# 4. Start Next.js Frontend
echo "=========================================================="
echo "  🌐 Starting Healthcare Next.js App on http://localhost:3000"
echo "  Demo Credentials:"
echo "    - Doctor:  dr.priya@medcare.in / password123"
echo "    - Patient: rajesh.kumar@email.com / password123"
echo "=========================================================="

cd "$DIR/healthcare-app"
npm run dev

