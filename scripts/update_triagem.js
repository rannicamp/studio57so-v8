require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runTriagem() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo conexão para atualizar Feedbacks...");
     await client.connect();
     
     // 103 e 105 - Bug Caixa de Entrada Global Read
     const diag103_105 = "O sistema de WhatsApp (MessagePanel.js) utiliza uma flag global 'is_read' na tabela do banco de dados e dispara a mutação de leitura automaticamente no useEffect ao ter a conversa aberta. Isso faz com que quando QUALQUER usuário abra o chat, as mensagens constem como lidas para toda a empresa.";
     const solucao103_105 = "Migrar a lógica de 'is_read' booleano global para uma estrutura Multi-Trafego baseada no ID do Usuário (JSONB `read_receipts` ou tabela de relacionamento). Alterar a API `/api/whatsapp/mark-read` para registrar a leitura como '{userId: true}'. Na interface (WhatsAppInbox.js e sidebar), checar apenas os não-lidos referentes ao usuário autenticado.";

     // 104 - Bug PedidoCard dark bg
     const diag104 = "No arquivo 'PedidoCard.js', a lógica mágica do envelhecimento injetou a classe 'bg-blue-600' para os pedidos retidos há mais de 1 dia na coluna. Como o fundo é muito escuro (azul marinho quase preto) e os textos (text-gray-800) não foram configurados para coloração inversa na condicional, o cartão parece uma 'caixa preta' ilegível.";
     const solucao104 = "Alterar 'bg-blue-600' para 'bg-blue-50' e ajustar a borda lateral para 'border-blue-500' na condicional (diffDays >= 1) dentro de PedidoCard.js, mantendo uma cor suave coerente com o restante do sistema (Padrão Ouro).";

     // Atualiza o banco
     await client.query("UPDATE feedback SET diagnostico = $1, plano_solucao = $2 WHERE id IN (103, 105)", [diag103_105, solucao103_105]);
     await client.query("UPDATE feedback SET diagnostico = $1, plano_solucao = $2 WHERE id = 104", [diag104, solucao104]);
     
     console.log("Operação SQL homologada com sucesso! Todos os diagnósticos salvos.");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runTriagem();
