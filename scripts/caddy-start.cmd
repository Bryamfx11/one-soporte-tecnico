@echo off
rem Arranca Caddy (con el Caddyfile del repo) al iniciar sesion, si no esta corriendo.
netstat -ano | findstr ":80 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo Caddy ya esta corriendo.
  exit /b 0
)
"%LOCALAPPDATA%\caddy\caddy.exe" start --config "%~dp0..\Caddyfile" --adapter caddyfile
exit /b %errorlevel%