@echo off
chcp 65001 > nul
echo ==============================================
echo [Python Tetris] 웹 브라우저에서 실행 중...
echo 종료하려면 이 창을 닫거나 Ctrl+C 를 누르세요.
echo ==============================================
start http://localhost:8000/tetris/
python -m http.server 8000
