---
name: Iniciar Servidor de Desenvolvimento no Windows (PowerShell)
description: Como contornar erros de ExecutionPolicy e inicializar o servidor de desenvolvimento do Next.js (studio57so-v8) de forma isolada e segura.
---

# Iniciar Servidor de Desenvolvimento no Windows (PowerShell)

Este guia ensina como inicializar o servidor de desenvolvimento local para o projeto **studio57so-v8** a partir de um terminal PowerShell externo, evitando que a tarefa trave o prompt de conversação com o agente e contornando a política de restrição de execução de scripts do Windows.

---

## 🚀 Comando Completo de Inicialização (Único)

Copie e cole a linha abaixo diretamente no seu console **PowerShell** assim que abri-lo:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; cd c:\Projetos\studio57so-v8; npm run dev
```

---

## 🔍 O que este comando faz?

1. **`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`**: Libera temporariamente a execução de scripts `.ps1` (como o próprio script do `npm`) **apenas para a janela do PowerShell atual**. Ao fechar a janela, a política do Windows volta ao normal de forma totalmente segura.
2. **`cd c:\Projetos\studio57so-v8`**: Entra na pasta correta do projeto.
3. **`npm run dev`**: Inicia o servidor local de desenvolvimento do Next.js.
