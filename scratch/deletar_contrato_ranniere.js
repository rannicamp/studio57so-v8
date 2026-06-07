const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== REMOVENDO CONTRATO DO RANNIERE E LIMPANDO RASTROS ===");

  const contatoId = 5598; // RANNIERE CAMPOS MENDES
  const organizacaoId = 2; // Studio 57
  const contratoId = 121; // ID do contrato a ser deletado

  try {
    // 1. Obter ID da simulação vinculada ao contrato
    const resContrato = await client.query(`
      SELECT simulacao_id, produto_id FROM public.contratos 
      WHERE id = $1 AND organizacao_id = $2
    `, [contratoId, organizacaoId]);

    if (resContrato.rows.length === 0) {
      console.log(`[AVISO] Contrato ID ${contratoId} já não existe ou foi removido.`);
    } else {
      const { simulacao_id, produto_id } = resContrato.rows[0];

      // 1.1. Obter todos os produtos associados ao contrato via contrato_produtos
      const resProds = await client.query(`SELECT produto_id FROM public.contrato_produtos WHERE contrato_id = $1`, [contratoId]);
      const productIds = resProds.rows.map(r => parseInt(r.produto_id, 10)).filter(id => !isNaN(id));
      if (produto_id && !productIds.includes(parseInt(produto_id, 10))) {
        productIds.push(parseInt(produto_id, 10));
      }

      // 2. Deletar parcelas do contrato
      await client.query(`DELETE FROM public.contrato_parcelas WHERE contrato_id = $1`, [contratoId]);
      console.log("[OK] Parcelas do cronograma financeiro deletadas.");

      // 3. Deletar vínculos de produtos
      await client.query(`DELETE FROM public.contrato_produtos WHERE contrato_id = $1`, [contratoId]);
      console.log("[OK] Vínculos em contrato_produtos deletados.");

      // 4. Deletar o contrato
      await client.query(`DELETE FROM public.contratos WHERE id = $1 AND organizacao_id = $2`, [contratoId, organizacaoId]);
      console.log("[OK] Registro do contrato deletado da tabela contratos.");

      // 5. Deletar a simulação associada se existir
      if (simulacao_id) {
        await client.query(`DELETE FROM public.simulacoes WHERE id = $1`, [simulacao_id]);
        console.log("[OK] Registro de simulação associada deletado.");
      }

      // 6. Restaurar status dos produtos (lote/garagem) para 'Disponível'
      if (productIds.length > 0) {
        await client.query(`
          UPDATE public.produtos_empreendimento 
          SET status = 'Disponível' 
          WHERE id = ANY($1::int[])
        `, [productIds]);
        console.log(`[OK] Unidades/Garagens IDs [${productIds.join(', ')}] liberadas e marcadas como 'Disponível' no estoque.`);
      }
    }

    // 7. Deletar notas de CRM geradas nos testes de confecção para o Ranniere
    const resNotes = await client.query(`
      DELETE FROM public.crm_notas 
      WHERE contato_id = $1 AND conteudo ILIKE '%Confecção de Contrato Autônoma%'
    `, [contatoId]);
    console.log(`[OK] Notas comerciais de teste removidas do CRM (${resNotes.rowCount} notas).`);

    // 8. Retornar Ranniere para tipo_contato = 'Lead'
    await client.query(`
      UPDATE public.contatos 
      SET tipo_contato = 'Lead' 
      WHERE id = $1 AND organizacao_id = $2
    `, [contatoId, organizacaoId]);
    console.log("[OK] Tipo do contato de Ranniere retornado para 'Lead'.");

    console.log("\n=== LIMPEZA DE CONTRATO CONCLUÍDA COM SUCESSO! ===");

  } catch (err) {
    console.error("Falha ao executar limpeza:", err);
  }

  await client.end();
}

run().catch(console.error);
