@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ======================================================
echo AI 파워포인트 생성기를 크롬 브라우저에서 엽니다...
echo ======================================================
start chrome "%~dp0index.html" || start "" "%~dp0index.html"
