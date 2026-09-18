@echo off
chcp 65001 > nul
echo ========================================================
echo  SingToScore - 마이크 음성 악보 변환기 실행 중...
echo ========================================================
echo.
echo 마이크 접근 권한을 위해 로컬 웹 서버를 실행합니다.
echo 잠시 후 기본 웹 브라우저가 열립니다.
echo.

cd /d "%~dp0song"
start http://localhost:8088
python -m http.server 8088

pause
