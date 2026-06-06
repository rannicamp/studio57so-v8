---
description: Como a IA deve gerenciar variáveis de ambiente e acionar Deploys remotamente no Netlify via CLI
---

# 🚀 Workflow Oficial: Gerenciamento e Deploy Remoto no Netlify

Este workflow documenta a habilidade e os passos necessários para que a IA (Agente) consiga ler, atualizar **Variáveis de Ambiente** e engatilhar **Deploys de Produção** diretamente na configuração do Netlify, sem a necessidade de o usuário acessar o painel web.

---

## 🔑 1. O Ponto de Partida: Autenticação Dinâmica
Para que a CLI do Netlify funcione em "modo fantasma" (Headless / API remota) nos comandos disparados pela IA, a rota mais precisa não depende do `netlify link` (que é interativo), mas sim da injeção direta do **SITE ID** na memória (PowerShell).

**Site ID do Elo 57 (SaaS):** `873a4025-fa96-4b12-bfb5-1f8c36083b8f`

### Comando Magno (Obrigatório antes de qualquer passo):
```powershell
cd c:\Projetos\elo57-lab-saas
$env:NETLIFY_SITE_ID="873a4025-fa96-4b12-bfb5-1f8c36083b8f"
```

---

## ⚙️ 2. Manipulando o Cofre (Variáveis de Ambiente)
Uma vez que o `NETLIFY_SITE_ID` está injetado na sessão viva do PowerShell da IA, o cofre de variáveis da nuvem se abre para nós de forma remota.

### Listar as Variáveis Atuais:
```powershell
npx netlify env:list
```

### Injetar / Substituir uma Variável:
Você pode empilhar as substituições concatenando com `;` e confirmando os Prompts interativos com o comando do Cortex (`send_command_input`) injetando `y\n`.
```powershell
npx netlify env:set NOME_DA_VARIAVEL_AQUII "VALOR_SECRETO_AQUI"
```
*Se a variável já existir, o painel perguntará interativamente se deseja sobrescrever (Overwrite). A IA deve enviar `y`.*

---

## 🚀 3. O Botão Vermelho: Acionar Trigger Deploy Remoto
Uma vez alteradas as variáveis, elas só entram em vigor quando o código é re-compilado na Nuvem (`Trigger Deploy`). 

Para forçar um Trigger Deploy com as novas variáveis e publicar no domínio principal, usamos o comando de build engatado no deploy produtivo:

```powershell
// turbo-all
cd c:\Projetos\elo57-lab-saas ; $env:NETLIFY_SITE_ID="873a4025-fa96-4b12-bfb5-1f8c36083b8f" ; npx netlify deploy --build --prod
```
*Gatilho: Esse comando roda o `npm run build` obedecendo os comandos da Nuvem e empurra os arquivos para o domínio final.*

---

## 🧑‍🏫 Resumo de Ação da IA
Sempre que o Mestre solicitar "Mude a variável X no Netlify e dê Deploy", a IA deverá agir **sem hesitar**:
1. Abro meu terminal oculto (PowerShell).
2. Seto `$env:NETLIFY_SITE_ID`.
3. Rodo o `netlify env:set ...` e afirmo `y`.
4. Disparo `netlify deploy --build --prod`.
5. Informo ao Cliente que ele já pode testar no domínio original, pois a nuvem foi reconstruída pelos meus braços robóticos.
