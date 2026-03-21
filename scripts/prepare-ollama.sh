#!/bin/bash

# ─────────────────────────────────────────────────────────────
# Prepare Ollama for docker-compose
# This script ensures the model is downloaded before starting the app
# ─────────────────────────────────────────────────────────────

set -e

MODEL="dolphin-mistral"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "═══════════════════════════════════════════════════════════"
echo "  Preparing Ollama Model: $MODEL"
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

# Check if volume exists, create if not
echo "📦 Checking Ollama volume..."
if ! docker volume inspect ollama-models &> /dev/null; then
    echo "   Creating ollama-models volume..."
    docker volume create ollama-models
fi
echo "   ✓ Volume ready"
echo ""

# Pull the model
echo "🔽 Pulling model: $MODEL"
echo "   This may take 5-15 minutes (5GB download)..."
echo ""

docker run --rm \
    -v ollama-models:/root/.ollama \
    ollama/ollama:latest \
    pull "$MODEL"

echo ""
echo "✅ Model ready!"
echo ""
echo "Next steps:"
echo "  1. Run: docker-compose up"
echo "  2. Wait for 'ready to receive requests'"
echo "  3. Open: http://localhost:8000"
echo ""
