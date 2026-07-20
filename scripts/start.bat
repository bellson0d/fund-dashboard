@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ========================================
echo   Fund Dashboard - 启动服务
echo ========================================
echo.

:: 查找 pm2（系统 PATH 可能在开机时不完整，多路径探测）
set "PM2="
where pm2 >nul 2>&1 && set "PM2=pm2"
if "%PM2%"=="" if exist "%APPDATA%\npm\pm2.cmd" set "PM2=%APPDATA%\npm\pm2.cmd"
if "%PM2%"=="" if exist "%ProgramFiles%\nodejs\pm2.cmd" set "PM2=%ProgramFiles%\nodejs\pm2.cmd"

if "%PM2%"=="" (
    echo [错误] 未找到 pm2，请先执行: npm install -g pm2
    timeout /t 5 >nul
    exit /b 1
)

echo [PM2] 路径: %PM2%

:: 先尝试 resurrect 恢复之前保存的进程列表
"%PM2%" resurrect >nul 2>&1

:: 检查服务是否已在运行
"%PM2%" list --no-color 2>nul | findstr "fund-dashboard" >nul
if %errorlevel% equ 0 (
    echo [信息] 服务已在运行
) else (
    echo [信息] 正在启动服务...
    "%PM2%" start ecosystem.config.cjs
)

:: 保存 PM2 进程列表（确保重启后自动恢复）
"%PM2%" save >nul 2>&1

echo.
echo ========================================
echo   启动完成！
echo   访问: http://localhost:3000/fund-dashboard/
echo ========================================
echo.

timeout /t 3 >nul
exit
