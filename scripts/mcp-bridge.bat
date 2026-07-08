@echo off
setlocal enabledelayedexpansion

rem Verificar se o node esta no PATH
where node >nul 2>&1
if %errorlevel% equ 0 goto :RUN_BRIDGE

echo ==========================================================
echo [Elo 57 MCP] ERRO: Node.js nao encontrado no sistema!
echo ==========================================================
echo O Servidor MCP do Elo 57 requer o Node.js para rodar localmente.
echo.
set /p "choice=Deseja baixar e instalar o Node.js LTS automaticamente agora? (S/N): "
if /i "!choice!" neq "S" (
    echo [Elo 57 MCP] Instalacao cancelada. O MCP nao ira funcionar.
    pause
    exit /b 1
)

echo.
echo [Elo 57 MCP] Baixando instalador oficial do Node.js LTS (v20.11.0)...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\node_install.msi'"

if not exist "%TEMP%\node_install.msi" (
    echo [Elo 57 MCP] FALHA: Erro ao baixar o instalador. Verifique sua conexao.
    pause
    exit /b 1
)

echo [Elo 57 MCP] Iniciando instalacao silenciosa. Por favor, aguarde alguns segundos...
start /wait msiexec.exe /i "%TEMP%\node_install.msi" /passive /norestart

rem Tentar adicionar o caminho padrao do Node ao PATH desta sessao do terminal
set "PATH=%PATH%;C:\Program Files\nodejs"

rem Verificar novamente se foi instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ==========================================================
    echo [Elo 57 MCP] Node.js foi instalado com sucesso!
    echo ATENCAO: Por favor, feche e REINICIE sua IDE (Cursor/Windsurf/etc.)
    echo para que ela carregue as novas configuracoes do sistema.
    echo ==========================================================
    pause
    exit /b 1
)
echo [Elo 57 MCP] Node.js detectado com sucesso!

:RUN_BRIDGE
rem Executar o bridge em JavaScript
node "%~dp0mcp-bridge.js"
