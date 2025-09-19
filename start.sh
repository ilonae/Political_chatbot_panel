#!/bin/bash
set -e

# Start backend in the background
uvicorn backend.app.main:app --host 0.0.0.0 --port 5000 &

# Start Nginx in the foreground
nginx -g "daemon off;"
