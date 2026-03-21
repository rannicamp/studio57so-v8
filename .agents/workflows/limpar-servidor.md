---
description: Interrompe o servidor atual, limpa a pasta de cache do Next.js (.next) e reinicia o servidor de desenvolvimento.
---
# Workflow: Reiniciar Servidor e Limpar Cache

Este workflow é uma "Bala de Prata" para quando:
- O sistema para de mostrar as atualizações do código (componentes não atualizam na tela).
- Há quebras (crash) do React com mensagens confusas.
- A memória do terminal estoura após muitas horas de trabalho.

## Instrução

O comando abaixo foi desenvolvido especialmente para o ambiente Windows (PowerShell) do projeto. Ele caça e sacrifica o servidor atual sem piedade, deleta o cache duro e liga tudo fresquinho!

// turbo-all
```powershell
taskkill /F /IM node.exe ; Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue ; npm run dev
```
