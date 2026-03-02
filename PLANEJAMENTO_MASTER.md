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
- [ ] **Padronizar o Sistema de Upload** em todo o sistema (Protocolo Único com Uppy).

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

### 8. Padronização do Sistema de Upload (MELHORIA TÉCNICA)
- [ ] **Auditoria:** Mapear todos os pontos do sistema que fazem upload de arquivos.
- [ ] **Protocolo Único:** Garantir que 100% dos uploads usam **Uppy v5.2.1** + **GoldenRetriever** (anti-crash).
- [ ] **Regras do Protocolo Anti-Crash (obrigatórias em todo upload):**
    - CSS via `<link>` CDN no JSX (NUNCA importar via JS).
    - Usar `@uppy/core`, `@uppy/dashboard`, `@uppy/xhr-upload` e `@uppy/golden-retriever`.
    - NUNCA usar componentes visuais do `@uppy/react`.
    - Upload direto para o Supabase Storage via XHR.
- [ ] **Componente Global:** Criar `components/ui/UppyUploader.js` — componente reutilizável único.
- [ ] **Refatorar:** Substituir todos os `<input type="file">` avulsos pelo componente global.
- [ ] **Teste de Crash:** Validar que o GoldenRetriever recupera uploads interrompidos.

### 9. CRM Multi-Funis e Roteamento de Leads (CONCLUÍDO)
- [x] Lógica de Funil de Vendas com suporte a regras de múltiplos funis.
- [x] Roteamento Automático de Leads: Correção de tipagem UUID (`funil_destino_id`) e recriação da função no banco `fn_rotear_lead`.
- [x] Limpeza de legados de banco de dados: Remoção do "Funil de Compras" obsoleto.

### 10. WhatsApp Business API (CONCLUÍDO / EM MANUTENÇÃO)
- [x] Correção do envio do Payload de Template (Bug de Código - Erro Meta #100).
- [x] Configuração Oficial do App Meta (ELO 57 - WATS): Atualização das credenciais direto no banco `configuracoes_whatsapp`, resolvendo bloqueios de anti-spam em números novos (Erro Meta #131049).
- [ ] **Melhoria Técnica:** Revisar e padronizar como os números de telefone são tratados/salvos no contato (remoção de +55, caracteres especiais e validação de 9º dígito) para evitar falhas silenciosas na Meta API.

## 📝 Notas de Conversa e Decisões
- *2026-03-01:* Criação do Planejamento Master para centralizar a estratégia de lançamento.
- *2026-03-01:* Limpeza de arquivos de laboratório finalizada.
- *2026-03-01:* Sincronia de banco concluída. Scripts `sync-final.js` e `check-elo.js` criados.
- *2026-03-01:* Definida a necessidade de padronizar o sistema de upload com Protocolo Único (Uppy).
- *2026-03-02:* Lógica de Roteamento automático de leads via webhook resolvida para todos os novos funis com suporte a UUID.
- *2026-03-02:* Bug do disparo de Templates de WhatsApp corrigido (Ajuste no código + Setup com novo ID do Elo 57 Oficial).

---
*Assinado: Devonildo (Seu Mentor Técnico)*
