@echo off
chcp 65001 > nul
title Emma 3D English Tutor Server
echo Starting Emma 3D English Tutor Server...
python "%~dp0server.py"
pause
