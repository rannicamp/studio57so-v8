# 🏗️ PLANEJAMENTO MASTER - Studio 57 (Core) -> Elo 57 (Oficial)

## 📌 Governança e Objetivo
O **Studio 57** é o ambiente de desenvolvimento e laboratório central. O **Elo 57** (`elo57.com.br`) é o nome comercial e plataforma oficial de produção.
- Todo desenvolvimento e teste acontece primeiro no `studio57so-v8-main`.
- Após validação, o código é sincronizado com o repositório `elo57-lab-saas`.
- **Sincronização de Banco:** Apenas **Schemas e Funções** são espelhados do Studio para o Elo. Os **Dados** permanecem isolados para garantir a privacidade dos clientes de produção.

## 🚀 Status de Lançamento

## 🏁 Objetivos de Curto Prazo
- [x] Finalizar Sincronia de Bancos de Dados (vhuvnutzklhskkwbpxdz -> alqzomckjnefsmhusnfu).
- [/] Refinar Página de Cadastro de Organização (UI/UX e Dados Completos).
- [ ] Validar Fluxo de Cadastro e Login em dispositivos Mobile (PWA).
- [ ] Checklist Legal: Revisar textos das Políticas Públicas.
- [x] **RLS Global Aplicado no Banco de Dados (07/03) — 121 tabelas protegidas.**
- [x] **Padronizar o Sistema de Upload (07/03) — CONCLUÍDO.** `UppyAvatarUploader`, `UppyFileImporter` e todo o sistema reescritos no padrão nativo.

## 🏗️ Módulos Críticos para o Lançamento
### 1. Compliance e Segurança (95%)
- [x] Super Admin Redirection.
- [x] Matriz de Aceites (Multi-contratos).
- [x] Central de Políticas Públicas (/politicas).
- [x] **Auditoria Final de RLS (Row Level Security) — CONCLUÍDA (07/03).**

### 1. Infraestrutura e Domínios
- [x] Configuração do domínio oficial `elo57.com.br` no Netlify (Propagando).
- [ ] Configuração de e-mail transacional (SendGrid/Resend).
- [ ] Setup do Repositório de Produção (`elo57-lab-saas`) sincronizado.
- [ ] Rotina de Sincronização de Banco (Schema Sync).

### 4. Onboarding de Clientes (Pendente de Implementação)
- [ ] Nova UI para `app/cadastro/page.js` (Estilo Premium e Bifásico).
- [ ] Chaveador de Natureza Jurídica (Pessoa Física vs Pessoa Jurídica).
- [ ] Coleta de dados completa:
    - **Pessoa (Usuário):** Nome, CPF, E-mail, Celular.
    - **Organização/Profissional:** Nome Fantasia/Razão, CNPJ (se PJ), Endereço, Logo.
- [ ] **Arquitetura Técnica (Definida em 01/03):** 
    - Adicionar `entidade_principal_id` na tabela `organizacoes`.
    - Flexibilizar `cadastro_empresa` (CNPJ e Razão Social como opcionais).
    - Fluxo: Criar Org -> Criar Entidade (PF/PJ) -> Vincular Org à Entidade -> Criar User Admin.
- [ ] Integração com APIs de busca (ViaCEP e CNPJ).
- [ ] Fluxo de boas-vindas pós-cadastro e tour inicial.

### 5. Sistema de Pagamentos e Core Financeiro (CRÍTICO)
- [ ] **Definição de Provedor:** Analisar taxas e facilidade de integração entre **Iugu** e **Asaas**.
- [x] **Demonstrativo de Resultados (DRE):** Implementar visão de competência (Receitas vs Despesas vs Lucro Líquido).
- [x] **Lógica de Cartão de Crédito — Separação Visual (03/03):** Aba "Cartões" reestruturada:
    - Agrupamento correto de lançamentos por Mês/Ano da fatura (usando `dia_pagamento_fatura`).
    - Histórico lateral com valor total de despesas por fatura e destaque visual da Fatura Atual (próximo vencimento).
    - Extrato linha a linha dentro de cada fatura (Data, Descrição, Valor).
    - Resumo com 3 cards separados: **Compras/Despesas** | **Estornos/Pagamentos** | **Saldo a Pagar**.
- [ ] **Gestão de Ativos e Passivos Patrimoniais (05/03):**
    - [x] Criado `AtivosManager` com design dedicado da Família A (`DESIGN_SYSTEM.md`).
    - [x] Criado `AtivoFormModal` para inclusão e edição corrigindo a renderização do valor real.
    - [ ] Criar a vinculação de Receitas com Ativos (amortização/redução de patrimônio nas vendas parciais ou totais).
- [ ] Implementar Webhooks para controle de status de assinatura.
- [ ] Criar Dashboard de Faturamento para o cliente (Portal do Assinante).
- [ ] Bloqueio de funcionalidades por status de pagamento (Inadimplência).

### 6. Branding e Identidade Visual (Transição Elo 57)
- [x] **Rename:** Substituir ocorrências de "Studio 57" por "Elo 57" na interface.
- [x] **Assets:** Gerar e implementar Favicon (ícone da aba) e Ícones PWA (192x192, 512x512).
- [x] **Logotipo:** Definir e aplicar Logo Retangular e Logo Quadrada (Marca d'água) em navegação, login e relatórios (BIM, Simulador, RDO, Tabela de Venda).
- [x] **Mobile:** Configurar ícone de notificação para dispositivos móveis (Android/iOS) no `manifest.json` e `custom-sw.js`.
- [ ] **Meta Ads:** Atualizar criativos e nomes nos aplicativos da Meta.

### 7. Governança de Aplicativos Meta (ESTRATÉGIA DEFINIDA)
- [x] **Auditoria de Apps:** Identificadas todas as instâncias para evitar confusão.
- [ ] **Estratégia de Separação (OFICIAL):**
    - **App 1 (Marketing/Ads):** Elo 57 - Dev (**1900130190871246**) ✅ **OFICIAL**
    - **App 2 (WhatsApp):** ELO 57 - WATS (**1459952825742829**) ✅ **OFICIAL**
- [ ] **Inventário Completo (Para Histórico e Limpeza):**
    1. **CRM - Studio 57** (1518358099511142) - Modo: Ativo | Tipo: Empresa
    2. **ELO 57 - WATS** (2052352668968564) - Modo: Dev | Empresa: Studio57
    3. **ELO 57 - WATS** (1459952825742829) ✅ **OFICIAL WHATSAPP**
    4. **Elo 57 - Dev** (1900130190871246) ✅ **OFICIAL MARKETING/ADS**
    5. **Elo 57 - Dev** (749147054935696) - Modo: Dev | Empresa: Studio57
    6. **Elo 57 - wa** (1472719784079456) - Modo: Dev | Tipo: Empresa
    7. **Studio 57 gestor** (1827368137825495)
    8. **CRM - Studio 57 - 2** (23905100505840850)
    9. **Studio 57 gestor** (701113019490938)

### 8. Padronização Global do Sistema de Arquivos (Upload & UI) — ✅ CONCLUÍDO (07/03)
- [x] **Auditoria de Componentes:** Todos os componentes de upload auditados e padronizados.
- [x] `UppyFileImporter.js`: Reescrito sem Dashboard do Uppy, usando input HTML nativo + zona drag-and-drop no padrão visual do sistema.
- [x] `UppyAvatarUploader.js`: Reescrito sem `@uppy/react/dashboard`, usando Supabase Storage nativo + preview de imagem.
- [x] `UppyListUploader.js`: Já estava correto (Uppy Vanilla + GoldenRetriever + input nativo).
- [x] `MessagePanel.js` (WhatsApp): Usa DashboardPlugin via CDN no padrão correto do protocolo.
- [~] `UploadFotosRdo.js`: Página laboratorial inativa, sem risco.

### 9. CRM Multi-Funis e Roteamento de Leads (CONCLUÍDO)
- [x] Lógica de Funil de Vendas com suporte a regras de múltiplos funis.
- [x] Roteamento Automático de Leads: Correção de tipagem UUID (`funil_destino_id`) e recriação da função no banco `fn_rotear_lead`.
- [x] Limpeza de legados de banco de dados: Remoção do "Funil de Compras" obsoleto.

### 10. WhatsApp Business API (CONCLUÍDO / EM MANUTENÇÃO)
- [x] Correção do envio do Payload de Template (Bug de Código - Erro Meta #100).
- [x] Configuração Oficial do App Meta (ELO 57 - WATS): Atualização das credenciais direto no banco `configuracoes_whatsapp`, resolvendo bloqueios de anti-spam em números novos (Erro Meta #131049).
- [x] **Melhoria Técnica (08/03):** Criado `utils/phoneUtils.js` com `formatarParaWhatsAppBR()` e `formatarParaStorageBR()`. Corrigido o 9º dígito em todos os pontos de envio: `send/route.js`, `broadcastProcessor.js` e `crm/route.js`. O banco continua armazenando o número completo (com 9); a remoção do 9 ocorre somente no momento do envio à API da Meta.

### 11. Reestruturação do Sistema de Empresas (UX/Dados)
- [ ] **Diagnóstico:** A página e o sistema atual de empresas (visão, ficha, listagem) estão defasados e faltando informações.
- [ ] **Novo Layout (Ficha Completa):** Repensar toda a estrutura visual para que contenha o histórico completo, contatos, anexos e relatórios da empresa de forma clara e objetiva.

## 📝 Notas de Conversa e Decisões
- *2026-03-01:* Criação do Planejamento Master para centralizar a estratégia de lançamento.
- *2026-03-01:* Limpeza de arquivos de laboratório finalizada.
- *2026-03-01:* Sincronia de banco concluída. Scripts `sync-final.js` e `check-elo.js` criados.
- *2026-03-01:* Definida a necessidade de padronizar o sistema de upload com Protocolo Único (Uppy).
- *2026-03-02:* Lógica de Roteamento automático de leads via webhook resolvida para todos os novos funis com suporte a UUID.
- *2026-03-02:* Bug do disparo de Templates de WhatsApp corrigido (Ajuste no código + Setup com novo ID do Elo 57 Oficial).
- *2026-03-02:* Transição de Identidade Visual completa e deploy realizado para produção. (Logos, Títulos e PWA substituídos de Studio 57 para Elo 57).
- *2026-03-02:* Ajuste Global de Tema: Botões primários (sistema inteiro) alterados de azul genérico para Laranja da Marca (#ff6700) através de sobrescrita no Tailwind.
- *2026-03-03:* **Refatoração Completa da Aba Cartões de Crédito:**
    - Diagnóstico e planejamento do sistema financeiro (decisão: usar filtros ao invés de novas tabelas).
    - Interface reestruturada do `GerenciadorFaturas.js`: substituído o grid de faturas por um histórico lateral + extrato detalhado linha a linha por fatura.
    - Corrigido o agrupamento de faturas: de data exata para Mês/Ano (`substring(0, 7)`), eliminando faturas duplicadas no mesmo mês.
    - Corrigido o campo de vencimento: `dia_vencimento_fatura` (inexistente) → `dia_pagamento_fatura` (campo real da tabela `contas_financeiras`).
    - Implementado destaque visual da **Fatura Atual** (próxima a vencer >= hoje) no histórico lateral com badge azul e padding maior.
    - Implementado exibição do total de despesas em vermelho em todas as faturas do histórico lateral, com receitas em verde para facilitar conferência cruzada de faturas.
    - Implementado resumo da fatura em 3 cards: Compras/Despesas, Estornos/Pagamentos e Saldo a Pagar com fórmula visível.
    - Todos os commits feitos e deploy realizado via Netlify.
- *2026-03-05:* **Módulo de Patrimônio:** Criação da aba dedicada para Ativos e Passivos com painel gerencial (`AtivosManager`), separação do modal de criação `AtivoFormModal` resolvendo os bugs numéricos do IMask. Definida a pendência crítica de concluir a lógica matemática/visual de **vinculação entre Receitas e Ativos** para compor os saldos. Deploy realizado.
- *2026-03-06:* **Finalização da DRE e Impressão Global:**
    - Lógica estrutural consolidada para o DRE (`useRelatorioDRE.js`), scripts SQL rodados formatando categorias filhas/mestras corretamente. Interface pronta com design clean, formatador de lucros e prejuízos. Integrado na aba Relatórios com Toggle Visual.
    - **Impressão Global Standard A4 (`s57-print-area`):** Todos os componentes sensíveis (Ficha de Funcionário, Folha de Ponto, Tabelas, Recibos, Contratos, Simulador) foram padronizados, removendo os hacks de substituição do HTML do navegador. Menus ocultados com sucesso. O sistema imprime limpo sem `notifiers`.

- *2026-03-07:* **🔐 RLS Global — Blindagem Total do Banco de Dados:**
    - Criado `supabase/generate_rls.js` para gerar políticas SQL automáticas.
    - Gerado e executado `supabase/aplicar_rls_global.sql` com **121 tabelas** protegidas com 4 políticas cada (SELECT, INSERT, UPDATE, DELETE).
    - **Regra implementada:** Dados da Organização 1 (Elo 57 / Matriz) são **públicos para leitura** por qualquer usuário logado. Cada organização só pode **criar/editar/excluir** os seus próprios dados. Dados da Org 1 são somente editáveis por membros da própria Org 1.
    - Criada função `get_auth_user_org()` no Postgres para leitura segura do `organizacao_id` do usuário autenticado (evita recursão infinita).
    - **Limpeza Frontend:** Removidos os filtros redundantes de `organizacao_id` dos componentes (`empreendimentos/page.js`, `empresas/page.js`, `FichaCompletaFuncionario.js`, `ContratoDocumentos.js`, `LancamentoFormModal.js`, `EmpresaAnexosTab.js`).
- *2026-03-07:* **🐛 Fix: Modal OFX bloqueando a página inteira:**
    - Identificado que o componente `UppyFileImporter.js` renderizava um overlay fixo (`fixed inset-0`) em toda a tela mesmo quando o modal estava **fechado**, bloqueando todos os cliques.
    - Corrigido com `if (!isOpen) return null;`.
    - **Bonus:** Componente `UppyFileImporter.js` completamente reescrito, substituindo o Dashboard visual do Uppy por um modal nativo no padrão do sistema (input HTML + zona de drag-and-drop estilizada).
    - Deploy realizado.

- *2026-03-08:* **📱 Fix: Correção do 9º Dígito nos Números de WhatsApp:**
    - Criado `utils/phoneUtils.js` com `formatarParaWhatsAppBR()` (remove DDI+55 e o 9º dígito de celulares BR) e `formatarParaStorageBR()` (padroniza para armazenamento).
    - Corrigidos 4 pontos de falha silenciosa: `app/api/whatsapp/send/route.js`, `utils/broadcastProcessor.js`, `app/api/crm/route.js` e `components/contatos/PadronizacaoManager.js`.
    - **Regra final:** Banco armazena número completo com DDI e com o 9. A API da Meta recebe o número sem DDI e sem o 9 (ex: `3398182638`).
    - Deploy realizado.

- *2026-03-08:* **📱 Fix: Travamento da Caixa de Entrada no iOS/Safari (PWA):**
    - Identificado que o PWA no iPhone criava uma camada fantasma que bloqueava os toques usando `h-[100dvh]`. Trocado para `h-full` no `WhatsAppInbox.js`.
    - Resolvido o "Becos Sem Saída" (Dead End) no Mobile: ao abrir um email pelo celular, o menu principal sumia. Adicionado selector de abas `WhatsApp / E-mail` no topo do `EmailListPanel.js` exclusivo para mobile (`md:hidden`), permitindo a troca livre entre as caixas.
    - Deploy realizado.

---
*Assinado: Devonildo (Seu Mentor Técnico)*
