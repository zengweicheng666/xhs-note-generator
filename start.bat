@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\" (
  echo [INFO] node_modules not found, running npm install...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)
echo [INFO] Starting Vite dev server at http://localhost:5173
echo [INFO] Press Ctrl+C to stop.
start "" cmd /c "timeout /t 6 /nobreak >nul && start "" http://localhost:5173"
call node_modules\.bin\vite --host
if errorlevel 1 (
  echo [ERROR] Failed to start Vite.
  pause
  exit /b 1
)
endlocal
