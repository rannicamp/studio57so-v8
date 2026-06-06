---
description: Avalia e faz a triagem de todos os Feedbacks pendentes, injetando análises e diagnósticos diretamente no banco de dados.
---
Este workflow tem a função de agir como o Diretor de Tecnologia Autônomo da Studio 57, lendo relatórios e organizando a pauta do dia do desenvolvedor.
Ao iniciar o dia com \`/triagem-bugs\`, a IA deve seguir rigorosamente estes passos operacionais.

1. Identificar e Buscar os Chamados Pendentes
- Utilize a conexão ao Supabase via Node.js local (`@supabase/supabase-js`) ou utilizar a CLI do Supabase para dar QUERY na tabela `feedback`.
- O objetivo é extrair todos os tickets onde o `status = 'Novo'` ou `status = 'Em Análise'` e que não possuam preenchido a coluna `diagnostico` (Ou seja, que não sofreram triagem ainda).

2. Iniciar Investigação da Causa Raiz
- Para cada ticket resgatado, leia atentamente a queixa do autor (`descricao` e módulo `pagina`).
- Se o ticket possuir um anexo (print do erro), faça o download da imagem para uma pasta local (ex: `./scripts/tmp_anexos/`). Analise a imagem visualmente para enriquecer e aprimorar o seu diagnóstico. Após a triagem e resolução do ticket em questão, apague o arquivo de imagem baixado para manter o ambiente limpo.
- Utilize exaustivamente as ferramentas `find_by_name` e `grep_search` para rastrear os arquivos `.js` dentro do diretório `components/` ou `app/` que controlam aquele módulo citado.
- Formule técnica e resumidamente:
  A) O **Diagnóstico**: O que está causando a anomalia visual ou quebra operacional no código lido.
  B) O **Plano de Solução**: A diretriz arquitetural ou reescrita específica que resolve a dor.

3. Gravar Inteligência no Banco de Dados
- Assim que tiver concluído os diagnósticos, escreva e execute um script de Node.js chamado `update_triagem.js`.
- ATENÇÃO: PARA NÃO TOMAR ERRO DE SSL AUTO-ASSINADO DO SUPABASE, SEMPRE UTILIZE ESTE TEMPLATE DE CONEXÃO COM A PORTA 6543 PARA INJETAR SEUS DIAGNÓSTICOS:
```javascript
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runAtualizacao(id, diagnostico, solucao) {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = \`db.\${projectId}.supabase.co\`;
  const connStr = \`postgres://postgres:\${password}@\${host}:6543/postgres\`;

  const client = new Client({ connectionString: connStr });
  await client.connect();
  
  await client.query(
      "UPDATE feedback SET diagnostico = $1, plano_solucao = $2 WHERE id = $3", 
      [diagnostico, solucao, id]
  );
  await client.end();
}
```
// turbo

4. Apresentar Relatório Gerencial
- Ao finalizar a atualização do banco, gere um relatório completo usando Artifact. O nome deverá ser `feedbacks_pendentes.md`.
- **Formato Rigoroso em Tabelas:** Você DEVE organizar o relatório dividindo-o por módulos/categorias do sistema (ex: Obras, CRM, Financeiro). Dentro de cada módulo, instancie uma tabela com as seguintes colunas: `ID | Status | Data | Autor | Página | Ticket/Descrição | Comentários / Resolução`.
- **Status Dinâmico e Visual:** Preencha a coluna Status utilizando indicadores: 🟢 **Implementado**, 🟡 **Em Análise** e 🔴 **Novo**.
- **Autoria Autêntica:** Na coluna Autor, não traga o ID bruto. Você tem a OBRIGAÇÃO de invocar scripts auxiliares ou queries no banco cruzando o `usuario_id` com a tabela `usuarios` ou `funcionarios` para extrair e apresentar o nome real de quem abriu o chamado.
- **Histórico de Comentários:** Certifique-se de que a tabela `feedback` possua a coluna `comentarios` (injete o DDL `ALTER TABLE` caso necessário). Comente lá o desfecho estratégico dos tickets ou como foram programaticamente solucionados. Apresente essa info na coluna `Comentários` da tabela visual.
- **REGRA DE OURO CRÍTICA: JAMAIS IMPLEMENTE A SOLUÇÃO AUTOMATICAMENTE SEM AUTORIZAÇÃO PRÉVIA.** A sua função na triagem é estritamente DIAGNÓSTICO e PLANEJAMENTO. Você é expressamente proibido de editar ou modificar os arquivos estruturais (`.js`/`.css`) do projeto durante o `/triagem-bugs`. O plano de solução vai apenas p/ o banco e relatório.
- Finalmente, pergunte ao Ranniere qual daqueles planos de solução o sistema deve executar neste instante. Após a confirmação dele, aí sim você estará autorizado a alterar o código.
