@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ======================================================
echo AI 파워포인트 생성기 서버를 실행하고 크롬을 엽니다...
echo ======================================================
start chrome http://localhost:8000 || start http://localhost:8000
python ppt_server.py
pause
