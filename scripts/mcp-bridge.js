#!/usr/bin/env node

/**
 * Elo 57 - MCP Bridge (Ponte Local Stdio)
 * 
 * Este script roda localmente na máquina do usuário e faz a ponte (bridge) entre 
 * o cliente MCP da IDE (Antigravity/Cursor/Cline) via Stdio e o nosso backend 
 * remoto stateless em produção via HTTP POST.
 * 
 * Requisitos:
 * - Node.js v18+ (que inclui o fetch nativo global)
 * - Variável de ambiente ELO57_API_KEY contendo a chave do usuário gerada no painel.
 */

const readline = require('readline');

// URL da nossa API remota (ou local para desenvolvimento)
const API_URL = process.env.ELO57_API_URL || 'https://studio57.arq.br/api/mcp';
const API_KEY = process.env.ELO57_API_KEY;

// Configurar o leitor de linha do stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Logs internos devem ir estritamente para o stderr, pois o stdout é usado apenas para a comunicação JSON-RPC.
function logError(...args) {
  console.error('[MCP Bridge Error]', ...args);
}

// Verifica se a chave de API está presente
if (!API_KEY) {
  logError('Variável de ambiente ELO57_API_KEY não foi encontrada.');
  logError('Para conectar, defina a variável ELO57_API_KEY com a sua chave gerada no painel.');
  process.exit(1);
}

// Processa linha por linha vinda do stdin (cada linha é uma requisição JSON-RPC)
rl.on('line', async (line) => {
  if (!line.trim()) return;

  let rpcRequest;
  try {
    rpcRequest = JSON.parse(line);
  } catch (err) {
    logError('Falha ao parsear JSON do stdin:', err.message);
    writeResponse({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error: JSON inválido.' },
      id: null
    });
    return;
  }

  const requestId = rpcRequest.id;

  try {
    // Encaminha a requisição JSON-RPC para o nosso servidor na nuvem de forma síncrona
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(rpcRequest)
    });

    if (!response.ok) {
      const errText = await response.text();
      logError(`Erro HTTP da API (${response.status}):`, errText);
      writeResponse({
        jsonrpc: '2.0',
        error: { 
          code: -32000 - response.status, 
          message: `Erro do servidor Elo 57 (${response.status}): ${errText || response.statusText}`
        },
        id: requestId
      });
      return;
    }

    const rpcResponse = await response.json();
    writeResponse(rpcResponse);

  } catch (netErr) {
    logError('Falha de rede ao conectar à API remota:', netErr.message);
    writeResponse({
      jsonrpc: '2.0',
      error: { 
        code: -32099, 
        message: `Falha de conexão com a API do Elo 57: ${netErr.message}. Verifique sua internet.`
      },
      id: requestId
    });
  }
});

// Escreve a resposta JSON-RPC stringificada no stdout terminando com quebra de linha (exigência do stdio MCP)
function writeResponse(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

logError(`Ponte MCP iniciada para a URL: ${API_URL}`);
