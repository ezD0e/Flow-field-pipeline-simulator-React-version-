@echo off
echo ========================================
echo Pipe Network Simulator - Quick Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install from: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found!
node --version
npm --version
echo.

echo Creating new Vite project...
call npm create vite@latest pipe-network-simulator -- --template react-ts

echo.
echo Entering project directory...
cd pipe-network-simulator

echo.
echo Installing dependencies...
call npm install

echo.
echo Installing additional packages...
call npm install lucide-react
call npm install -D tailwindcss postcss autoprefixer

echo.
echo Initializing Tailwind CSS...
call npx tailwindcss init -p

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Copy 'improved-pipe-network-app.tsx' content to 'src/App.tsx'
echo 2. Update 'tailwind.config.js' (see HOW_TO_RUN.md)
echo 3. Update 'src/index.css' (see HOW_TO_RUN.md)
echo 4. Run: cd pipe-network-simulator
echo 5. Run: npm run dev
echo.
pause
