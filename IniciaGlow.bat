@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 (
  echo Cal instal.lar Python 3.12 o posterior des de https://www.python.org/downloads/windows/
  echo Durant la instal.lacio marca Add Python to PATH.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  if errorlevel 1 goto error
)
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto error
".venv\Scripts\python.exe" manage.py migrate --noinput
if errorlevel 1 goto error
".venv\Scripts\python.exe" manage.py seed_demo
if errorlevel 1 goto error
start "Obrir Glow" /b powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:3000/'"
echo.
echo The Glow Club: http://127.0.0.1:3000/
echo Comptes: laura, elena, sandra. Contrasenya: GlowDemo2026!
echo Deixa aquesta finestra oberta. Per aturar el servidor, prem Ctrl+C.
".venv\Scripts\python.exe" manage.py runserver 127.0.0.1:3000 --noreload
pause
exit /b
:error
echo.
echo No s'ha pogut iniciar Glow. Copia l'error que apareix a sobre.
pause
exit /b 1
