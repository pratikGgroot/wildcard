#!/bin/bash

echo "🛑 Stopping Hiring Intelligence Platform..."

docker compose down

echo "✅ Docker services stopped"
echo "   (Ollama left running — kill manually with: pkill ollama)"
