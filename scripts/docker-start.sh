#!/bin/bash

# ─────────────────────────────────────────────────────────────
# Political AI Chatbot — Docker Start Script
# ─────────────────────────────────────────────────────────────

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "═══════════════════════════════════════════════════════════"
echo "  Political AI Chatbot — Docker Startup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    echo "   Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    echo "   Please upgrade Docker Desktop or install Docker Compose separately."
    exit 1
fi

echo "✓ Docker and Docker Compose found"
echo ""

# Check if first time (build needed)
if ! docker images | grep -q "political-chatbot"; then
    echo "📦 Building Docker image (first time, takes 5-10 minutes)..."
    echo ""
    docker-compose build
    echo ""
    echo "✓ Docker image built successfully"
else
    echo "✓ Docker image already built"
fi

echo ""
echo "🚀 Starting services..."
echo "   - Backend API: http://localhost:8000"
echo "   - Frontend: http://localhost:8000"
echo "   - Ollama: http://localhost:11434"
echo ""
echo "Pulling model (first time may take 5-10 minutes)..."
echo ""

# Pre-pull the model if not present
docker run --rm -v ollama-models:/root/.ollama ollama/ollama:latest \
    ollama pull dolphin-mistral 2>/dev/null || true

echo ""
echo "✓ Model ready"
echo ""

# Start services
docker-compose up

# If we get here, services were stopped
echo ""
echo "🛑 Services stopped"
echo ""
echo "To restart: docker-compose up"
echo "To stop: docker-compose down"
