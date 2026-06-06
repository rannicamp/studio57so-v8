---
description: Sincroniza o projeto local com o repositório remoto (GitHub), descartando alterações locais e deixando o ambiente exatamente igual ao origin/main.
---

# 🔄 Sincronizar com GitHub (Sincronização de Ambiente)

Este workflow foi criado para sincronizar o seu ambiente local de desenvolvimento com o que está no GitHub. É perfeito para alinhar o Antigravity quando você chega em casa após trabalhar no escritório (ou vice-versa), garantindo que os dois fiquem exatamente iguais.

> [!WARNING]
> **Atenção:** Os comandos abaixo irão APAGAR todas as alterações locais que não foram enviadas (commitadas) para o GitHub. Tenha certeza de que não há código novo apenas neste computador que você precise manter. O objetivo é espelhar a nuvem.

## Comandos de Sincronização

// turbo-all
Sincronize o repositório rodando o bloco abaixo no terminal:

```powershell
git fetch origin
git reset --hard origin/main
git clean -fd
```

**Entendendo o que acontece (o "porquê"):**
1. **`git fetch origin`**: O Antigravity "pergunta" ao GitHub: *"Quais são as novidades do servidor?"* sem tocar ainda nos seus arquivos locais.
2. **`git reset --hard origin/main`**: Falamos pro computador: *"Esqueça o que temos aqui e mude nossos arquivos para ficarem idênticos à versão principal (`origin/main`) que acabamos de ver"*. Modificações locais são sobrescritas.
3. **`git clean -fd`**: A "faxina final". Apaga pastas (`-d`) e arquivos (`-f`) novos que você possa ter criado no computador mas que não estão registrados na nuvem.
