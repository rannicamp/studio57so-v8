# 📓 HISTÓRICO DE TELAS E MANUAL DE FUNCIONALIDADES - ELO 57

Este documento funciona como a base de conhecimento viva e guia de integridade do ERP **Elo 57** (Studio 57). O objetivo deste manual é registrar a arquitetura, regras de negócio e funcionalidades ativas de cada página que sofreu atualizações, garantindo que novas melhorias **nunca desfaçam ou quebrem comportamentos anteriores (evitando regressões de código)**.

---

## 🚀 REGRA DE OURO PARA O DESENVOLVEDOR (IA ou Humano)
> [!IMPORTANT]
> **Antes de modificar qualquer página ou componente:**
> 1. Consulte a seção correspondente deste arquivo para entender quais regras de negócio e funcionalidades ativas devem ser preservadas.
> 2. Após concluir e testar uma alteração com sucesso em desenvolvimento local, **você deve atualizar este arquivo** registrando a data, a mudança realizada, o porquê da mudança e as novas regras inseridas.

---

## 📂 Mapeamento de Telas e Histórico de Modificações

### 1. Galeria de Fotos e Gerenciador de RDOs
* **Caminho da Rota**: `/rdo/gerenciador`
* **Arquivos Principais**: 
  * [page.js](file:///c:/Projetos/studio57so-v8/app/(main)/rdo/gerenciador/page.js)
  * [RdoPhotoGallery.js](file:///c:/Projetos/studio57so-v8/components/rdo/RdoPhotoGallery.js)

#### 📋 Funcionalidades Ativas a Preservar:
* **Aba Lista de RDOs**:
  * Tabela com busca integrada por empreendimento, número ou responsável do RDO.
  * Links diretos para visualização e download de PDFs de RDOs assinados e botão de edição.
* **Aba Galeria de Fotos (Infinite Scroll, Agrupamento e Linha do Tempo)**:
  * **Agrupamento por Datas**: Fotos organizadas visualmente por pílula/seção da data do RDO (`DD/MM/YYYY`) em fundo branco minimalista com linha divisora cinza clara e contador de imagens.
  * **Infinite Scroll (Rolagem Infinita de Metadados)**: Busca as fotos sob demanda no banco Supabase em lotes de 50 registros por vez via `.range(from, to)`. Um elemento sentinela no rodapé (`IntersectionObserver`) detecta a rolagem da página a 300px do fim e puxa automaticamente as próximas 50 fotos. Isso impede o estouro de limite de registros do Supabase/PostgREST e garante excelente performance no navegador.
  * **Linha do Tempo Lateral (Time Jump)**: Barra lateral direita discreta com a lista ordenada dos meses/anos que contêm fotos no banco (ex: `Out/25`, `Set/25`, `Jul/25`...). 
    * Ao clicar em um mês, o sistema realiza o **Salto Temporal**: limpa a memória local das fotos, redefine a data limite superior da busca para o último dia do mês clicado e executa a query do Supabase usando `diarios_obra!inner` com filtro `.lte('diarios_obra.data_relatorio', ...)`. A partir desse ponto, o scroll infinito continua carregando as fotos anteriores ao mês selecionado.
    * A opção **"Recentes"** no topo da régua de tempo restabelece a busca a partir das fotos de hoje.
  * **Lazy Loading de Imagens Físicas**: As fotos reais só fazem download e geram a URL assinada quando entram no campo de visão do usuário na tela (evita sobrecarga de tráfego de dados).
  * **Remoção de Badge de KB**: A exibição dos tamanhos de arquivo (KB/MB) no canto superior direito das thumbnails foi removida a pedido do usuário (visual limpo e focado no progresso).
  * **Lightbox Integrado**: Clique na imagem abre modal completo com navegação por teclado (Seta Esquerda/Direita) e link direto para o RDO correspondente da foto.

#### ⏱️ Histórico de Atualizações:
* **23/07/2026 (Linha do Tempo Estilo Google Fotos)**: Desenvolvemos a régua de meses lateral direita integrada com consulta agrupada e a função de Salto Temporal (`handleTimeJump`) que reconstrói a query no Supabase de forma otimizada usando `!inner` join.
* **23/07/2026 (Paginação e Scroll Infinito)**: O banco atingiu limites de requisição padrão que bloqueavam o carregamento de fotos antigas (anteriores a 16/04). Implementamos a busca paginada no Supabase e acoplamos o carregamento automático por rolagem infinita invisível via `IntersectionObserver`.
* **22/07/2026 (Visual Minimalista)**: Retirados os fundos azuis e badges de tamanho em KB da galeria de fotos do RDO, adotando fundo branco e textos pretos discretos integrados à linha divisora.
* **22/07/2026 (Seções de Data)**: Criado o agrupamento de fotos por dia no gerenciador de RDOs.

---

### 2. Formulário e Relatório de RDO
* **Caminho da Rota**: `/rdo/[id]` e `/rdo`
* **Arquivos Principais**:
  * [RdoForm.js](file:///c:/Projetos/studio57so-v8/components/rdo/RdoForm.js)
  * [RdoPrintView.js](file:///c:/Projetos/studio57so-v8/components/rdo/RdoPrintView.js)

#### 📋 Funcionalidades Ativas a Preservar:
* **Congelamento e Imutabilidade (Snapshot)**:
  * RDO do dia ativo (hoje) é dinâmico e lê tabelas vivas.
  * Ao virar a data (meia-noite), o RDO é congelado: as atividades, funcionários e fotos atuais são compiladas num JSON estático e salvas no campo `snapshot_dados` do registro de RDO.
  * RDOs históricos (passados) carregam **exclusivamente do snapshot** e ficam com o formulário 100% travado para edição (`isRdoLocked = true`).
* **Árvore WBS no RDO**:
  * As atividades no RDO e na folha impressa (PDF) utilizam recuo estruturado `depth` e o caractere `↳` para manter o layout de árvore exatamente igual ao do módulo de Atividades.
  * O nome da atividade possui quebra de linha (`break-words`) e o status vai para baixo em telas pequenas para responsividade de smartphones.
* **Ordenação por Prioridade de Status**:
  * As atividades no RDO e no PDF gerado são ordenadas estritamente por grupo de status na ordem: **1. Em Andamento**, **2. Não Iniciado**, **3. Pausado**, **4. Aguardando Material**, **5. Concluído**, **6. Cancelado**.
* **Ocorrências Separadas**:
  * Campos de observação por atividade foram removidos para evitar poluição visual. Anotações gerais são feitas unicamente na seção "Ocorrências do Dia".

#### ⏱️ Histórico de Atualizações:
* **22/07/2026 (Redesenho e Ordenação)**: Removidas observações individuais das atividades e implementada a ordenação estrita por grupos de status + árvore WBS responsiva no RDO e PDF impresso.
* **22/07/2026 (Snapshots Automáticos)**: Desenvolvido o motor de salvamento estático `snapshot_dados` para os RDOs na virada do dia, congelando a leitura de tabelas vivas de datas anteriores.

---

### 3. Painel de Atividades e Filtros de Busca
* **Caminho da Rota**: `/atividades`
* **Arquivos Principais**:
  * [page.js](file:///c:/Projetos/studio57so-v8/app/(main)/atividades/page.js)
  * [ActivityList.js](file:///c:/Projetos/studio57so-v8/components/atividades/ActivityList.js)
  * [AtividadeFiltros.js](file:///c:/Projetos/studio57so-v8/components/atividades/AtividadeFiltros.js)
  * [GanttChart.js](file:///c:/Projetos/studio57so-v8/components/atividades/GanttChart.js)

#### 📋 Funcionalidades Ativas a Preservar:
* **Desativado por Padrão para RDO**:
  * Toda nova atividade criada vem por padrão com `exibe_rdo: false`. A inclusão no Diário de Obra é decidida de forma manual pela equipe técnica/Micaele.
* **Toggle Switch Pill**:
  * Chave de alternância RDO em formato de interruptor pílula minimalista cinza/verde (sem textos "Sim/Não") em todas as listagens.
* **Filtros Avançados**:
  * Filtro RDO (Sim, Não, Todos) que funciona em paralelo com filtros de empresa e empreendimento.
  * **Filtro de Responsável Estrito**: Ao filtrar por um funcionário, apenas tarefas cujo responsável seja ele são retornadas na lista da árvore. Ancestrais ou tarefas pai sem responsável são omitidos do layout achatado para evitar o "vazamento" de linhas e cabeçalhos de outros responsáveis.
  * **Opção Sem Responsável**: Seleciona expressamente apenas as tarefas pendentes de alocação de equipe (`⚠️ Sem Responsável`).
* **Cronograma Gantt (Unificação de Cores e Bypass)**:
  * **Sincronia Dupla**: Na tela `/atividades`, o componente de Gantt recebe os dados filtrados pela barra de filtros superior da página principal e oculta seu seletor de status interno (`hideInternalStatusFilter={true}`).
  * **Gantt no BIM**: No gerenciador BIM (`/bim-manager`), o Gantt exibe o seletor de status próprio com os **6 status oficiais do sistema** (eliminada a opção fictícia "Atrasados", que agora é tratada apenas como um cálculo visual de datas).
  * **Unificação de Cores via Style Inline (Bypass Tailwind)**: Para resolver o problema em que classes dinâmicas do Tailwind (como `bg-blue-500`) não eram compiladas em build de produção ou geravam cores fora da paleta do ERP, as cores foram fixadas em hexadecimal no objeto `getStatusStyles` e injetadas via style inline no JSX (`style={{ backgroundColor: styles.bg }}`). As cores oficiais preservadas são:
    * ⚪ **Não Iniciado**: `#e5e7eb` (Cinza)
    * 🔵 **Em Andamento**: `#2563eb` (Azul)
    * 🟣 **Aguardando Material**: `#8b5cf6` (Roxo)
    * 🟡 **Pausado**: `#eab308` (Amarelo)
    * 🟢 **Concluído**: `#22c55e` (Verde)
    * 🔴 **Cancelado**: `#ef4444` (Vermelho)

#### ⏱️ Histórico de Atualizações:
* **22/07/2026 (Unificação de Cores & Gantt)**: Resolvido o "problema da cor" no Gantt/Atividades. As cores dinâmicas foram substituídas por estilos inline estritos (Bypass Tailwind) e alinhadas aos 6 status legítimos do banco, corrigindo a visualização e datas no Gantt.
* **22/07/2026 (Gantt Integrado)**: Sincronizado o Gantt de atividades com a barra superior de filtros e limpeza de status fictícios no painel BIM.
* **22/07/2026 (Filtro Estrito)**: Reformulado o fluxo de exibição da lista de atividades para obedecer estritamente ao responsável selecionado e inclusão do filtro de tarefas sem responsável.
* **22/07/2026 (Switch Pill RDO)**: Adicionado o toggle slider minimalista de RDO e os filtros de inclusão de RDO no painel de Atividades.

---

### 4. Painel de Automações & Roteamento
* **Caminho da Rota**: `/crm/automacao` e modal do Kanban comercial `/crm`
* **Arquivos Principais**:
  * [page.js](file:///c:/Projetos/studio57so-v8/app/(main)/crm/automacao/page.js)
  * [AutomacoesListModal.js](file:///c:/Projetos/studio57so-v8/components/crm/AutomacoesListModal.js)

#### 📋 Funcionalidades Ativas a Preservar:
* **Construtor Dinâmico de Condições**:
  * O formulário aceita adicionar N condições sob a lógica do operador lógico "E" (AND). O usuário pode escolher os campos: **Campanha Meta**, **Anúncio Meta**, **Origem do Lead** ou **Código do País (DDI)** e seus respectivos valores.
* **Otimização de Performance e Sincronia**:
  * Dropdowns de Campanha e Anúncio leem diretamente das tabelas integradas `meta_campaigns` e `meta_ads` em vez de varrer a tabela de `contatos` por completo, acelerando o tempo de resposta e permitindo configurar roteamento preventivo para novas campanhas.
  * O campo de Origem faz uma leitura rápida `limit(1000)` para obter os registros existentes.
* **Validação SQL Avançada (`fn_rotear_lead`)**:
  * A RPC do banco `fn_rotear_lead` (com assinatura `uuid`) foi totalmente reestruturada para validar o campo `origem` e o `country_code` (resolvido por subquery na tabela `telefones`). A prioridade de execução calcula a especificidade somando pesos (`Anúncio=16, Campanha=8, Origem=4, DDI=2, Página=1`).
  * O seletor de coluna destino possui um fallback inteligente que busca por tipo `'entrada'`, nome `'ENTRADA'`, ou a primeira coluna por ordem cronológica caso nenhuma esteja configurada.
* **Edição de Regras**:
  * O botão de lápis permite carregar as regras configuradas de volta no construtor de condições dinâmicas para edição simples via `.update()`.
* **Controle de Prioridades**:
  * Setas de prioridade (Up/Down) permitem reorganizar as regras de roteamento no painel. O clique faz um upsert ordenado atualizando a coluna `ordem` sequencialmente de todas as regras da organização.
* **Unificação de Telas**:
  * Tanto a página standalone quanto o modal comercial possuem o mesmo painel de abas com gerenciador global da Stella IA, mensagens automáticas de WhatsApp e roteamento de leads.

#### ⏱️ Histórico de Atualizações:
* **23/07/2026 (Construtor Dinâmico & Performance)**: Desenvolvido o novo fluxo de condições flexíveis para o roteamento de leads, incluindo DDI e origem no banco de dados e otimização das listagens de Meta Ads.

---

### 5. Design System & Styleguide
* **Caminho da Rota**: `/design-system`
* **Arquivos Principais**:
  * [page.js](file:///c:/Projetos/studio57so-v8/app/(main)/design-system/page.js)

#### 📋 Funcionalidades Ativas a Preservar:
* **Layout de Documentação em Duas Colunas**:
  * O visual é limpo e explora toda a largura horizontal da tela (`w-full px-6 py-6`), evitando o estreitamento da interface.
  * O cabeçalho é simples, contendo apenas o título da página e sua descrição em negrito sóbrio, sem caixas pretas de logo (`57` ad-hoc) ou fontes estilizadas fora do padrão.
* **Sidebar Lateral de Navegação (Design Oficial)**:
  * O menu esquerdo replica a identidade e as classes exatas da Sidebar do ERP: títulos de seção em `text-xs font-bold text-gray-400 uppercase tracking-wider mb-3` e itens em `text-sm font-medium`.
  * O item ativo recebe a **borda vertical esquerda preta** de 4px (`border-l-4 border-black bg-gray-100 text-black font-semibold`). O Laranja Elo ficou restrito estritamente a elementos e automações baseadas em IA (Stella IA).
  * Integração com **Scroll Spy** (ilumina dinamicamente o item ativo na rolagem) e **Smooth Scroll** ao clicar nos links de ancoragem.
* **Preservação Absoluta de Metadados nos Cards do Kanban (CRM e Compras)**:
  * **Card de Pedido de Compra (Seção 03):** Deve manter a faixa vermelha de atraso à esquerda, badge de atraso (`⚠️ +3 dias`), botão de copiar ID (`faClone`), metadados do solicitante, obra, data solicitada, pílula de status financeiro (`📂 Pendente Fin.`), valor monetário destacado em verde (`$ R$ 0,00`), status da coluna e menu de 3 pontos verticais.
  * **Card do CRM (Seção 03):** Deve manter a faixa preta à esquerda, cabeçalho com ID/Nome, badge de tarefas no topo (`📋 1 TAREFAS (CONCLUÍDAS)`), telefone com ícone, seção de unidades de interesse com o texto e botão interativo (`+ Adicionar Unidade`), seção de corretor responsável com as ações rápidas (`Adicionar` ou `✕ Trocar`), badge de origem da campanha (`🌐 Landing Page - Elo 57`), data e hora completa de criação no rodapé e botão de WhatsApp verde.
* **Cores da Marca e Manual Supremo**:
  * O **Laranja Elo (`#FF6700`)** é a cor de sotaque oficial reservada exclusivamente para Inteligência Artificial (Stella IA). O layout e navegação padrão usam Preto Absoluto (`#000000`) e Branco Puro (`#FFFFFF`).
  * A tipografia oficial é a **Roboto** (slogans, textos) e a **Montserrat** (UI, botões, cabeçalhos e navegação).
* **Biblioteca de Ícones Padrão (Dicionário único)**:
  * Catalogados todos os ícones válidos do ERP por finalidade: CRUD (`faEdit`, `faTrash`, `faPlus`, `faSave`, `faTimes`, `faCopy`), Navegação (`faSearch`, `faFilter`, `faEye`, `faChevronDown`, `faChevronUp`), e Mensagens (`faWhatsapp`, `faPhone`, `faCheckCircle`, `faExclamationTriangle`, `faInfoCircle`, `faSpinner`).
  * Estão explicitamente descritos os ícones proibidos no sistema (`faPen`, `faPenToSquare`, `faTrashAlt`, `faXmark`), garantindo a consistência das ações CRUD.
  * Snippets de código do Next.js integrados para cópia rápida com 1 clique.

#### ⏱️ Histórico de Atualizações:
* **23/07/2026 (Restabelecimento do Laranja Elo e Biblioteca de Ícones)**: Reintroduzido o Laranja Elo (`#FF6700`) como cor de sotaque oficial e adicionada a seção 06 com a biblioteca/dicionário completo de ícones CRUD, navegação e status, além de ajustar o layout de Sidebar do ERP e a largura total da página.
* **23/07/2026 (Restauração Completa dos Cards Reais)**: Reconstruídos os layouts dos cards de Kanban para CRM e Compras, mapeando e restabelecendo 100% dos campos, botões de ação e dados de produção a partir dos prints reais do ERP (SLA, tarefas, WhatsApp, corretores e unidades).

### 6. Gestão de Empresas & SPEs
* **Caminho da Rota**: `/empresas`
* **Arquivos Principais**:
  * [page.js](file:///c:/Projetos/studio57so-v8/app/(main)/empresas/page.js)
  * [EmpresaManager.js](file:///c:/Projetos/studio57so-v8/components/empresas/EmpresaManager.js)
  * [EmpresaDetails.js](file:///c:/Projetos/studio57so-v8/components/empresas/EmpresaDetails.js)
  * [EmpresaFormModal.js](file:///c:/Projetos/studio57so-v8/components/empresas/EmpresaFormModal.js)

#### 📋 Funcionalidades Ativas a Preservar:
* **Lista Master-Detail Sóbria**:
  * A listagem master à esquerda usa cantos `rounded-lg` (8px). O item selecionado destaca-se sem cores extravagantes, adotando cinza-claro (`bg-gray-100 border-gray-200 text-black font-semibold`). O avatar sem imagem da empresa adota fundo preto absoluto `#000000` se selecionado.
  * O input de pesquisa da lista master adota cantos `rounded-lg` e anel de foco em preto sóbrio (`focus:ring-black focus:border-black`).
* **KPIs de Auditoria de Documentos**:
  * Os cartões de KPIs em `EmpresaDetails.js` usam o design padrão ouro unificado: contornos finos em cinza (`border-gray-200 rounded-lg shadow-sm`), ícone em caixa azul claro (`bg-blue-50 text-black`), e o valor em destaque preto `text-xl font-black text-gray-900`.
* **Abas de Divisão Corporativa**:
  * O botão de aba (`TabButton`) adota borda inferior e texto pretos se ativo (`border-black text-black font-semibold`).
  * O corpo da ficha cadastral envolve as seções em caixas brancas minimalistas com borda lateral esquerda de destaque preta (`border-l-4 border-black`) e títulos discretos em Montserrat uppercase.
  * Os rótulos de dados (`InfoField`) utilizam legendas menores `text-[10px] font-black text-gray-400 uppercase tracking-wider` e os valores em `text-sm font-semibold text-gray-800`.
* **Modais e Botões CRUD Unificados**:
  * O cabeçalho do `EmpresaFormModal` adota o padrão de cor sólida preta (`bg-black text-white px-5 py-4`) com título reduzido em negrito e botão de fechar branco minimalista (`text-white/70 hover:text-white`).
  * Todos os botões de ação e confirmação adotam Preto Sóbrio (`bg-black hover:bg-gray-900 text-white font-bold rounded-lg shadow-sm`) e cantos `rounded-lg`. O ícone de editar foi corrigido de `faPen` para `faEdit` (padrão ouro).
  * Todos os inputs do modal usam cantos `rounded-lg` (8px) e foco preto sóbrio, com legendas uppercase.

#### ⏱️ Histórico de Atualizações:
* **23/07/2026 (Refatoração de Design Unificado - Padrão Ouro)**: Remodelada toda a experiência visual da rota `/empresas` (Lista Master, Ficha de Detalhes, KPIs de Anexos, Guias e Modais de Cadastro) para erradicar border-radius inconsistentes (`rounded-xl` em inputs/botões), substituir ícones CRUD proibidos (`faPen` -> `faEdit`), remover destaques azuis estilo bootstrap e alinhar o layout ao manual do Design System.

---

### 7. Hub de Criativos e Publicações de Mídias
* **Caminho da Rota**: `/elo57/publicacoes`
* **Arquivos Principais**:
  * [page.js](file:///c:/Projetos/studio57so-v8/app/(landingpages)/elo57/publicacoes/page.js)

#### 📋 Funcionalidades Ativas a Preservar:
* **Sidebar de Campanhas**:
  * Seleção dinâmica de campanhas: `Elo 57 (ERP)`, `Beta Suítes (Lançamento de Luxo)` e `Residencial Alfa (Acompanhamento de Obra)` com ícones e status ativos.
* **Seletor de Formatos e Aspect Ratio**:
  * Alternador de proporção no preview e exportação: **Feed Quadrado (1:1 - 1080x1080px)** e **Stories Vertical (9:16 - 1080x1920px)**.
* **Escala Vetorial Automática (`scale()`)**:
  * Ajuste de visualização em tempo real que escala o canvas do criativo proporcionalmente com base na largura da janela e no formato selecionado, mantendo a proporção 1:1 ou 9:16 intacta em qualquer tamanho de monitor.
* **Layouts Híbridos (Mídias e Negócio)**:
  * **Layout de Produto (Elo 57):** Renderiza mockups reais de desktop (Financeiro e BIM 5D) e celular (RDO) emoldurados.
  * **Layout Imobiliário (Beta/Alfa):** Aplica design split editorial luxo (imagem 60% topo, ficha de texto branca 40% base) com tipografia Montserrat e Roboto elegante.
* **Exportação em Lote**:
  * Botão de "Exportar Todos os Slides" que percorre de forma assíncrona todas as páginas da campanha, aguarda o renderizador React pintar o DOM e gera múltiplos downloads de PNG em alta resolução limpos de botões.

#### ⏱️ Histórico de Atualizações:
* **24/07/2026 (Hub de Publicações & Stories 9:16)**: Expandida a página para acomodar o Hub de Criativos contendo sidebar, campanhas adicionais (Beta Suítes e Residencial Alfa) com layouts imobiliários dedicados e suporte total ao formato de Stories (1080x1920).
* **24/07/2026 (Carrossel Interativo e Exportação)**: Desenvolvida a navegação lateral com bolinhas do Instagram e motor html2canvas com clonagem de DOM.


