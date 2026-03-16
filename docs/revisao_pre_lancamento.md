# Revisão Mestra Pré-Lançamento (Studio 57)

Este documento contém a auditoria completa do sistema antes do lançamento público. A varredura busca por:
1. Violações das Regras Globais (Uploads, TanStack Query, Manipulação de Datas).
2. Design e UI fora do padrão do Design System.
3. Arquivos órfãos ou ferramentas não utilizadas.
4. Bugs potenciais ou códigos inacabados (TODOs).

---

## 1. Compliance Base & Protocolos (Global)
✅ **Status do Uppy / Uploads:** O protocolo Anti-Crash está sendo 100% respeitado. Nenhum import nativo de CSS via JS e nenhum uso indevido do UI `@uppy/react` nas dezenas de componentes.
✅ **Landing Pages:** O uso de gradientes e layouts mais dinâmicos nas landing pages (`app/(landingpages)`) está alinhado com o apelo de marketing, logo, não configuram "violação de interface interna" (painel logado).

## 2. Violações de Interface (Design System) e Ícones Proibidos (Por Módulo)

### 📊 Módulo Financeiro
- **Problema de Design (Degradês Proibidos):** Detectado intenso uso da classe proibida `bg-gradient-to-...` em botões principais de ações e background de cards de relatórios.
  - *Arquivos impactados:* `ConciliacaoManager.js`, `PanelConciliacaoOFX.js`, `PanelConciliacaoCartao.js`, `AuditoriaFinanceira.js`, `FinanceiroDRE.js` (Todos dentro de `components/financeiro`).
  - *Sugestão de Correção:* Padronizar os fundos para cores sólidas do Studio 57, como `bg-blue-600` ou `bg-gray-50`. Modificar classes como `from-green-500 to-emerald-600` para `bg-green-600`.
- **Problema de Ícones Obsoletos:** Em vez de usar a tipologia de ícone único (Regra Suprema).
  - *Arquivos impactados:* `LancamentoForm/FormAnexos.js` (uso de `faTrashAlt`), `ConciliacaoManager` e Painéis Conciliadores (uso de `faPenToSquare`).
  - *Sugestão:* Mudar todos para `faTrash` e `faEdit`.

### 🗂 Módulo CRM / Contatos
- **Problema de Design:** `app/(main)/crm/automacao/page.js` possui um layout com gradiente em cards de automação (`from-blue-50 to-indigo-50`). Fere a sobriedade.
  - *Sugestão:* Mudar para `bg-blue-50 border border-blue-200`.
- **Problema de Ícones Obsoletos:**
  - *Arquivos:* `ContatoForm.js` e `ContatoList.js` usam intensamente o `faTrashAlt`.
  - *Sugestão:* Substituir unicamente por `faTrash`.

### 👥 Módulo RH / Equipe / Profile
- **Problema de Design:** O fundo do perfil em `ProfileForm.js` está carregado como `from-blue-600 to-indigo-600`.

### 📌 Módulo de Atividades
- **Problema de Design e Ícone:** `app/(main)/atividades/page.js` usa botão "Salvar" de cor gradiente. A sidebar de Detalhes e os Anexos continuam insistindo no uso do `faPenToSquare` e `faTrashAlt`.

### 🗄 Módulo Almoxarifado / Documentos / Email
- *Arquivos Violadores de Ícones:* `AdicionarMaterialManualModal.js` (`faPenToSquare`), `EmailComposeModal.js` (`faTrashAlt`), e `AdicionarArquivoModal.js` (`faXmark`).
  - *Sugestões Universais:* `faXmark` ➔ `faTimes` / `faTrashAlt` ➔ `faTrash` / `faPenToSquare` ➔ `faEdit`.

---

## 3. Gestão de Datas (TimeZone Traps)
Foram listadas +50 utilizações do `new Date(valor)` no sistema. A grande maioria processa ISO Strings corretamente. No entanto, há um alerta de potencial falha no **Módulo de Relatórios e BIM**:
- *Arquivos Críticos:* `components/SimuladorFinanceiroPublico.js`, `components/simuladores/SimuladorBraunas.js`, e `components/rh/LancarValeModal.js`.
- *O Problema:* Se `plano.data_primeira_parcela_obra` for um campo nativo tipo `DATE` do Supabase formatado como `YYYY-MM-DD`, inicializá-lo com `new Date('2026-03-10')` puxará para o dia 09 devido ao fuso de Brasília (-3).
- *Sugestão de Correção:* Manexar datas que vem exclusivas no formato YYYY-MM-DD sempre tratando-as como strings inteiras, fracionando o Split pelo `'-'` com a data local para não ocorrer o desvio.

---
**Conclusão da Auditoria:**
O sistema está em estado maravilhoso em nível de Componentes base e Lógica de Banco. As reestruturações mais urgentes para deixar o lançamento impecável são estéticas (limpeza de degradês em Painéis de Relatórios) e consistência da tipografia dos botões (o sistema "perdeu" a homogeneidade do `faEdit` e `faTrash`).
