#!/bin/bash
set -e

# Build and push Docker image to Fly
fly deploy --remote-only --dockerfile ./Dockerfile.fly

# Set environment variables (only needed once or if they change)
fly secrets set OPENAI_API_KEY="your-openai-key"

echo "Deployment complete! Visit https://my-chatbot-app.fly.dev"
