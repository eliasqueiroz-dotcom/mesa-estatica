@echo off
cd /d "%~dp0"

echo Encerrando servidor de dev anterior, se houver...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
)

echo Iniciando servidor de dev (tela do jogador)...
start "Estatica - servidor dev" cmd /k npm run dev -- --port 5173 --strictPort

echo Aguardando o servidor subir...
timeout /t 4 /nobreak >nul

rem Sem "?t=<link do jogador>" na URL a tela abre desvinculada (normal) - cole o
rem link de jogador que a tela do mestre gera (aba Personagens > icone de link)
rem depois do "jogador.html" ficar aberto, ou edite esta linha com o token fixo
rem que voce usa pra testar.
start http://localhost:5173/jogador.html
