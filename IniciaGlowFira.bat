@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Cal instal.lar Node.js des de https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules" (
  call npm install
  if errorlevel 1 goto error
)
start "" http://127.0.0.1:8787/entrar
call npm run dev
exit /b 0
:error
echo Hi ha hagut un error. Revisa els missatges de dalt.
pause
exit /b 1
