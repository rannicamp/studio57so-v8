const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Analisando volumes de dados do Prompt da Stella ---');

  // 1. Histórico de Mensagens
  const resMsg = await client.query(`
    SELECT content, direction, sent_at
    FROM whatsapp_messages
    WHERE contato_id = 5598 AND organizacao_id = 2
    ORDER BY sent_at DESC
    LIMIT 100;
  `);
  const reversed = resMsg.rows.reverse();
  const chatLog = reversed.filter(m => m.content).map(m => {
    const actor = m.direction === 'inbound' ? 'Cliente' : 'Corretor';
    return `[${new Date(m.sent_at).toLocaleString('pt-BR')}] ${actor}: ${m.content}`;
  }).join('\n');

  console.log(`- Histórico de Mensagens (100 msgs): ${chatLog.length} caracteres`);

  // 2. Dossiês de Empreendimentos
  const resEmp = await client.query(`
    SELECT nome, dossie_ia
    FROM empreendimentos
    WHERE dossie_ia IS NOT NULL;
  `);
  let empContext = resEmp.rows.map(e => {
    return `\n--- INÍCIO DO DOSSIÊ: ${e.nome} ---\n${e.dossie_ia}\n--- FIM DO DOSSIÊ: ${e.nome} ---\n`;
  }).join('\n');
  console.log(`- Dossiês de Empreendimentos: ${empContext.length} caracteres`);

  // 3. Produtos Disponíveis
  const resProd = await client.query(`
    SELECT id, unidade, area_m2, valor_venda_calculado, status, descricao, empreendimento_id
    FROM produtos_empreendimento
    WHERE status = 'Disponível' AND organizacao_id = 2;
  `);
  let prodContext = resProd.rows.map(p => 
    `- Empreendimento ID: ${p.empreendimento_id} | Unidade: ${p.unidade} | Área: ${p.area_m2}m² | Valor de Venda: R$ ${p.valor_venda_calculado} | Descrição: ${p.descricao || 'Sem descrição'}`
  ).join('\n');
  console.log(`- Produtos Disponíveis em Estoque: ${prodContext.length} caracteres (Quantidade: ${resProd.rows.length} itens)`);

  // 4. Anexos
  const resAnexos = await client.query(`
    SELECT id, nome_arquivo, caminho_arquivo, descricao
    FROM empreendimento_anexos
    WHERE disponivel_corretor = true AND organizacao_id = 2;
  `);
  let anexosContext = resAnexos.rows.map(a => 
    `- ID: ${a.id} | Nome: "${a.nome_arquivo}" | Caminho: "${a.caminho_arquivo}" | Descrição: "${a.descricao || 'Sem descrição'}"`
  ).join('\n');
  console.log(`- Anexos Disponíveis: ${anexosContext.length} caracteres`);

  console.log(`\n--- TAMANHO TOTAL ESTIMADO DO PROMPT: ${chatLog.length + empContext.length + prodContext.length + anexosContext.length} caracteres`);

  await client.end();
}

main();
