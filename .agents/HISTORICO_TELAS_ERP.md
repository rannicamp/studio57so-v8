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
  * **Filtro de Responsável Estrito**: Ao filtrar por um funcionário, apenas tarefas cujo responsável seja ele são retornadas na lista da árvore de árvore. Ancestrais ou tarefas pai sem responsável são omitidos do layout achatado para evitar "vazamento" de linhas que não pertencem ao profissional.
  * **Opção Sem Responsável**: Seleciona expressamente apenas as tarefas pendentes de alocação de equipe (`⚠️ Sem Responsável`).
* **Cronograma Gantt**:
  * **Sincronia Dupla**: Na tela `/atividades`, o componente de Gantt recebe os dados filtrados pela barra de filtros superior da página principal e oculta seu seletor de status interno (`hideInternalStatusFilter={true}`).
  * **Gantt no BIM**: No gerenciador BIM (`/bim-manager`), o Gantt exibe o seletor de status próprio com os **6 status oficiais do sistema** (eliminada a opção fictícia "Atrasados", que agora é tratada apenas como um cálculo visual de datas).

#### ⏱️ Histórico de Atualizações:
* **22/07/2026 (Gantt Integrado)**: Sincronizado o Gantt de atividades com a barra superior de filtros e limpeza de status fictícios no painel BIM.
* **22/07/2026 (Filtro Estrito)**: Reformulado o fluxo de exibição da lista de atividades para obedecer estritamente ao responsável selecionado e inclusão do filtro de tarefas sem responsável.
* **22/07/2026 (Switch Pill RDO)**: Adicionado o toggle slider minimalista de RDO e os filtros de inclusão de RDO no painel de Atividades.
