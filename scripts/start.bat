@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ========================================
echo   Fund Dashboard - 启动服务
echo ========================================
echo.

:: 检查 pm2 是否安装
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 pm2，请先执行: npm install -g pm2
    pause
    exit /b 1
)

:: 检查服务是否已在运行
pm2 list --no-color | findstr "fund-dashboard" >nul
if %errorlevel% equ 0 (
    echo [信息] 服务已在运行，正在重启...
    pm2 restart fund-dashboard
) else (
    echo [信息] 正在启动服务...
    pm2 start ecosystem.config.cjs
)

:: 保存 PM2 进程列表（重启后恢复）
pm2 save

echo.
echo ========================================
echo   启动完成！
echo   访问: http://localhost:3000/fund-dashboard/
echo ========================================
echo.

timeout /t 3 >nul
exit
