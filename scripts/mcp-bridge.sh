#!/bin/bash

# Verificar se o node está instalado
if ! command -v node &> /dev/null
then
    echo "=========================================================="
    echo "[Elo 57 MCP] ERRO: Node.js não foi encontrado!"
    echo "=========================================================="
    echo "O Servidor MCP do Elo 57 requer o Node.js para rodar localmente."
    echo ""
    read -p "Deseja que tentemos instalar o Node.js via Homebrew agora? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]
    then
        if command -v brew &> /dev/null
        then
            echo "[Elo 57 MCP] Instalando Node.js via Homebrew..."
            brew install node
        else
            echo "[Elo 57 MCP] Homebrew não detectado. Por favor, instale o Node.js manualmente em: https://nodejs.org"
            exit 1
        fi
    else
        echo "[Elo 57 MCP] Instalação cancelada. O MCP não irá funcionar."
        exit 1
    fi
fi

# Executar o bridge
node "$(dirname "$0")/mcp-bridge.js"
