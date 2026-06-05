const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');
const fs = require('fs');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  const contato_id = 5598;
  const organizacao_id = 2;

  // 1. Dados cadastrais do contato
  const resContato = await client.query(`
    SELECT nome, cpf, cnpj, origem, objetivo, cargo, estado_civil, renda_familiar, fgts, mais_de_3_anos_clt,
           observations, meta_campaign_name, meta_adset_name, meta_ad_name, meta_form_data, birth_date, cep,
           address_street, address_number, address_complement, neighborhood, city, state, ai_analysis
    FROM contatos
    WHERE id = $1 AND organizacao_id = $2;
  `, [contato_id, organizacao_id]);
  const contatoInfo = resContato.rows[0];

  // 2. Histórico de mensagens
  const resMessages = await client.query(`
    SELECT content, direction, sent_at
    FROM whatsapp_messages
    WHERE contato_id = $1 AND organizacao_id = $2
    ORDER BY sent_at DESC
    LIMIT 25;
  `, [contato_id, organizacao_id]);
  const messages = resMessages.rows;

  // 3. Dados do Funil
  const resFunil = await client.query(`
    SELECT cf.nome as coluna_nome
    FROM contatos_no_funil cnf
    JOIN colunas_funil cf ON cnf.coluna_id = cf.id
    WHERE cnf.contato_id = $1;
  `, [contato_id]);
  const funil = resFunil.rows[0];

  // 4. Produtos do Contato no Funil
  const resContatoProdutos = await client.query(`
    SELECT pe.unidade, pe.empreendimento_id, pe.area_m2, pe.valor_venda_calculado
    FROM contatos_no_funil_produtos cnfp
    JOIN contatos_no_funil cnf ON cnfp.contato_no_funil_id = cnf.id
    JOIN produtos_empreendimento pe ON cnfp.produto_id = pe.id
    WHERE cnf.contato_id = $1;
  `, [contato_id]);
  const contatoProdutos = resContatoProdutos.rows;

  // Montagem do log
  const reversedMessages = [...messages].reverse();
  const chatLog = reversedMessages.filter(m => m.content).map(m => {
    const actor = m.direction === 'inbound' ? 'Cliente' : 'Corretor';
    return `[${new Date(m.sent_at).toLocaleString('pt-BR')}] ${actor}: ${m.content}`;
  }).join('\n');

  const crmStatus = funil?.coluna_nome || "Lead Sem Funil (Caixa de Entrada Vazia)";
  const produtos = contatoProdutos.map(p => p.unidade).join(', ') || "Nenhum Produto Vinculado";

  const empIdsSet = new Set();
  let detalhesUnidades = "";
  contatoProdutos.forEach(p => {
    if (p.empreendimento_id) empIdsSet.add(p.empreendimento_id);
    detalhesUnidades += `- Produto: ${p.unidade} | Área: ${p.area_m2 || 'N/A'}m² | Valor Calculado: R$ ${p.valor_venda_calculado || 'N/A'}\n`;
  });

  const campaignText = (
    (contatoInfo?.meta_campaign_name || '') + ' ' + 
    (contatoInfo?.meta_adset_name || '') + ' ' + 
    (contatoInfo?.meta_ad_name || '')
  ).toLowerCase();

  if (campaignText.includes('alfa')) empIdsSet.add(1);
  if (campaignText.includes('beta') || campaignText.includes('samara')) empIdsSet.add(5);
  if (campaignText.includes('braunas') || campaignText.includes('braúnas')) empIdsSet.add(6);

  const empreendimentoIds = Array.from(empIdsSet);
  const empIdsBusca = empreendimentoIds.length > 0 ? empreendimentoIds : [1, 5, 6];

  // Buscar Dossiês
  const resDossies = await client.query(`
    SELECT id, nome, dossie_ia
    FROM empreendimentos
    WHERE id = ANY($1) AND dossie_ia IS NOT NULL;
  `, [empIdsBusca]);
  
  // Buscar Anexos
  const resAnexos = await client.query(`
    SELECT id, nome_arquivo, caminho_arquivo, descricao, empreendimento_id
    FROM empreendimento_anexos
    WHERE disponivel_corretor = true AND organizacao_id = $1 AND empreendimento_id = ANY($2);
  `, [organizacao_id, empIdsBusca]);

  // Buscar Produtos Disponíveis
  const resProdutosDisp = await client.query(`
    SELECT id, unidade, area_m2, valor_venda_calculado, status, descricao, empreendimento_id
    FROM produtos_empreendimento
    WHERE status = 'Disponível' AND organizacao_id = $1 AND empreendimento_id = ANY($2);
  `, [organizacao_id, empIdsBusca]);

  let empContext = "### BASE DE CONHECIMENTO DO EMPREENDIMENTO (Dossiê)\n" + resDossies.rows.map(e => {
    return `\n--- INÍCIO DO DOSSIÊ: ${e.nome} ---\n${e.dossie_ia}\n--- FIM DO DOSSIÊ: ${e.nome} ---\n`;
  }).join('\n');

  let anexosContext = resAnexos.rows.map(a => `- ID: ${a.id} | Nome: "${a.nome_arquivo}" | Caminho: "${a.caminho_arquivo}" | Descrição: "${a.descricao || 'Sem descrição'}"`).join('\n') || "Nenhum anexo público encontrado.";

  const unidadesHabitacionais = resProdutosDisp.rows.filter(p => {
    const u = (p.unidade || '').toUpperCase();
    return !u.includes('MOTO') && !u.includes('CARRO') && !u.includes('GARAGEM');
  });

  let produtosDisponiveisContext = unidadesHabitacionais.map(p => 
    `- Empreendimento ID: ${p.empreendimento_id} | Unidade: ${p.unidade} | Área: ${p.area_m2}m² | Valor de Venda: R$ ${p.valor_venda_calculado} | Descrição: ${p.descricao || 'Sem descrição'}`
  ).join('\n') || "Nenhuma unidade habitacional disponível.";

  console.log('--- DETECTADO ---');
  console.log('Fase CRM:', crmStatus);
  console.log('Produtos Interessados:', produtos);
  console.log('Empreendimentos Busca:', empIdsBusca);
  console.log('Total Unidades Habitacionais Disponíveis:', unidadesHabitacionais.length);

  // Escrever o prompt compilado num arquivo Markdown no Scratch
  const promptLogPath = 'C:/Users/ranni/.gemini/antigravity/brain/069de86a-a219-42a6-9a4d-7e8e2f8195f2/scratch/prompt_ranniere_debug.md';
  
  const debugContent = `
# Debug do Prompt da Stella para Ranniere

## Informações Básicas
- **Contato**: ${contatoInfo?.nome}
- **Fase CRM**: ${crmStatus}
- **Emp Busca**: ${JSON.stringify(empIdsBusca)}
- **Qtde Produtos Disp**: ${unidadesHabitacionais.length}

## Lista de Produtos Disponíveis no Contexto
\`\`\`
${produtosDisponiveisContext}
\`\`\`

## Chat Log
\`\`\`
${chatLog}
\`\`\`
  `;
  
  fs.writeFileSync(promptLogPath, debugContent, 'utf-8');
  console.log(`Debug salvo em: ${promptLogPath}`);

  await client.end();
}

main();
