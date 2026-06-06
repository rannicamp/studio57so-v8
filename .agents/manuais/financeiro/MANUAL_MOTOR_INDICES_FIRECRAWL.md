# Sistema de Captura em Tempo Real de Índices (Firecrawl + BCB)

**Última Atualização:** 15 de Abril de 2026
**Objetivo:** Documentar a arquitetura híbrida construída para burlar a latência histórica (de 1 a 3 dias úteis) do portal do Banco Central (SGS) ao coletar o índice INCC-M da FGV. O sistema agora lê diretamente a fonte da notícia primária (Portal IBRE / FGV) usando Inteligência Web, cravando não só a alíquota como o **segundo exato** do anúncio para auditoria financeira.

---

## 1. Arquitetura e Engenharia de Software

O Novo Motor foi dividido em 3 instâncias para segurança estrita e compliance:

### 1.1 Extrator Inteligente (`utils/firecrawlIndicesApi.js`)
* **Framework:** `@mendable/firecrawl-js`.
* **Tipo:** Server Action (`"use server"`). Só roda do lado do backend do Next.js para proteção da API Key.
* **Mecânica:** Entra no website da FGV, escaneia toda a massa de novidades de relatórios usando um LLM semântico para devolver um objeto JavaScript limpo `{ mes_ano, variacao_mensal, data_divulgacao_oficial, etc }`. 

### 1.2 O Frontend Híbrido (`components/configuracoes/IndicesManager.js`)
A tela financeira, antes morta e passiva ao Cron, agora confere autoridade à Matriz (`organizacao_id = 1`):
* Possui o botão **Sincronizar Oficial do Banco Central / FGV**.
* Ao buscar por `INCC`, engatilha imediatamente o arquivo `firecrawlIndicesApi.js` forçando o Firecrawl. Se selecionar `SELIC` ou `IPCA`, a busca é enviada a `bcbApi.js` silenciosamente (Fallback Pattern).
* **Renderização:** Lê a coluna robusta nova `data_divulgacao_oficial` estampando a informação para o olho humano (ex: "Lançamento FGV: 26 de março às 08h00").

### 1.3 O Agendador Massivo (`app/api/cron/sync-indices/route.js`)
* O robô diário (Cronbot) que popula o BD de madrugada foi instruído com um desvio (*if handler*):
* Se o alvo do momento da fila for "INCC", invoca o Scraper da Inteligência em vez do Governo. 
* Em caso de falha da conectividade da FGV (site fora do ar, indisponibilidade do crawler da nuvem), ele possui um *Fallback de Sobrevivência* atrelado para pedir de qualquer forma ao Banco Central.

---

## 2. Banco de Dados / Supabase

A infraestrutura precisou escalar para lidar com extração da precisão exigida:
A Tabela primária `indices_governamentais` foi modificada localmente adicionando o campo `data_divulgacao_oficial` do tipo `Timestamp with Timezone` sem quebrar o preenchimento de `descricao`. 
Se isso parar de funfar num Reset do DB, aplicar a migration base:
```sql
ALTER TABLE indices_governamentais 
ADD COLUMN data_divulgacao_oficial timestamp with time zone;
```

---

## 3. Guia de Manutenção e Problemas de Rota (Troubleshooting)

1. **Bug: A tela exibe "Erro de Autorização / Unauthenticated no Scraper"**
   **Causa:** Sua chave gasta do `FIRECRAWL_API_KEY` na `.env.local` evaporou ou a limitação estourou. Recompenha a env com: `npx firecrawl-cli init --all`.

2. **Atraso Repentino no INCC (FGV mudou de URL)**
   A Fundação tem o costume feio de mudar links anuais. Caso o INCC volte a dar lag do BCB, você DEVE ir rapidamente no arquivo root `utils/firecrawlIndicesApi.js` e atualizar a linha:
   `const url = "https://portalibre.fgv.br/incc-m";` para o endereço novo correto. O prompt interno de racicínio de IA já é inteligente o suficiente para entender o layout do site sozinho sem se preocupar com XPath, CSS ou div tags.
