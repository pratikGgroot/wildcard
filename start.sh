#!/bin/bash
set -e

echo "🚀 Starting Hiring Intelligence Platform..."

# Start Ollama if not already running
if ! pgrep -x "ollama" > /dev/null; then
  echo "🤖 Starting Ollama..."
  ollama serve > /tmp/ollama.log 2>&1 &
  sleep 3
  echo "✅ Ollama started"
else
  echo "✅ Ollama already running"
fi

# Pull required models if not present
echo "📦 Checking Ollama models..."
ollama pull llama3.2 2>/dev/null || true
ollama pull nomic-embed-text 2>/dev/null || true

# Start Docker services
echo "🐳 Starting Docker services..."
docker compose up -d

echo ""
echo "✅ All services up!"
echo "   Frontend:  http://localhost:3000"
echo "   API:       http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo "   MinIO:     http://localhost:9001"
echo "   Mailpit:   http://localhost:8025"
