#!/bin/bash

# ─────────────────────────────────────────────────────────────
# Alternative: Prepare Ollama using docker-compose exec
# Use this if the docker run method doesn't work
# ─────────────────────────────────────────────────────────────

set -e

MODEL="dolphin-mistral"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "═══════════════════════════════════════════════════════════"
echo "  Preparing Ollama Model: $MODEL (using docker-compose)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    echo "   Install from: https://docker.com/products/docker-desktop"
    exit 1
fi

echo "✓ Docker found"
echo ""

# Check if Ollama container is running
echo "📦 Checking if Ollama container is running..."
if ! docker-compose ps ollama 2>/dev/null | grep -q "Up"; then
    echo "   Starting Ollama container..."
    docker-compose up -d ollama
    sleep 5
fi

echo "   ✓ Ollama container ready"
echo ""

# Pull the model using docker-compose exec
echo "🔽 Pulling model: $MODEL"
echo "   This may take 5-15 minutes (5GB download)..."
echo ""

docker-compose exec -T ollama ollama pull "$MODEL"

echo ""
echo "✅ Model ready!"
echo ""
echo "Next steps:"
echo "  1. Ollama is running with the model loaded"
echo "  2. Run: docker-compose up"
echo "  3. Wait for app to start"
echo "  4. Open: http://localhost:8000"
echo ""
