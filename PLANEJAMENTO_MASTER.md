# 🏗️ PLANEJAMENTO MASTER - Studio 57 (Core) -> Elo 57 (Oficial)

## 📌 Governança e Objetivo
O **Studio 57** é o ambiente de desenvolvimento e laboratório central. O **Elo 57** (`elo57.com.br`) é o nome comercial e plataforma oficial de produção.
- Todo desenvolvimento e teste acontece primeiro no `studio57so-v8-main`.
- Após validação, o código é sincronizado com o repositório `elo57-lab-saas`.
- **Sincronização de Banco:** Apenas **Schemas e Funções** são espelhados do Studio para o Elo. Os **Dados** permanecem isolados para garantir a privacidade dos clientes de produção.

## 🚀 Status de Lançamento

## 🏁 Objetivos de Curto Prazo
- [ ] Finalizar Sincronia de Bancos de Dados (vhuvnutzklhskkwbpxdz -> alqzomckjnefsmhusnfu).
- [/] Refinar Página de Cadastro de Organização (UI/UX e Dados Completos).
- [ ] Validar Fluxo de Cadastro e Login em dispositivos Mobile (PWA).
- [ ] Checklist Legal: Revisar textos das Políticas Públicas.

## 🏗️ Módulos Críticos para o Lançamento
### 1. Compliance e Segurança (95%)
- [x] Super Admin Redirection.
- [x] Matriz de Aceites (Multi-contratos).
- [x] Central de Políticas Públicas (/politicas).
- [ ] Auditoria Final de RLS (Row Level Security).

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
- [ ] **Demonstrativo de Resultados (DRE):** Implementar visão de competência (Receitas vs Despesas vs Lucro Líquido).
- [ ] **Lógica de Cartão de Crédito:** Separar de "transferências". Criar fluxo de: Lançamento -> Taxa Operadora -> Liquidação (Recebimento).
- [ ] Implementar Webhooks para controle de status de assinatura.
- [ ] Criar Dashboard de Faturamento para o cliente (Portal do Assinante).
- [ ] Bloqueio de funcionalidades por status de pagamento (Inadimplência).

### 6. Branding e Identidade Visual (Transição Elo 57)
- [ ] **Rename:** Substituir ocorrências de "Studio 57" por "Elo 57" na interface.
- [ ] **Assets:** Gerar e implementar Favicon (ícone da aba).
- [ ] **Logotipo:** Definir e aplicar Logo Retangular e Logo Quadrada (Marca d'água).
- [ ] **Mobile:** Configurar ícone de notificação para dispositivos móveis (Android/iOS).
- [ ] **Meta Ads:** Atualizar criativos e nomes nos aplicativos da Meta.

### 7. Governança de Aplicativos Meta (ORGANIZAR)
- [ ] **Auditoria de Apps:** Identificar e desativar duplicatas.
- [ ] **Estratégia de Separação:**
    - **App 1 (Marketing/CRM):** Focado em Leads, Conversões e Pixel.
    - **App 2 (WhatsApp Business):** Exclusivo para a API de WhatsApp (Elo 57 - wa).
- [ ] **Lista de Identificados (Screenshot 01/03):**
    1. CRM - Studio 57 (1518358099511142) - *Ativo*
    2. ELO 57 - WATS (2052352668968564) - *Dev*
    3. ELO 57 - WATS (1459952825742829) - *Dev*
    4. Elo 57 - Dev (1900130190871246) - *Dev*
    5. Elo 57 - Dev (749147054935696) - *Dev*
    6. Elo 57 - wa (1472719784079456) - *Dev*
    7. Studio 57 gestor (1827368137825495)
    8. CRM - Studio 57 - 2 (23905100505840850)
    9. Studio 57 gestor (701113019490938)
- [ ] **Ação:** Definir os "Sobreviventes" para Produção e Produção-Dev.

## 📝 Notas de Conversa e Decisões
- *2026-03-01:* Criação do Planejamento Master para centralizar a estratégia de lançamento.
- *2026-03-01:* Limpeza de arquivos de laboratório finalizada.

---
*Assinado: Devonildo (Seu Mentor Técnico)*
