# 🏗️ PLANEJAMENTO MASTER - Studio 57 (Core) -> Elo 57 (Oficial)

## 📌 Governança e Objetivo
O **Studio 57** é o ambiente de desenvolvimento e laboratório central. O **Elo 57** (`elo57.com.br`) é o nome comercial e plataforma oficial de produção.
- Todo desenvolvimento e teste acontece primeiro no `studio57so-v8-main`.
- Após validação, o código é sincronizado com o repositório `elo57-lab-saas`.
- **Sincronização de Banco:** Apenas **Schemas e Funções** são espelhados do Studio para o Elo. Os **Dados** permanecem isolados para garantir a privacidade dos clientes de produção.

## 🚀 Status de Lançamento

## 🏁 Objetivos de Curto Prazo
- [x] Finalizar Sincronia de Bancos de Dados (vhuvnutzklhskkwbpxdz -> alqzomckjnefsmhusnfu).
- [x] Refinar Página de Cadastro de Organização (UI/UX e Dados Completos).
- [ ] Validar Fluxo de Cadastro e Login em dispositivos Mobile (PWA).
- [ ] **Migração do WABA Oficial (Meta):** Transferir os tokens de acesso e IDs de webhook para o novo aplicativo oficial recém-aprovado, garantindo governança limpa de mensagens sem restrições.
- [x] Checklist Legal: Revisar textos das Políticas Públicas.
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
- [x] Setup do Repositório de Produção (`elo57-lab-saas`) sincronizado. ✅ **(09/03)**
- [x] Rotina de Sincronização de Banco (Schema Sync). ✅ **Método Oficial sem Docker criado (09/03)**

### 4. Onboarding de Clientes (CONCLUÍDO)
- [x] Nova UI para `app/cadastro/page.js` (Estilo Premium e Bifásico).
- [x] Chaveador de Natureza Jurídica (Pessoa Física vs Pessoa Jurídica).
- [x] Coleta de dados completa:
    - **Pessoa (Usuário):** Nome, CPF, E-mail, Celular.
    - **Organização/Profissional:** Nome Fantasia/Razão, CNPJ (se PJ), Endereço, Logo.
- [x] **Arquitetura Técnica (Definida em 01/03):** 
    - Adicionar `entidade_principal_id` na tabela `organizacoes`.
    - Flexibilizar `cadastro_empresa` (CNPJ e Razão Social como opcionais).
    - Fluxo: Criar Org -> Criar Entidade (PF/PJ) -> Vincular Org à Entidade -> Criar User Admin.
- [x] Integração com APIs de busca (ViaCEP e CNPJ).
- [x] Fluxo de boas-vindas pós-cadastro e tour inicial.

### 5. Sistema de Pagamentos e Core Financeiro (CRÍTICO)
- [x] **Definição de Provedor:** Definido **Asaas** como gateway oficial por sua API amigável (Node/Next), split nativo, webhook poderoso, emissão de NFe e Pix automático.
- [x] **Demonstrativo de Resultados (DRE):** Implementar visão de competência (Receitas vs Despesas vs Lucro Líquido).
- [x] **Relatório de Contratos Ativos:** Implementar visão consolidada de VGV, % de Quitação (Pago x Pendente) e status de Inadimplência na Central Financeira.
- [x] **Lógica de Cartão de Crédito — Separação Visual (03/03):** Aba "Cartões" reestruturada:
    - Agrupamento correto de lançamentos por Mês/Ano da fatura (usando `dia_pagamento_fatura`).
    - Histórico lateral com valor total de despesas por fatura e destaque visual da Fatura Atual (próximo vencimento).
    - Extrato linha a linha dentro de cada fatura (Data, Descrição, Valor).
    - Resumo com 3 cards separados: **Compras/Despesas** | **Estornos/Pagamentos** | **Saldo a Pagar**.
- [x] **Gestão de Ativos e Passivos Patrimoniais (05/03):**
    - [x] Criado `AtivosManager` com design dedicado da Família A (`DESIGN_SYSTEM.md`).
    - [x] Criado `AtivoFormModal` para inclusão e edição corrigindo a renderização do valor real.
    - [x] Criar a vinculação de Receitas com Ativos (amortização/redução de patrimônio nas vendas parciais ou totais).
- [ ] Implementar Webhooks para controle de status de assinatura.
- [ ] Criar Dashboard de Faturamento para o cliente (Portal do Assinante).
- [ ] Bloqueio de funcionalidades por status de pagamento (Inadimplência).
- [ ] **Auditoria de VGV:** Desenvolver interface/relatório no front-end para consumir e exibir o histórico inteligente da tabela `historico_vgv` (linha do tempo de valorização dos empreendimentos).

### 6. Branding e Identidade Visual (Transição Elo 57)
- [x] **Rename:** Substituir ocorrências de "Studio 57" por "Elo 57" na interface.
- [x] **Assets:** Gerar e implementar Favicon (ícone da aba) e Ícones PWA (192x192, 512x512).
- [x] **Logotipo:** Definir e aplicar Logo Retangular e Logo Quadrada (Marca d'água) em navegação, login e relatórios (BIM, Simulador, RDO, Tabela de Venda).
- [x] **Mobile:** Configurar ícone de notificação para dispositivos móveis (Android/iOS) no `manifest.json` e `custom-sw.js`.
- [ ] **Meta Ads:** Atualizar criativos e nomes nos aplicativos da Meta.

### 7. Governança de Aplicativos Meta (ESTRATÉGIA DEFINIDA)
- [x] **Auditoria de Apps:** Identificadas todas as instâncias para evitar confusão.
- [x] **Aprovação WABA (08/03):** Permissão inicial da Meta concedida para gerenciar mensagens de clientes.
- [x] **Conquista de Permissões SaaS (24/03):** Temos a aprovação das permissões avançadas `whatsapp_business_management` e `whatsapp_business_messaging` (Status: "Pronto para publicar"). **Vitória:** Temos absolutamente tudo o que precisamos nativamente para permitir que nossos clientes conectem e utilizem seus próprios números de WhatsApp de forma 100% integrada ao nosso sistema ("Embedded Signup").
- [ ] **Migração Definitiva de App WABA:** Atualizar o banco de dados e as variáveis de ambiente com o System User Token do novo App oficial para encerrar apps espelhos legados.
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
    - **Regra implementada (Multitenancy SaaS):** Dados da Organização 1 (Elo 57 / Matriz) são **públicos para leitura** por qualquer usuário logado `(organizacao_id = get_auth_user_org() OR organizacao_id = 1)`. Cada organização só pode **criar/editar/excluir** os seus próprios dados. Dados da Org 1 são somente editáveis por membros da própria Org 1.
    - **REGRA INQUEBRÁVEL (Nulos/Globais):** O sistema NÃO DEVE usar `organizacao_id IS NULL` para burlar RLS (risco de segurança grave). Registros globais do sistema **obrigatóriamente** pertencem à Organização 1. A ausência de ID (Null) é indicativo de falha de script e os dados ficarão invisíveis.
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

- *2026-03-08:* **🟢 Aprovação Oficial da Meta (WABA):**
    - Obtivemos permissão oficial da Meta para que o nosso App possa gerenciar todas as mensagens dos clientes.
    - A conversão definitiva de App precisará ser feita em algum momento, mas foi decidido **não fazer isso agora** para focar nos outros módulos críticos do lançamento. O atual continua rodando.

- *2026-03-08:* **🏢 Refatoração do Cadastro PF/PJ e Checkout (Onboarding):**
    - Front-end (`app/cadastro/page.js`) recriado como Wizard Premium (Passo-a-passo) com logo oficial.
    - Integração de busca automática de CNPJ (BrasilAPI) e CEP (ViaCEP).
    - Validador visual inteligente adicionado na etapa de "Confirmar Senha".
    - Back-end (`app/cadastro/actions.js`) refatorado para usar `SUPABASE_SERVICE_ROLE_KEY` permitindo a criação do tripé de Entrada Local (Organização -> Empresa/Autônomo -> Administrador) mesmo para usuários não-autenticados.
    - Script rodado no banco de dados de Produção liberando o "NOT NULL" do CNPJ para aceitar os cadastros do tipo Pessoa Física e Autônomos sem explodir erros.
    - Correção e Transferência dos Cargos (Funções e Permissões) da ORG 2 para a ORG Master 1, resolvendo o bloqueio do RLS e habilitando os Menus Laterais automaticamente logo no primeiro login dos novos usuários! 🚀
    - Subida do HTML oficial responsivo no Email Template do Auth do Supabase!

- *2026-03-08:* **🏢 Saneamento Financeiro de Lançamentos Órfãos e Correção de Abas:**
    - Diagnóstico de base legado: identificados +200 lançamentos no banco de dados sem a "Foreign Key" `contrato_id` apontada.
    - Script SQL via Regex/Match text rodado para atrelar a numeração da descrição dos boletos (ex: "Contrato #10") com seus devidos ID's de Banco de Dados. Lote automático validado.
    - Correção específica do Contato "José Rogério de Paiva" dividindo os lançamentos residuais de 2 filhos (AP 401 e AP 501) com precisão. Base 100% limpa.
    - Front-End **Aba Lançamentos (FichaContrato)** corrigida: O filtro da tabela agora puxa rigorosamente por `contrato_id` (ID do Contrato aberto no momento) invés de `favorecido_contato_id` (que causava mistura dos saldos de outros lotes/apartamentos do mesmo dono).
    - Subindo versão para o ambiente oficial Netlify.

- *2026-03-09:* **🏦 Conciliação Bancária OFX Avançada (Borderôs e UI Inteligente):**
    - Implementado suporte a **Borderôs** (Agrupamento de lançamentos por `agrupamento_id`) no Extrato e no Conciliador OFX, permitindo conciliar um único OFX com múltiplos lançamentos do sistema que compõem aquele valor.
    - Alterado `fitid_banco` do banco de dados (removido *Unique Constraint*) para aceitar o vínculo da FK do primeiro lançamento filho do borderô.
    - Criada memória persistente de Conta Bancária no localStorage para evitar perda de contexto ao navegar entre abas.
    - UX Aprimorada: Barra de resumo no `PanelConciliacaoOFX` passando a exibir o valor total da soma dos itens a serem agrupados.
    - Modal de Novo Lançamento turbinado para auto-preencher rapidamente a **Empresa** com base na Conta Bancária importada do OFX.
    - Ajustado o *Z-index* do modal de Lançamentos para evitar sobreposição pela Action Bar de conciliação do Painel OFX.
    - Inserida categoria faltante "Estorno (Receita)" diretamente via script SQL no Supabase.

- *2026-03-09:* **🧹 Organização da Raiz do Projeto:**
    - Pasta raiz limpa: arquivos de log, JSONs de teste e scripts temporários deletados.
    - Arquivos úteis organizados nas pastas `docs/`, `scripts/` e `supabase/`.

- *2026-03-09:* **📚 Unificação dos Manuais de Design:**
    - Conteúdo do `PADRAO_OURO_UI.md` fundido dentro do `DESIGN_SYSTEM.md` como **Manual Supremo de UI/UX** (Versão 2.0).
    - Arquivo `PADRAO_OURO_UI.md` deletado para eliminar redundância.
    - Workflow `/iniciar` atualizado para referenciar apenas o `DESIGN_SYSTEM.md`.

- *2026-03-09:* **🧠 Planejamento: Migração do WABA Oficial (Meta):**
    - Registrada a tarefa de migrar os tokens e IDs do WhatsApp Business API para o novo app oficial recém-aprovado pela Meta.

- *2026-03-09:* **🏦 Novo Método de Sincronização de Banco (Sem Docker):**
    - Identificado que o `supabase db dump` exige Docker (indisponível na máquina).
    - Criado `supabase/migrar-studio-elo.js`: script nativo Node.js que sincroniza **Funções/RPCs + RLS + Colunas/Tabelas** diretamente via conexão Postgres, sem necessidade de Docker.
    - Migração completa executada com sucesso: 122 tabelas confirmadas no Elo 57 com todas as políticas RLS aplicadas.
    - Arquivo de migração salvo em `supabase/migrations/20260309_full_sync.sql`.
    - Workflow `/espelhardb` **completamente reescrito** para adotar o novo método oficial.

- *2026-03-09:* **🚀 Repositório de Produção Sincronizado:**
    - Código do projeto enviado para `https://github.com/rannicamp/elo57-lab-saas.git`.
    - Pasta `app/(landingpages)` excluída do push via `git rm --cached` + `.gitignore` (exclusiva do Studio 57).
    - Ambos os remotos (`origin` e `lab-saas`) estão sincronizados com o commit mais recente.

---

- *2026-03-11:* **🤖 Módulo de Importação de Faturas de Cartão via IA — Avanços e Correções:**

    **✅ O que conquistamos:**
    - **Visualizador de PDF inline:** Implementado `FaturaPreviewPanel` no `ExtratoCartaoManager.js`. Ao importar uma fatura, o PDF original é salvo no bucket `documentos-financeiro/faturas-cartao/`. O card do arquivo na UI é clicável e abre o PDF num painel lateral (igual ao `LancamentoDetalhesSidebar`). A URL pública completa é salva em `banco_arquivos_ofx.arquivo_url`.
    - **Novo fluxo de extração com `pdf-parse`:** Instalada a biblioteca `pdf-parse`. Antes de enviar para o Gemini, o texto puro é extraído localmente. Isso reduz o payload ~10x, economiza cota da API e evita rate limit. Mantém fallback para PDFs escaneados.
    - **Prompt com "Regras de Ouro":** O prompt da rota `app/api/cartoes/extrair-fatura/route.js` foi reescrito incorporando as regras do agente Gemini do Ranniere: ignorar lixo (saldo anterior, total, juros, parcelas futuras), tratamento correto de data com virada de ano (Dez→Jan), valores positivos + campo `tipo` separando Despesa/Receita.
    - **Fix do arquivo invisível:** Corrigido bug crítico onde `continue` abortava toda a inserção quando `lancamentos.length === 0`. Agora o arquivo `banco_arquivos_ofx` é salvo mesmo sem lançamentos — badge IA 🪄, botão Conciliar e card clicável aparecem corretamente.
    - **Organização da pasta `faturas/`:** PDFs organizados automaticamente em subpastas por conta/cartão usando keywords dos nomes de arquivo: `BB-Sonia-4724/`, `BB-Igor-0753/`, `BB-Igor-3093/`, `Caixa-2399/`, `SICOOB-AC-Credi-7841/`, `SICOOB-Credioriodoce-6482/`, `SICOOB-7346/`.
    - **IA lendo PDFs para classificação:** Usamos o Gemini (`gemini-2.5-flash`) via script de linha de comando para ler PDFs desconhecidos e identificar banco, titular e final do cartão. Funcionou para classificar o `25-04_FAT CARTÃO_REF ABR25.pdf` (→ SICOOB final 7346) e o `25-06_FAT_FATURA BB JUN25.pdf` (→ Igor, final 3093).
    - **numero_conta da Sônia atualizado:** Descoberto que a Sônia tem cartão final `4724`. Atualizado `contas_financeiras` ID 27 com `numero_conta = '4724'` para o sistema reconhecer automaticamente nas próximas importações.
    - **Limpeza de duplicatas:** Unificadas contas duplicadas criadas pela IA (final 0753 tinha 8 contas → mantida ID 29). Migradas transações, faturas e OFX para a conta certa.

    **😤 Frustrações e Limitações enfrentadas:**
    - **Rate Limit do Gemini free (429):** A API gratuita tem limite de ~20 RPM. Ao testar sequencialmente vários PDFs, travava com erro `retryDelay: 56s`. Isso vai continuar sendo um problema se o usuário importar muitas faturas de uma vez. **Solução futura:** implementar fila com delay entre requisições ou usar API paga (Pay-as-you-go).
    - **`totalInjected = 0` confuso:** O toast dizia "0 cartão(ões)" mesmo quando a extração funcionou, pois o contador só incrementava após inserir transações. Corrigido, mas revelou que o novo fluxo `pdf-parse` pode retornar texto que a IA não consegue converter em lançamentos bem formatados dependendo do PDF.
    - **PDF-parse + texto mal formatado:** O `pdf-parse` extrai texto mas os PDFs de fatura de banco têm layout colunar complexo. O texto extraído pode ter palavras embaralhadas (ex: "Limite Créditomplementar"). Para PDFs simples funcionou; para faturas complexas, a qualidade do texto precisa ser validada.
    - **Arquivo não aparecia na fatura correta:** O filtro `a.periodo_inicio === fatura.data_vencimento` exige que a data de vencimento extraída pela IA bata exatamente com a data da fatura no sistema. Qualquer diferença de 1 dia deixa o arquivo invisível.

    **🎯 Próximos passos para amanhã:**
    - [ ] **Testar o fluxo completo de ponta a ponta:** Importar uma fatura pelo sistema (não por script), verificar se o badge IA, o botão Conciliar e o viewer 👁️ aparecem corretamente.
    - [ ] **Validar qualidade do texto extraído:** Abrir o console do navegador (F12) e checar o `console.log('[IA] ...')` para ver o que a IA está retornando de `lancamentos`.
    - [ ] **Fila de processamento com delay:** Implementar delay de 3–5s entre requisições no `handlePdfUpload` para evitar rate limit ao importar múltiplas faturas.
    - [ ] **Importar todas as faturas organizadas:** Com a pasta `faturas/` bem organizada por conta, fazer a importação completa de todas as faturas de cada cartão.
    - [ ] **Revisar o filtro de `periodo_inicio`:** Talvez salvar também o `mes_referencia` no arquivo e usar isso para o filtro, ao invés de comparar datas exatas.
    - [ ] **Conciliar as faturas importadas:** Após importar, usar o `PanelConciliacaoCartao` para ligar as transações da IA com os lançamentos do sistema.


---

- *2026-03-14:* **🏗️ Unificação do BIM Manager com Orçamentação (Quantitativos):**
    - A antiga rota `/quantitativos` foi deletada e transformada no componente `BimQuantitativosOverlay.js` rodando num ecossistema único (SPA).
    - O Orçamento agora abre como um modal funcional dentro do BIM Manager (`app/(bim)/bim-manager/page.js`), obedecendo a área da tag `<main>`.
    - Mantivemos a `BimSidebar` (Navegador BIM) sempre visível durante o orçamento.
    - Limpeza de UI no cabeçalho do orçamento, com campo de busca e de expandir/contrair ancorados junto às abas, otimizando o preenchimento da `table` de elementos BIM.
    - **Próximo Trabalho Imediato:** Continuar no planejamento estratégico do BIM em Orçamentos. Refinar usabilidade de fluxos de orçamentação amanhã.

---

- *2026-03-15:* **🤖 Evolução do Copilot de Atividades para Agente Autônomo (RAG / Tool Calling):**
    - Identificado que o antigo modelo de injetar 50 atividades simultâneas no contexto do chat (`/api/ai/agent-tasks`) estava obsoleto e consumindo limites da API, além de gerar alucinações.
    - **Criação da SQL RPC `buscar_atividades_ai`:** Foi desenvolvida no Supabase uma função avançada que funciona como a "lupa" do Copilot, permitindo filtros cruzados por *Organização, Empreendimento, Funcionário (ID real), Termo Textual e Status*, garantindo que a IA nunca busque informações fora de sua governança (RLS).
    - **Refatoração do Gemini (Function Calling):** A engine da IA foi movida diretamente para o Server Action `actions-ai.js`. O bot foi re-treinado para trabalhar com o modelo `gemini-2.5-flash`, perdendo o vício de adivinhar informações e sendo forçado a entrevistar o usuário para captar Datas, Duração e Responsáveis.
    - **Loop de Ferramentas:** Quando um usuário pede para editar, a IA nativamente dispara a ferramenta `buscar_atividades`, cruza dados do banco em microssegundos e devolve apenas os cartões que de fato existem, com IDs corretos, prontos para a função UPDATE. JSON rigoroso definido via *System Prompt*. Bug de `Mime Type` em versões restritivas resolvido com sucesso! Deploy realizado.

---

- *2026-03-19:* **🏢 Estruturação Avançada de Branding, Relatórios e Auditoria de VGV:**
    - **Integração Meta Ads Completa:** Criada a tabela de normalização `meta_ativos` acoplada ao Webhook. O CRM passa a espelhar dinamicamente os nomes de Campanhas, Conjuntos e Anúncios dos IDs recuperados do Meta via JOIN.
    - **Branding Dinâmico (Tabela de Vendas):** Banco de dados expandido com `logo_url` para `cadastro_empresa` e Uppy implementado para o upload de marcas. O PDF exportado agora monta um Header Executivo Triplo: Marca da Construtora (esq), Título (centro) e Empreendimento (dir).
    - **Termos e Condições (Live Edit):** Ferramenta acoplada no rodapé da tabela para edição de texto in-line em tempo real (TanStack Query/Supabase). Permite gravar Juros/INCC variáveis para cada Empreendimento antes de gerar o PDF.
    - **Vacina CSS Anti-White-Pages:** Resolvido o bug crítico de páginas em branco vazando na impressão. Reset bruto no `@media print` forçou o React a ignorar o layout das Sanfonas, limitando a renderização 100% à classe `.printable-content-area`.
    - **Vigia Automático de VGV (Trigger SQL):** Implantada uma nova camada de auditoria infraestrutural no Postgres (`historico_vgv`). Desenvolvido um Trigger "Watchdog" atrelado à tabela `produtos_empreendimento`, que a cada mudança de preço, recalcula em milissegundos o VGV novo e grava de forma imutável o delta anterior/atual e o responsável pela edição.
    - **Blindagem Temporal de Faturas de Cartão:** Ao conciliar extratos de cartão gerados por IA, o sistema agora ancora a `data_pagamento` e `data_vencimento` na data de vencimento da fatura ativa (`faturaVencimento`). Isso impede que parcelas antigas de compras passadas voltem no tempo, alterando as métricas de prestação de contas do mês atual (DRE e Caixa 100% corretos!).

---

- *2026-03-19 (tarde):* **📬 Evolução Completa do Módulo de E-mail:**
    - **Diagnóstico de Pastas Vazias:** Investigação profunda dos erros 401 e 404 no IMAP. Criada rota de diagnóstico `api/email/diagnose` que inspeciona as credenciais salvas no banco e testa a conexão IMAP ao vivo, retornando detalhes completos do erro.
    - **Log de Diagnóstico Detalhado:** O `imap_debug.log` foi turbinado para registrar todos os campos do erro IMAP em JSON (`message`, `textCode`, `source`, `stack`), facilitando investigações futuras.
    - **Auto-cura de E-mails Fantasmas (404):** Quando o servidor IMAP da Hostinger informa que um e-mail não existe mais, a API `api/email/content` agora o **deleta automaticamente** do cache `email_messages_cache`, evitando sujeira acumulada.
    - **Modal de Reautenticação Expresso com Olho de Senha:** O `AccountFolderTree` ganhou um modal inline para redigitar a senha sem precisar navegar para configurações. Adicionado botão 👁️ olho para visualizar/esconder a senha antes de salvar.
    - **👁️ Olho na Senha — Configurações de E-mail:** Campo `senha_app` no `EmailConnectionConfig.js` ganhou botão de toggle visibilidade da senha, facilitando conferência.
    - **Busca Reposicionada:** A caixa de pesquisa saiu da barra lateral de pastas e foi movida para cima da lista de e-mails, no topo do `EmailListPanel.js`, com botão ✕ para limpar a busca rapidamente.
    - **🔍 Busca Global com Highlight Amarelo (marca-texto):** A busca agora varre **todas as pastas da conta** e pesquisa em: `subject`, `from_text`, `to_text`, `cc_text` e **`text_body`** (corpo do e-mail). Os resultados exibem:
        - 🟡 Termos marcados em amarelo no remetente, assunto e preview do corpo.
        - 📄 Trecho do corpo do e-mail abaixo do assunto como preview.
        - 📂 Badge azul indicando a pasta de origem do e-mail encontrado.
    - **Causa raiz das "pastas vazias":** Descoberto que era simplesmente um **filtro de status aplicado na interface** (não um bug de conexão). O sistema estava funcionando corretamente e exibindo apenas e-mails que correspondiam ao filtro ativo.

---

- *2026-03-23:* **📄 Gerador Dinâmico de Contratos e Otimização PDF:**
    - **Conversor Inteligente:** Adicionada rotina de conversão nativa de um `Termo de Interesse` para `Contrato` em tempo real na aba de Ficha, mantendo as reservas da unidade do cliente.
    - **Painel de Variáveis Contratuais:** Parâmetros Avançados injetados na Ficha de Venda (Índices INCC/IPCA, Periodicidade, Multa, Juros de Mora, Cláusula Penal), salvos e consumidos diretamente do Banco de Dados para auto-preenchimento do Documento.
    - **Compressão Extrema `@media print`:** O layout do PDF do Quadro Resumo foi enxugado com precisão cirúrgica no Tailwind. Margens, bordas extras e paddings foram extirpados na renderização de impressão.
    - **Limpeza Front-End de Componentes Inúteis:** Remoção total (do DB ao HTML) das cláusulas cruas 9, 10 e 11 do Quadro Resumo (apenas apontavam para as cláusulas), alcançando a marca impecável de apenas 2 páginas.
    - **Fidelidade e Restauração de Minuta Histórica:** A redação rebuscada que o sistema sugeriu e poluiu visualmente as obrigações foi completamente revertida e alinhada com as minutas em Word idênticas aprovadas pelos Cartórios locais do cliente.

- *2026-03-23 (tarde):* **🐛 Correções Críticas no Simulador e Ações em Lote:**
    - **Diagnóstico Transparente em Modais:** Resolvido o bug onde as "Etapas de Obra" não carregavam na ferramenta de Ações em Lote (Financeiro). O filtro agora reconhece as etapas globais nativas (cadastro da matriz org=1) permitindo edições massivas limpas.
    - **Unificação da Rota do Simulador:** Restaurado o Simulador de Financiamento na navegação oficial do painel (removido `target="_blank"`). A arquitetura atual utiliza o componente universal `SimuladorTabs`.
    - **Blindagem Anti-Crash (Application Error):** Escudo preventivo inserido contra telas brancas da morte no formulário de busca de clientes do Simulador. Resolvido o erro letal gerado por chamadas imperativas de `toLowerCase()` em contatos históricos do CRM que estavam desprovidos de caracter/nome (`null`).

---

### 12. Gestão de Custos BIM (Autodesk API) - *A FAZER*
- [ ] **Diagnóstico:** A Autodesk cobra via "Flex Tokens" (aprox. U$ 4.50 ou R$ 25,00 por tradução de arquivo complexo como `.rvt` ou `.ifc`). O Studio 57 precisa repassar ou amortizar este custo.
- [ ] **Sistema de Créditos:** Criar tabela `carteira_bim` no banco de dados.
- [ ] **Planos/Pacotes:** Permitir que o cliente compre lotes de créditos (ex: 10 uploads).
- [ ] **Bloqueio no Front-end/Back-end:** Antes de iniciar o `upload-direct-start`, verificar saldo na `carteira_bim`. Se saldo > 0, desconta 1 e permite o upload. Se saldo = 0, exibir modal para compra de pacote.

---

### 13. 📸 Melhorias da Integração Instagram - *A FAZER (FUTURAMENTE)*

> **Status atual (20/03/2026):** Caixa de entrada de DMs do Instagram operacional! Conversas sincronizadas, mensagens lidas e envio de respostas funcionando via `graph.instagram.com`. Webhook configurado em produção.

#### Melhorias Planejadas:
- [ ] **Link DM ↔ Lead no CRM:** Quando um DM chegar, verificar automaticamente se o remetente já é um lead na base. Se sim, exibir o card do lead na sidebar do chat.
- [ ] **Sidebar de Perfil do Contato:** Ao abrir um DM, mostrar followers, bio, foto e últimos posts da pessoa.
- [ ] **Módulo de Comentários:** Ler e responder comentários dos posts do @arqstudio57 direto do CRM sem abrir o Instagram.
- [ ] **Dashboard de Engajamento:** Painel com métricas por post (alcance, impressões, curtidas, salvamentos) e crescimento de seguidores.
- [ ] **Auto-resposta por Palavra-chave:** Configurar respostas automáticas para DMs com palavras específicas (ex: "preço", "orçamento").
- [ ] **Análise de Melhor Horário:** Usar Insights da API para identificar quando o público está mais ativo.
- [ ] **Token de Longa Duração:** Automatizar a renovação do Instagram Access Token antes de expirar (60 dias).

---

### 14. 🧮 Unificação dos Simuladores Financeiros - *A FAZER (FUTURAMENTE)*
- [ ] **Unificar Simulador Geral e Braúnas:** Deletar o `SimuladorBraunas.js` e concentrar toda a lógica no `SimuladorFinanceiroPublico.js` de forma dinâmica.
- [ ] **Toggle de Correção Anual (Motor Híbrido):** Criar um botão inovador do tipo "Aplicar INCC + 11%" que, quando ativado, puxa a API de índices e recalcula o aniversário de parcelas.
- [ ] **Limpeza de Interface:** Remover o componente de `SimuladorTabs` da Tabela de Vendas do Corretor, deixando uma única ferramenta central e poderosa que serve para qualquer cenário de loteamento.

---
*Assinado: Devonildo (Seu Mentor Técnico)*
