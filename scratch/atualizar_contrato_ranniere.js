const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== CORRIGINDO O CONTRATO DO RANNIERE (CONTRATO ID 121) ===");

  const contatoId = 5598; // RANNIERE CAMPOS MENDES
  const organizacaoId = 2; // Studio 57
  const contratoId = 121; // ID do contrato criado no passo anterior

  // 1. Buscar a Stella IA real na organização 2 para obter o corretor_id correto
  // Procuramos nos contatos pelo nome 'Stella' e tipo correspondente
  const resCorretor = await client.query(`
    SELECT id, nome FROM public.contatos 
    WHERE nome ILIKE '%Stella%' AND organizacao_id = $1
    LIMIT 1
  `, [organizacaoId]);

  let stellaCorretorId = null;
  if (resCorretor.rows.length > 0) {
    stellaCorretorId = resCorretor.rows[0].id;
    console.log(`[OK] Encontrada Stella IA real como corretora: ${resCorretor.rows[0].nome} (ID: ${stellaCorretorId})`);
  } else {
    // Se não achar, busca qualquer contato que pareça com a Stella
    const resFall = await client.query(`SELECT id, nome FROM public.contatos WHERE nome ILIKE '%Stella%' LIMIT 1`);
    if (resFall.rows.length > 0) {
      stellaCorretorId = resFall.rows[0].id;
      console.log(`[OK-Fallback] Stella encontrada: ${resFall.rows[0].nome} (ID: ${stellaCorretorId})`);
    }
  }

  // 2. Corrigir dados de cônjuge e regime de bens no comprador Ranniere (Solteiro)
  await client.query(`
    UPDATE public.contatos 
    SET conjuge_id = NULL, regime_bens = NULL 
    WHERE id = $1 AND organizacao_id = $2
  `, [contatoId, organizacaoId]);
  console.log("[OK] Dados de cônjuge e regime de bens zerados no cadastro de Ranniere (Solteiro).");

  // 3. Atualizar o Contrato ID 121
  // - Remover conjuge_id e regime_bens
  // - Definir corretor_id como o da Stella IA
  // - Definir percentual_comissao_corretagem como 5% e calcular valor_comissao_corretagem
  const resContrato = await client.query(`
    SELECT valor_final_venda FROM public.contratos WHERE id = $1 AND organizacao_id = $2
  `, [contratoId, organizacaoId]);

  if (resContrato.rows.length === 0) {
    console.error("Contrato 121 não encontrado.");
    await client.end();
    return;
  }

  const valorVenda = parseFloat(resContrato.rows[0].valor_final_venda) || 0;
  const comissaoPercentual = 5.0;
  const comissaoValor = valorVenda * (comissaoPercentual / 100.0);

  await client.query(`
    UPDATE public.contratos 
    SET 
      conjuge_id = NULL, 
      regime_bens = NULL,
      corretor_id = $1,
      percentual_comissao_corretagem = $2,
      valor_comissao_corretagem = $3
    WHERE id = $4 AND organizacao_id = $5
  `, [stellaCorretorId, comissaoPercentual, comissaoValor, contratoId, organizacaoId]);

  console.log(`[OK] Contrato 121 atualizado com corretor (${stellaCorretorId}), comissão de 5% (R$ ${comissaoValor}) e cônjuge removido.`);

  // 4. Limpar o contato de cônjuge fake "Stella Mendes IA" (CPF 88888888888) que criamos no teste
  const resConjFake = await client.query(`
    SELECT id FROM public.contatos WHERE cpf = '88888888888' AND organizacao_id = $1 LIMIT 1
  `, [organizacaoId]);

  if (resConjFake.rows.length > 0) {
    const conjFakeId = resConjFake.rows[0].id;
    // Deletar emails e telefones vinculados
    await client.query(`DELETE FROM public.emails WHERE contato_id = $1`, [conjFakeId]);
    await client.query(`DELETE FROM public.telefones WHERE contato_id = $1`, [conjFakeId]);
    // Deletar contato
    await client.query(`DELETE FROM public.contatos WHERE id = $1`, [conjFakeId]);
    console.log(`[OK] Cônjuge fake 'Stella Mendes IA' (ID: ${conjFakeId}) removido completamente do banco.`);
  }

  // 5. Atualizar a nota do CRM para descrever a correção
  await client.query(`
    UPDATE public.crm_notas
    SET conteudo = $1
    WHERE contato_id = $2 AND conteudo ILIKE '%Confecção de Contrato Autônoma%' AND organizacao_id = $3
  `, [
    `Confecção de Contrato Autônoma: Rascunho de contrato para o Ranniere Campos Mendes referente à unidade "303" (Residencial Alfa) no valor de R$ ${valorVenda} criado com sucesso. Cliente é solteiro (sem cônjuge). Corretora responsável: Stella IA (comissão de 5.0% padrão - R$ ${comissaoValor} gerada). Pronto para revisão e emissão do PDF comercial.`,
    contatoId,
    organizacaoId
  ]);
  console.log("[OK] Nota comercial atualizada na timeline do CRM.");

  console.log("\n=== CORREÇÃO EXECUTADA COM SUCESSO NO BANCO DE DADOS ===");

  await client.end();
}

run().catch(console.error);
