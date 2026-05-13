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
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/financeiro**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/recursos-humanos**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/empresas**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/empreendimentos**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/contratos**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/relatorios**
- Tabelas: *Não detectado diretamente ou usa RPCs*

### Comercial
**/caixa-de-entrada**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/crm**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/comercial**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/contatos**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/simulador-financiamento**
- Tabelas: *Não detectado diretamente ou usa RPCs*

### Obra
**/orcamento**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/pedidos**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/almoxarifado**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/rdo**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/atividades**
- Tabelas: *Não detectado diretamente ou usa RPCs*

### Coordenação BIM
**/bim-manager**
- Tabelas: *Não detectado diretamente ou usa RPCs*

### Configurações
**/configuracoes**
- Tabelas: *Não detectado diretamente ou usa RPCs*

**/admin**
- Tabelas: *Não detectado diretamente ou usa RPCs*

