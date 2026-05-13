# 🗺️ Catálogo de Arquitetura do Sistema

## Parte 1: Árvore do Explorer (Módulos e Subpáginas)

### Administrativo
- /painel
- /financeiro
  - /financeiro/auditoria
  - /financeiro/categorias
  - /financeiro/conciliacao
  - /financeiro/indices
  - /financeiro/transferencias
- /recursos-humanos
    - /recursos-humanos/contratos/[id]
- /empresas
- /empreendimentos
    - /empreendimentos/[id]/produtos
- /contratos
  - /contratos/[id]
- /relatorios
  - /relatorios/empreendimentos
  - /relatorios/financeiro
  - /relatorios/obras
  - /relatorios/radar
  - /relatorios/rh

### Comercial
- /caixa-de-entrada
- /crm
  - /crm/automacao
  - /comercial/tabela-de-vendas
- /contatos
  - /contatos/cadastro
  - /contatos/duplicatas
    - /contatos/editar/[id]
  - /contatos/formatar-telefones
- /simulador-financiamento

### Obra
- /orcamento
- /pedidos
  - /pedidos/[id]
- /almoxarifado
- /rdo
  - /rdo/[id]
  - /rdo/gerenciador
- /atividades

### Coordenação BIM

### Configurações
- /configuracoes
  - /configuracoes/cotacoes
  - /configuracoes/feedback
    - /configuracoes/feedback/visualizar
  - /configuracoes/financeiro
  - /configuracoes/integracoes
  - /configuracoes/materiais
  - /configuracoes/notificacoes
    - /configuracoes/painel/construtor
  - /configuracoes/permissoes
  - /configuracoes/politicas
  - /configuracoes/rh
  - /configuracoes/tipos-documento
  - /configuracoes/tutoriais
  - /configuracoes/usuarios
  - /configuracoes/waba-saas
  - /admin/feedbacks

## Parte 2: Acesso ao Banco de Dados por Rota

### Administrativo
**/painel**
- Tabelas: *Não detectado diretamente*

**/financeiro**
- Tabelas: *Não detectado diretamente*

**/recursos-humanos**
- Tabelas: *Não detectado diretamente*

**/empresas**
- Tabelas: *Não detectado diretamente*

**/empreendimentos**
- Tabelas: *Não detectado diretamente*

**/contratos**
- Tabelas: *Não detectado diretamente*

**/relatorios**
- Tabelas: *Não detectado diretamente*

### Comercial
**/caixa-de-entrada**
- Tabelas: *Não detectado diretamente*

**/crm**
- Tabelas: *Não detectado diretamente*

**/comercial**
- Tabelas: *Não detectado diretamente*

**/contatos**
- Tabelas: *Não detectado diretamente*

**/simulador-financiamento**
- Tabelas: *Não detectado diretamente*

### Obra
**/orcamento**
- Tabelas: *Não detectado diretamente*

**/pedidos**
- Tabelas: *Não detectado diretamente*

**/almoxarifado**
- Tabelas: *Não detectado diretamente*

**/rdo**
- Tabelas: *Não detectado diretamente*

**/atividades**
- Tabelas: *Não detectado diretamente*

### Coordenação BIM
**/bim-manager**
- Tabelas: *Não detectado diretamente*

### Configurações
**/configuracoes**
- Tabelas: *Não detectado diretamente*

**/admin**
- Tabelas: *Não detectado diretamente*

