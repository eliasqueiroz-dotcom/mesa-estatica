@echo off
cd /d "%~dp0"

echo Encerrando servidor de dev anterior, se houver...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
)

echo Iniciando servidor de dev (tela do mestre)...
start "Estatica - servidor dev" cmd /k npm run dev -- --port 5173 --strictPort

echo Aguardando o servidor subir...
timeout /t 4 /nobreak >nul

start http://localhost:5173/
