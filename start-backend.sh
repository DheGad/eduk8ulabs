#!/bin/bash

# V1.0 Minimalist Titan Start Script
# Bypasses Turbopack to save memory and only starts the core backend components.

echo "🚨 STARTING OS-KERNEL (PORT 4000)..."
cd apps/os-kernel/services/router-service
PORT=4000 npm run dev &
cd ../../../..

echo "🚨 STARTING TITAN HQ (PORT 5000)..."
cd apps/titan-hq
PORT=5000 npm run dev &
cd ../..

echo "✅ Backend is running. Press Ctrl+C to stop both processes."
wait
