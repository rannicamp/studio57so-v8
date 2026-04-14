---
description: Como a IA deve criar novos templates globais de notificação no banco de dados da Elo57 sem depender do painel administrativo.
---

# Fluxo de Criação de Novas Notificações Globais

Quando o usuário pedir para "criar uma notificação para quando acontecer X", você DEVE seguir este fluxo inserindo dados diretamente no PostgreSQL em vez de usar UI:

O sistema Studio 57 utiliza o poderoso motor PL/pgSQL dinâmico. Todas as notificações do sistema (para serem distribuídas às franquias) começam com a criação de um "Template Global" (`organizacao_id = 1`).

## 1. Mapeamento de Tabela Base e Evento
A trigger global `processar_regras_notificacao` roda em tabelas com triggers já vinculadas. Certifique-se de que a tabela-alvo possui um trigger configurado, ou gere o script:
```sql
CREATE TRIGGER tgr_notification_my_table
AFTER INSERT OR UPDATE ON public.my_table
FOR EACH ROW EXECUTE FUNCTION public.processar_regras_notificacao();
```

## 2. Injeção Direta na Tabela `sys_notification_templates`
Escreva um script Node.js com o Supabase Client ou rode o seguinte SQL direto na Vercel (ou equivalente) para popular o banco de dados. Você deve respeitar as colunas:

- `organizacao_id`: **SEMPRE `1`** (Representa o Template Matriz que as Franquias irão clonar as configurações localmente).
- `tabela_alvo`: Nome real da tabela no PostgreSQL (ex: `atividades`, `clientes`, `produtos_empreendimento`).
- `evento`: `'INSERT'`, `'UPDATE'` ou `'DELETE'`.
- `titulo_template`: O Título visual com wildcards. Ex: `"Novo Lead Atribuído!"` ou `"Atenção: A unidade {unidade} sofreu reajuste"`
- `mensagem_template`: Mensagem corpórea. Use wildcards idênticos às colunas da tabela. Ex: `"{nome_cliente} acabou de entrar no funil de vendas."`
- `link_template`: Opcionalmente, um link interno com wildcards na URL (Deep Link). Ex: `"/crm/cliente/{id}"`. O PL/pgSQL automaticamente converterá o `id` da linha original pelo wildcard.
- `icone`: Uma string das permitidas (ex: `"bell"`, `"money"`, `"building"`, etc).
- `enviar_para_dono`: Booleano, indica se o autor do fato também recebe o aviso.

## 3. Variáveis e Colunas Customizadas
O motor aceita qualquer JSON Path. Se a tabela possuir referências em `variaveis_virtuais` do banco, os dados serão enriquecidos (Ex: pegar o nome do contato mesmo que na tabela só exista o ID). Caso você precise usar `{id}` ou qualquer array (`{nome}`), eles sempre se transformam automaticamente baseados nos dados convertidos para JS (ou JSON).

### Exemplo Rápido de Inserção:
```javascript
const res = await supabase.from('sys_notification_templates').insert({
  organizacao_id: 1, 
  tabela_alvo: 'atividades',
  evento: 'INSERT',
  link_template: '/crm/atividades?tarefa={id}',
  titulo_template: 'Nova Tarefa Recebida 📌',
  mensagem_template: 'O usuário te atribuiu a tarefa: {nome_tarefa}',
  icone: 'calendar',
  enviar_para_dono: false
});
```

> **IMPORTANTE**: Após a criação global, as franquias verão o template dinamicamente dentro do "Painel de Configurações de Notificação" `/configuracoes/notificacoes` onde poderão Ligar/Desligar e configurar quem irá receber o aviso. Você só precisa cadastrar a matriz!
