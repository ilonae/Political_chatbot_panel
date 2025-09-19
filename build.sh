#!/bin/bash

# Build frontend
echo "Building frontend..."
cd frontend
npm run build
cd ..

# Build backend
echo "Building backend..."
cd backend
# No build needed for Python, but we can check requirements
pip install -r requirements.txt
cd ..

echo "Build complete!"