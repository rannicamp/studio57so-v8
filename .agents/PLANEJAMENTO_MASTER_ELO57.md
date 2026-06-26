# 🏗️ Planejamento Master — Elo 57 (Apresentação & Demonstração B2B)

Este planejamento organiza as etapas necessárias para preparar o **Elo 57** como ferramenta de demonstração comercial B2B na palestra do Ranniere com outras incorporadoras. 

Para que a apresentação ocorra sem expor dados reais de clientes ou obras da Studio 57, criaremos uma **Organização Fictícia de Demonstração** com dados operacionais simulados e usaremos essa base para gerar imagens premium para a nova landing page e permitir demonstrações ao vivo.

---

## 📅 Cronograma de Execução (Passo a Passo)

### 🟢 FASE 1: Provisionamento da Organização de Demonstração (Vanguard)
*   **Objetivo:** Criar a organização **Vanguard Incorporações & SPEs** (ID `57`) e preencher tabelas-chave com dados fictícios ultra-realistas.
*   **Dados simulados necessários:**
    *   **Organização & Empresa:** Vanguard Incorporações Ltda (CNPJ e endereço fictícios).
    *   **Empreendimento:** *Residencial Vista Parque* (edifício vertical com 2 torres e 40 unidades).
    *   **Contatos (Base Limpa):** 15 contatos fictícios categorizados como Leads, Clientes, Corretores e Fornecedores.
    *   **CRM (Funil de Vendas):** Leads em diferentes estágios (Novo, Contato, Visita Agendada, Proposta, Negociação).
    *   **Financeiro (Fluxo Realista):** 30 lançamentos financeiros históricos (compras de materiais, salários, parcelas de vendas recebidas) respeitando a formatação correta de sinais (+ para Receitas, - para Despesas).
    *   **Contratos:** 3 contratos de promessa de compra e venda ativos e reajustados pelo INCC.
    *   **Diário de Obra (RDO):** 3 relatórios diários de obras preenchidos no canteiro fictício.

### 🟡 FASE 2: Chaveamento Rápido de Organização (Demonstração ao Vivo)
*   **Objetivo:** Permitir que o Ranniere, logado em sua conta de desenvolvimento (`rannierecampos@studio57.arq.br`), consiga chavear instantaneamente entre a Studio 57 e a Vanguard Incorporações para fazer a palestra.
*   **Solução:** Implementar um seletor visual temporário no cabeçalho ou criar uma instrução SQL simples para alterar o `organizacao_id` do usuário dele temporariamente para o ID da Vanguard (`57`).

### 🔵 FASE 3: Captura de Imagens de Produto (Assets)
*   **Objetivo:** Utilizar a base Vanguard populada para tirar capturas de tela reais dos painéis do sistema (CRM, Financeiro, RDO, Visualizador BIM) e usá-las na landing page, substituindo placeholders genéricos por imagens que vendem o design do produto real.

### 🟠 FASE 4: Refatoração Padrão Ouro da Landing Page (`/elo57`)
*   **Objetivo:** Ajustar a landing page que copiamos para o design premium atualizado:
    *   Substituir a cor laranja antiga (`#FF6700`) por **Azul Corporativo Moderno** (`#2563EB`/`text-blue-600`) e **Preto Sóbrio**.
    *   Implementar Dots de Navegação Lateral na lateral direita com scroll dinâmico.
    *   Corrigir gradientes Tailwind antigos e instáveis.

### 🔴 FASE 5: Criação da Apresentação Completa de Slides (`/elo57/apresentacao`)
*   **Objetivo:** Desenvolver a sub-rota de suporte visual para a palestra, sem menus ou rodapés públicos, ideal para projetores de slides com Snap Scroll e slides explicativos detalhados (Dores de Gestão, Stella IA SDR 2.0, BIM 5D, Controle de Obras).

---

## 🛠️ Especificação Técnica da Organização Fictícia

### 1. Script de Provisionamento (SQL)
Criaremos um script Node.js ou SQL para rodar no Supabase que inserirá os dados de forma encadeada respeitando as chaves estrangeiras:
1.  Insere Organização (`id = 57`).
2.  Insere Empresa em `cadastro_empresa` vinculada à Org 57.
3.  Cria o Empreendimento Residencial Vista Parque.
4.  Cria 20 Unidades Autônomas no estoque.
5.  Gera Contatos, Telefones e e-mails de teste.
6.  Insere o Funil de Vendas do CRM e posiciona os Leads.
7.  Insere Contas Financeiras e Lançamentos.
8.  Gera contratos assinados simulados.

### 2. Controle de Acesso e Segurança
As regras de RLS do banco de dados (que limitam dados ao ID da Organização) funcionarão perfeitamente por design. Ao carregar a Vanguard (Org 57), os dados reais da Studio 57 (Org 2) ficarão 100% ocultos e protegidos, garantindo total segurança durante a palestra do Ranniere.
