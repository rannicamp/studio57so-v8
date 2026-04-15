# 👥 Manual do Módulo de Recursos Humanos (RH)

Este manual descreve a arquitetura, o funcionamento e o modelo de dados do Módulo de Recursos Humanos do sistema Elo 57 (`app/(main)/recursos-humanos`).

## 1. Arquitetura Básica da Interface

O Módulo de RH é projetado com o padrão **Master-Detail (Mestre-Detalhe)**, consolidado em um ambiente de página única (SPA), focado na alta produtividade visual.

- **Mestre (Lista Lateral):** Gerenciado nativamente por `RHManager.js`. Apresenta uma árvore retrátil ("sanfona") dividida em três grupos:
  - **Funcionários Ativos** (Status diferente de "Demitido")
  - **Banco de Talentos** (Candidatos advindos de funis do CRM - tabela `contatos`)
  - **Demitidos** (Funcionários cujo campo status é 'Demitido')
- **Detalhe (Ficha Completa Central):** Gerenciado por `ColaboradorDetailPanel.js` e renderizado detalhadamente no componente `FichaCompletaFuncionario.js`. Exibe todo o ciclo de vida do funcionário, abrangendo desde cadastros básicos até documentos locais (`documentos_funcionarios`), histórico salarial (`historico_salarial`), folhas de pontos (`pontos`) e justificativas (`abonos`).

## 2. Fluxo de Criação de um Novo Funcionário

A criação de um novo funcionário é uma operação complexa e multi-tabelas acionada através do componente **`FuncionarioModal.js`**. 

Abaixo detalha-se exatamente qual a roteirização do cadastro:

### A. Preparação de Dados e UI
- **Cache Rascunho:** O estado do formulário é salvo dinamicamente no `localStorage` sob a chave `RH_FUNC_MODAL_DRAFT`, permitindo restaurar edições não salvas (anti-frustração).
- **Relacionamentos (Dropdowns):** O modal consome a consulta (via `useQuery`) `funcionarioAuxData` preenchendo caixas de seleção de tabelas auxiliares de matriz obrigatória:
  - `cadastro_empresa` (Qual CNPJ da Organização vai assinar a CTPS).
  - `cargos` (Vindo das configurações estruturais de RH).
  - `jornadas` (Carga horária e regras de ponto).
  - `empreendimentos` (Alocação física/atual da obra).

### B. Inserção Lógica (Motor de Banco de Dados)
A ação de submissão do formulário (`processSubmit`) realiza operações na seguinte ordem e tabelas:

1. **Upload de Foto (Storage):**
   A foto (`foto_url`) já sobe de forma independente e reativa pelo componente `UppyAvatarUploader` para o bucket Supabase `funcionarios-documentos`. O retorno do caminho é colocado no payload.

2. **Saneamento e Sincronização de Contatos (`contatos`):**
   Todo funcionário do Elo 57 DEVE possuir um espelho universal na tabela principal do CRM (`contatos`). O sistema não permite dissociar um colaborador da sua "Pessoa Física".
   - **Busca:** O sistema primeiro verifica o CPF inserido.
   - **Se o CPF existe:** Captura e herda o `contato_id` desse registro existente no sistema.
   - **Se o CPF NÃO existe:** Cria um NOVO registro em `contatos` com `tipo_contato = 'Fornecedor'` e `personalidade_juridica = 'Pessoa Física'`, capturando o novo `contato_id`.

3. **Criação do Funcionário Central (`funcionarios`):**
   Realiza o **INSERT** nativo do RH atrelando o `contato_id`. Preeche todos os dados como: Logradouro, Empresa emissora (CNPJ Empregador), Cargo, Nascimento, e Status inicial (geralmente "Ativo").

4. **Registro de Alteração Financeira Inicial (`historico_salarial`):**
   O modelo impede que o salário exista "solto". Se o cadastro inicial foi preenchido com `salario_base` ou `valor_diaria`, o código executa automaticamente um novo **INSERT na tabela `historico_salarial`**, atrelado ao `funcionario_id` recém criado, contendo sua quantia inaugural. Isso permite reajustes numéricos com histórico retroativo inquebrável.

## 3. Fluxo de Readmissão

O sistema detém uma trava `ConfirmReadmissionModal`. Durante o cadastro, se o CPF digitado encontrar na tabela um indivíduo de *status* `"Demitido"`, as funções de bloqueio param a replicação do funcionário e perguntam ao usuário se ele deseja executar uma "Readmissão", reativando o registro histórico.

## 4. Banco de Dados: Tabelas do Ecosistema de RH

O desenvolvimento, expansão e análise do Módulo de Recursos Humanos abrange as seguintes tabelas principais do Supabase:

- **`funcionarios`**: Coração do módulo. Armazena as propriedades exclusivas de alocação empregatícia (Cargo, Empresa que contrata, Status do ciclo demissional, etc.).
- **`contatos`**: Coração generalista da pessoa humana. Mantém CPF, Nome e vínculo unificado.
- **`cargos`**: Domínio sistêmico padronizado em configurações.
- **`jornadas`**: Domínios de ponto (limites de hora extra, tolerância).
- **`historico_salarial`**: Linha do tempo dos rendimentos pactuados nas Carteiras de Trabalho para alimentar os módulos fiscais do RH.
- **`pontos`**: Registros unificados de batidas do dia (hora a hora) alimentados principalmente de forma automática e em lotes via `PontoImporter.js`.
- **`abonos`**: Justificativas para atrasos ou atestados associados às batidas de ponta de ponto.
- **`documentos_funcionarios`**: Armazenamento relacional e rastreabilidade de PDFs, Atestados e Históricos Clínicos daquela pessoa, ligados estruturalmente via Uploader padrão do projeto.

## 5. Regras de Ouro Extensivas

- NUNCA use "null" cru na leitura de fotos do Painel de RH, sempre garanta a injeção via URL Pública do Storage (já tratado na leitura do `RHManager`).
- Nunca atualize diretamente um valor de campo financeiro (dinheiro cru da base diária ou base mês) na tabela principal de "funcionários". As edições ou reajustes salariais **obrigatoriamente** transitam pelo modal e inserções no modelo da tabela `historico_salarial`. O painel financeiro fará a leitura decrescente do `limit(1)` deste histórico.

## 6. Motor de Fechamento: Planilha Master Mensal

A geração de fechamento de horas do RH (`/relatorios/rh`) baseia-se num motor de simulação analítica unificado (conhecido como **Planilha Master de RH**).

O motor de cálculo na Planilha Master usa as seguintes regras vitais codificadas em Frontend:

### 6.1. Trava D-Zero (Trava do Presente)
Para evitar que registros abertos correntes causem banco de horas negativo dezenas de horas antecipadamente, foi implementada as travas de `lastDayToCountExpected`. Isso garante que as "faltas exigidas" de hoje só sejam descontadas quando o dia termina ou se ele faltou completamente ontem.

### 6.2. Regra Dourada de Abonos: "Abono Zera o Problema"
As regras do passivo trabalhista determinam: Se um colaborador esquece de bater a saída ou de bater a entrada, o motor zera automaticamente suas horas do dia, jogando o défict completo de carga horária (ex: -8h) como punição temporal.
Entretanto, o algoritmo sempre intercepta o espelho primário antes do desconto. **Se houver um abono registrado (isWorkday + Abono)**:
A matemática injeta à força que as "Horas Trabalhadas no dia" são absolutamente idênticas à carga exigida para isentar a punição, ganhando prioridade suprema em cima de logs corrompidos de relógio.

### 6.3. Algoritmo Pecuniário: Mensalista vs Diarista
A qualificação base de cálculo do fechamento ignora a tipagem textual subjetiva e é engatilhada puramente por fatos numéricos no banco de dados.
- **Se a diária for maior que R$ 0,00 (`diaria > 0`):** O Motor força o Custo como Diarista (`Custo Financeiro Bruto = Dias Trabalhados × Valor Diária`), **mesmo que o salário base exista**.
- **Se não houver diária (`diaria = 0`):** O motor roda a trilha Mensalista abatendo por faltas contínuas na competência: `Custo = SalarioBase - (Faltas * Salario_Mensal / 30)`.
