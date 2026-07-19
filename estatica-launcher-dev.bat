@echo off
REM Launcher para Estática — ambiente de desenvolvimento
REM Coloque este arquivo na raiz do projeto e dê duplo-clique para abrir o Vite dev server.

REM Navega para a pasta do script (raiz do projeto)
cd /d "%~dp0"

REM Se node_modules não existir, instala dependências (só na primeira execução)
if not exist "node_modules" (
  echo node_modules não encontrado — executando npm install...
  npm install
)

echo Abrindo janela do servidor de desenvolvimento (npm run dev)...
start "Estática - Dev" cmd /k "cd /d %~dp0 && npm run dev"

REM Aguarda o servidor Vite ficar disponível (padrão: http://localhost:5173)
set "VITE_URL=http://localhost:5173"
echo Aguardando o servidor responder em %VITE_URL% ...

REM Usa PowerShell para checar a URL por até 30 segundos
powershell -NoProfile -Command "for ($i=0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri '%VITE_URL%' -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { exit 0 } } catch { Start-Sleep -Seconds 1 } }; exit 1"
if %ERRORLEVEL%==0 (
  echo Servidor disponível — abrindo navegador...
  start "" "%VITE_URL%"
) else (
  echo Tempo de espera esgotado — não foi possível detectar o servidor em %VITE_URL%.
  echo Se o dev server estiver em outra porta, edite estatica-launcher-dev.bat e atualize a variável VITE_URL.
)

pause
