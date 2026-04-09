require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function updateFeedbacks() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
     const diag103_105 = "O sistema de WhatsApp (MessagePanel.js) utiliza uma flag global 'is_read' na tabela do banco de dados e dispara a mutação de leitura automaticamente no useEffect ao ter a conversa aberta (hasUnread && markReadMutation). Isso faz com que quando QUALQUER usuário abra o chat, as mensagens constem como lidas para toda a empresa.";
     const solucao103_105 = "Migrar a lógica de 'is_read' booleano global para uma estrutura Multi-Trafego baseada no ID do Usuário (campo JSONB `read_receipts` ou tabela relacional). Alterar a API `/api/whatsapp/mark-read` para registrar a leitura como `{userId: true}` na mensagem. Na interface (WhatsAppInbox.js e sidebar), computar o total de não-lidos apenas se não constar o ID autenticado no JSONB.";

     const diag104 = "No arquivo 'PedidoCard.js', a lógica mágica do envelhecimento injetou a classe 'bg-blue-600' para os pedidos retidos há mais de 1 dia na coluna. Como o fundo é escuro intenso e os textos (text-gray-800) não foram ajustados para alto contraste na condicional, o cartão parece quase preto dificultando a leitura.";
     const solucao104 = "Alterar 'bg-blue-600 border-l-4 border-blue-600' para 'bg-blue-50 border-l-4 border-blue-500' e badge para cores mais suaves dentro da function `getAgingStyle()` em PedidoCard.js para o caso de +1 dia, mantendo a coerência High-Key com o restante do painel Padrão Ouro.";

     let r1 = await supabase.from('feedback').update({ diagnostico: diag103_105, plano_solucao: solucao103_105 }).in('id', [103, 105]);
     if(r1.error) throw r1.error;

     let r2 = await supabase.from('feedback').update({ diagnostico: diag104, plano_solucao: solucao104 }).eq('id', 104);
     if(r2.error) throw r2.error;
     
     console.log("Banco atualizado com sucesso via API Rest!");
  } catch(e) {
     console.error("ERRO:", e);
  }
}

updateFeedbacks();
