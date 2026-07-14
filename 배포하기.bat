@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================
echo  organicyuja.com 배포 시작
echo ================================
echo.
call npx vercel --prod
echo.
echo ================================
echo  배포 완료! 위 URL로 접속해서 확인하세요.
echo ================================
pause
