---
name: Orquestrar Lançamento de Empreendimentos (Dossiês, Books e Landing Pages)
description: O guia mestre (SOP) para extrair dados reais do banco e orquestrar a criação dos 3 pilares de venda de um Empreendimento: Dossiê do Corretor, Book PDF HD (Puppeteer) e Landing Page de Alta Conversão.
---

# 🚀 Manual de Operação Autônoma: Lançamento de Campanhas de Empreendimentos

Sempre que o CEO (Ranniere) solicitar a criação de materiais ou um dossiê para um novo empreendimento, a IA deve agir como a **Diretora de Lançamentos** do Studio 57. Este não é um trabalho braçal, é um trabalho de orquestração técnica e persuasiva.

## 📌 PASSO 1: Perguntar ao Usuário o Escopo
Antes de sair escrevendo código, **PERGUNTE** explicitamente ao usuário quais dos três materiais principais ele deseja gerar para o empreendimento (ele pode escolher todos):

1. **Dossiê / Manual do Corretor** (Arquivo Markdown com a inteligência de escassez e dados do DB).
2. **Landing Page de Alta Conversão** (Interface web Next.js focada em Leads).
3. **Book de Vendas em PDF HD** (Páginas formato A4/A5, arquitetura cliente Puppeteer para impressão sem falhas de iframe/mapas).

## 📌 PASSO 2: A Etapa Investigativa (Raio-X do Banco de Dados)
Independentemente do material escolhido, a IA **DEVE** obrigatoriamente se conectar ao banco de dados via script Node.js temporário para ler a verdade absoluta do sistema. NUNCA invente preços ou áreas.

**Tabelas a serem investigadas (`empreendimento_id = X`):**
1. `empreendimentos` -> Para capturar o VGV total, Categoria, Status.
2. `produtos_empreendimento` -> Contagem de lotes/unidades, status de venda (Disponível, Vendido, Reservado), valores calculados, metragens e **matrículas individualizadas**.
3. `configuracoes_venda` -> Para extrair a arquitetura financeira (Ex: "Entrada de 20% em 3x e saldo em 60x direto").
4. `empreendimento_anexos` -> Para verificar as URLs públicas de imagens, logos, renders e PDFs jurídicos disponíveis na nuvem.

## 📌 PASSO 3: Geração dos Materiais (Templates e Padrão Ouro)

Caso o usuário aprove a geração dos materiais, siga EXATAMENTE os padrões estruturais abaixo:

### 📄 1. Dossiê / Manual do Corretor
Um arquivo salvo em `.agents/[nome_do_empreendimento]/dossie_venda.md`.
**Estrutura Obrigatória:**
- **Argumentação de Vendas (Dor x Solução):** Foco em exclusividade, ticket não descapitalizante.
- **Escassez Real:** Cálculo imediato de "Temos X unidades, mas Y já foram vendidas! Só restam Z."
- **Vitrine de Disponibilidade:** Tabela clara com `Lote | Área | Valor | Matrícula`.
*Exemplo Ouro para se basear:* `c:\Projetos\studio57so-v8\.agents\refugio_braunas\dossie_venda_refugio_braunas.md`

### 🌐 2. Landing Page de Alta Conversão
Um componente Next.js salvo em `app/(landingpages)/[nome]/page.js`.
**Estrutura Obrigatória:**
- Layout Full-bleed, Dark Mode (bg-[#0a0a0a]), text-gray-400 com acentos em Laranja Studio 57 (#f25a2f).
- Fontes: `Montserrat` para títulos premium, `Roboto` para corpo.
- Tese de Investimento clara, Timeline de Localização e Swiper de Fotos/Plantas.
*Exemplo Ouro para se basear:* `c:\Projetos\studio57so-v8\app\(landingpages)\betasuites\page.js`

### 📘 3. Book de Vendas (O Gerador PDF HD via Puppeteer)
A arquitetura do Studio 57 para PDFs **NÃO USA** o `window.print()` nativo do navegador, pois causa problemas com iframes (Maps) e backgrounds.
**Estrutura Obrigatória:**
- **Frontend (`.../book/page.js` e `Client.js`):** Um layout paginado A4 ou A5 estritamente com `297mm x 210mm` (ou medidas de A5), que carrega todas as fotos em alta resolução. Backgrounds forçados (`-webkit-print-color-adjust: exact`).
- **Iframes Dinâmicos:** PROIBIDOS. Substitua Google Maps por uma **imagem estática da localização** para não falhar na captura invisível.
- **Backend de Captura (Script Automático):** A geração real acontece via um script Puppeteer em Node.js (`scripts/gerar_book_[nome]_pdf.js`). O Puppeteer rola a tela até o final, espera as imagens carregarem, tira prints hiper-realistas da tela e junta em um PDF com camada de texto. O PDF final é enviado para o Bucket Supabase do Empreendimento e o botão na UI apenas baixa este arquivo pronto.
*Exemplos Ouro para se basear:* 
- Fonte Client: `c:\Projetos\studio57so-v8\app\(landingpages)\perovaz\book\PeroVazBookClient.js`
- Script Gerador: `c:\Projetos\studio57so-v8\scripts\gerar_book_perovaz_pdf.js`

---

> 💡 **Nota Final para a IA:** O Padrão Ouro de materiais de campanha no Studio 57 une **Dados Frios** (Matrículas, Valores exatos e RLS) com o **Marketing Agressivo e Sofisticado**. Nunca entregue um material com linguagem de "banco de dados" para o cliente final. A IA deve assumir a persona persuasiva.
