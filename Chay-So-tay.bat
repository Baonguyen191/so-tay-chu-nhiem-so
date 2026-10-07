@echo off
chcp 65001 >nul
title So tay Chu nhiem so
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chua cai Node.js. Hay cai Node.js ban LTS tu https://nodejs.org roi chay lai file nay.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Dang cai dat lan dau, vui long cho 1-2 phut...
  call npm install --omit=dev
)
call npm start
pause
