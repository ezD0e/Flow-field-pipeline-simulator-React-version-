#!/bin/bash

echo "========================================"
echo "Pipe Network Simulator - Quick Setup"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please download and install from: https://nodejs.org/"
    exit 1
fi

echo "Node.js found!"
node --version
npm --version
echo ""

echo "Creating new Vite project..."
npm create vite@latest pipe-network-simulator -- --template react-ts

echo ""
echo "Entering project directory..."
cd pipe-network-simulator

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Installing additional packages..."
npm install lucide-react
npm install -D tailwindcss postcss autoprefixer

echo ""
echo "Initializing Tailwind CSS..."
npx tailwindcss init -p

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Copy 'improved-pipe-network-app.tsx' content to 'src/App.tsx'"
echo "2. Update 'tailwind.config.js' (see HOW_TO_RUN.md)"
echo "3. Update 'src/index.css' (see HOW_TO_RUN.md)"
echo "4. Run: cd pipe-network-simulator"
echo "5. Run: npm run dev"
echo ""
