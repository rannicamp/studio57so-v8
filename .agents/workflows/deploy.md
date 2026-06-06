---
description: Fazer o commit das alterações e o envio para o GitHub (que aciona o deploy automático no Netlify)
---
# Workflow de Deploy (Windows/PowerShell)

Este workflow deve ser usado sempre que for necessário salvar o código no repositório remoto ("fazer deploy"). 

## Regra de Ouro do Terminal (PowerShell)
Como o usuário está rodando Windows e PowerShell, o uso do operador `&&` não funciona como no bash. **O SEPARADOR DE COMANDOS DEVE SER O PONTO E VÍRGULA (`;`)**.

## Passos para execução

1. Adicione todas as modificações.
2. Crie o commit explicativo.
3. Faça o push para a branch `main`.

// turbo
```powershell
git add . ; git commit -m "feat: [Descreva as alteracoes em poucas palavras]" ; git push
```

## Como o Deploy Acontece
1. Ao fazer o push, o código é enviado ao GitHub do usuário (`rannicamp/studio57so-v8`).
2. O Netlify escuta este repositório e aciona automaticamente seu pipeline de construção para qualquer submissão recebida.
3. Não há necessidades adicionais de comandos CLI do Netlify, basta este fluxo Git normal.
