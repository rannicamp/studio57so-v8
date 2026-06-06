const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// 1. Função de cálculo de 3 dias úteis
function calcularDataTresDiasUteis(dataInicial = new Date()) {
  let data = new Date(dataInicial);
  let diasUteisAdicionados = 0;
  
  while (diasUteisAdicionados < 3) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay(); // 0 = Domingo, 6 = Sábado
    
    // Ignora sábado e domingo
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasUteisAdicionados++;
    }
  }
  
  return data.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== INICIANDO TESTE DO SISTEMA DE CONTRATOS DA STELLA ===");

  // A. Buscar um comprador de teste
  const resComprador = await client.query(`
    SELECT id, nome, organizacao_id, conjuge_id, regime_bens
    FROM public.contatos 
    WHERE tipo_contato = 'Cliente' AND organizacao_id = 2 AND cpf IS NOT NULL AND cpf <> ''
    LIMIT 1
  `);
  
  if (resComprador.rows.length === 0) {
    console.error("Nenhum comprador com CPF cadastrado encontrado na Org 2.");
    await client.end();
    return;
  }
  
  const comprador = resComprador.rows[0];
  console.log(`Comprador de teste selecionado: ${comprador.nome} (ID: ${comprador.id}, Org: ${comprador.organizacao_id})`);

  // B. Buscar um lote/unidade disponível (status = 'Disponível')
  // Vamos buscar no Residencial Alfa (ID 1)
  const resLote = await client.query(`
    SELECT id, unidade, valor_venda_calculado, empreendimento_id
    FROM public.produtos_empreendimento
    WHERE status = 'Disponível' AND organizacao_id = 2 AND empreendimento_id = 1
    LIMIT 1
  `);

  if (resLote.rows.length === 0) {
    console.error("Nenhum lote 'Disponível' encontrado no Residencial Alfa (Org 2).");
    await client.end();
    return;
  }

  const lote = resLote.rows[0];
  console.log(`Lote de teste selecionado: ${lote.unidade} (ID: ${lote.id}, Valor: ${lote.valor_venda_calculado}, Empreendimento: ${lote.empreendimento_id})`);

  // C. Testar o cálculo de 3 dias úteis
  const hoje = new Date();
  const tresDiasUteis = calcularDataTresDiasUteis(hoje);
  console.log(`Teste cálculo de data: Hoje é ${hoje.toISOString().split('T')[0]}, 3 dias úteis depois será: ${tresDiasUteis}`);

  // D. Simular dados do fechamento do contrato (incluindo dados do cônjuge)
  const dadosContratoSimulado = {
    tipo_documento: 'CONTRATO', // Residencial Alfa exige CONTRATO
    empreendimento_id: lote.empreendimento_id,
    produto_id: lote.id,
    valor_final_venda: parseFloat(lote.valor_venda_calculado),
    plano_pagamento: {
      desconto_valor: 0,
      entrada_valor: parseFloat(lote.valor_venda_calculado) * 0.20,
      num_parcelas_entrada: 1,
      data_primeira_parcela_entrada: tresDiasUteis,
      parcelas_obra_valor: parseFloat(lote.valor_venda_calculado) * 0.40,
      num_parcelas_obra: 36,
      data_primeira_parcela_obra: null, // Será gerada automaticamente para 1 mês após a entrada
      saldo_remanescente_valor: parseFloat(lote.valor_venda_calculado) * 0.40
    },
    dados_conjuge: {
      nome: "Maria das Dores de Teste",
      cpf: "12345678901",
      rg: "MG12345678",
      cargo: "Médica",
      nacionalidade: "Brasileira",
      email: "maria.teste@elo57.com.br",
      telefone: "33999999999"
    }
  };

  console.log("\n--- EXECUTANDO FLUXO DE CRIAÇÃO DO CONTRATO ---");

  // Transação de Teste (podemos fazer um rollback no final para não sujar o banco!)
  try {
    await client.query('BEGIN');

    // 1. Processar Cônjuge
    let conjugeId = null;
    const { nome, cpf, rg, cargo, nacionalidade, email, telefone } = dadosContratoSimulado.dados_conjuge;
    
    // Inserir contato cônjuge
    const resInsertConj = await client.query(`
      INSERT INTO public.contatos (nome, cpf, rg, cargo, nacionalidade, tipo_contato, organizacao_id, status)
      VALUES ($1, $2, $3, $4, $5, 'Cliente', $6, 'Ativo')
      RETURNING id
    `, [nome, cpf, rg, cargo, nacionalidade, comprador.organizacao_id]);
    
    conjugeId = resInsertConj.rows[0].id;
    console.log(`[OK] Cônjuge inserido. ID gerado: ${conjugeId}`);

    // Emails e Telefones do cônjuge
    await client.query(`INSERT INTO public.emails (contato_id, email, organizacao_id) VALUES ($1, $2, $3)`, [conjugeId, email, comprador.organizacao_id]);
    await client.query(`INSERT INTO public.telefones (contato_id, telefone, organizacao_id) VALUES ($1, $2, $3)`, [conjugeId, telefone, comprador.organizacao_id]);
    console.log(`[OK] Emails e Telefones do cônjuge cadastrados.`);

    // Associar cônjuge ao comprador
    await client.query(`UPDATE public.contatos SET conjuge_id = $1 WHERE id = $2`, [conjugeId, comprador.id]);
    console.log(`[OK] Cônjuge associado ao comprador.`);

    // 2. Criar Contrato como Rascunho
    let indiceReajuste = 'INCC'; // Residencial Alfa
    const resContrato = await client.query(`
      INSERT INTO public.contratos (
        contato_id, produto_id, empreendimento_id, data_venda, 
        valor_final_venda, status_contrato, tipo_documento, 
        organizacao_id, conjuge_id, regime_bens, indice_reajuste
      )
      VALUES ($1, $2, $3, CURRENT_DATE, $4, 'Rascunho', $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      comprador.id, 
      lote.id, 
      lote.empreendimento_id, 
      dadosContratoSimulado.valor_final_venda, 
      dadosContratoSimulado.tipo_documento, 
      comprador.organizacao_id, 
      conjugeId, 
      comprador.regime_bens,
      indiceReajuste
    ]);
    
    const contratoId = resContrato.rows[0].id;
    console.log(`[OK] Registro na tabela contratos criado. ID: ${contratoId}`);

    // 3. Vincular produto
    await client.query(`
      INSERT INTO public.contrato_produtos (contrato_id, produto_id, organizacao_id)
      VALUES ($1, $2, $3)
    `, [contratoId, lote.id, comprador.organizacao_id]);
    console.log(`[OK] Vínculo contrato_produtos inserido.`);

    // 4. Reservar lote no estoque
    await client.query(`
      UPDATE public.produtos_empreendimento 
      SET status = 'Reservado' 
      WHERE id = $1
    `, [lote.id]);
    console.log(`[OK] Unidade reservada no estoque (status = 'Reservado').`);

    // 5. Garantir simulação via RPC
    const resRpcSim = await client.query(`
      SELECT * FROM public.garantir_simulacao_para_contrato($1, $2)
    `, [contratoId, comprador.organizacao_id]);
    
    // Se retornar string JSON, fazemos parse
    let simulacao = resRpcSim.rows[0].garantir_simulacao_para_contrato;
    if (typeof simulacao === 'string') {
      simulacao = JSON.parse(simulacao);
    }
    console.log(`[OK] RPC garantir_simulacao_para_contrato executada. ID Simulação: ${simulacao.id}`);

    // 6. Atualizar parâmetros da simulação
    const p = dadosContratoSimulado.plano_pagamento;
    let dataPrimeiraObra = p.data_primeira_parcela_obra;
    if (!dataPrimeiraObra) {
      const dataEntradaObj = new Date(tresDiasUteis + 'T12:00:00');
      dataEntradaObj.setMonth(dataEntradaObj.getMonth() + 1);
      dataPrimeiraObra = dataEntradaObj.toISOString().split('T')[0];
    }

    await client.query(`
      UPDATE public.simulacoes
      SET 
        valor_venda = $1,
        desconto_valor = $2,
        entrada_valor = $3,
        num_parcelas_entrada = $4,
        data_primeira_parcela_entrada = $5,
        parcelas_obra_valor = $6,
        num_parcelas_obra = $7,
        data_primeira_parcela_obra = $8,
        saldo_remanescente_valor = $9,
        status = 'Aprovado',
        produto_id = $10
      WHERE id = $11
    `, [
      dadosContratoSimulado.valor_final_venda,
      p.desconto_valor,
      p.entrada_valor,
      p.num_parcelas_entrada,
      tresDiasUteis,
      p.parcelas_obra_valor,
      p.num_parcelas_obra,
      dataPrimeiraObra,
      p.saldo_remanescente_valor,
      lote.id,
      simulacao.id
    ]);
    console.log(`[OK] Parâmetros de simulação salvos com sucesso.`);

    // 7. Gerar parcelas via RPC
    const resRpcParcelas = await client.query(`
      SELECT count(*) as total_parcelas 
      FROM public.regerar_parcelas_contrato($1, $2)
    `, [contratoId, comprador.organizacao_id]);
    console.log(`[OK] RPC regerar_parcelas_contrato executada. Total de parcelas geradas: ${resRpcParcelas.rows[0].total_parcelas}`);

    // 8. Consultar parcelas geradas para conferência
    const resParcelas = await client.query(`
      SELECT id, descricao, tipo, data_vencimento, valor_parcela, status_pagamento 
      FROM public.contrato_parcelas 
      WHERE contrato_id = $1
      ORDER BY data_vencimento
    `, [contratoId]);

    console.log("\n--- DETALHAMENTO DAS PARCELAS GERADAS NO CRONOGRAMA ---");
    resParcelas.rows.forEach(p => {
      console.log(`  - [${p.tipo}] Vencimento: ${p.data_vencimento.toISOString().split('T')[0]} | Valor: R$ ${p.valor_parcela} | Status: ${p.status_pagamento} | Descrição: ${p.descricao}`);
    });

    // 9. Registrar nota no CRM
    let funilId = null;
    try {
      const resFunil = await client.query(`
        SELECT id FROM public.contatos_no_funil WHERE contato_id = $1 LIMIT 1
      `, [comprador.id]);
      funilId = resFunil.rows[0]?.id || null;
      
      if (!funilId) {
        console.log(`[AVISO] Comprador de teste não está no funil. Criando entrada temporária no funil para a nota comercial.`);
        
        // Buscar uma coluna do funil daquela organização
        const resColuna = await client.query(`
          SELECT id FROM public.funil_colunas 
          WHERE organizacao_id = $1 
          LIMIT 1
        `, [comprador.organizacao_id]);
        
        let colunaId = resColuna.rows[0]?.id;
        if (!colunaId) {
          colunaId = 'c69be155-8422-45a2-a59d-0d47458be1bc';
        }
        
        const resInsertFunil = await client.query(`
          INSERT INTO public.contatos_no_funil (contato_id, coluna_id, organizacao_id)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [comprador.id, colunaId, comprador.organizacao_id]);
        
        funilId = resInsertFunil.rows[0].id;
        console.log(`[OK] Entrada temporária no funil criada com ID: ${funilId}`);
      }

      await client.query(`
        INSERT INTO public.crm_notas (contato_id, contato_no_funil_id, conteudo, organizacao_id)
        VALUES ($1, $2, $3, $4)
      `, [
        comprador.id, 
        funilId, 
        `Confecção de Contrato Autônoma (TESTE): Rascunho gerado pela Stella para a unidade "${lote.unidade}".`, 
        comprador.organizacao_id
      ]);
      console.log(`\n[OK] Nota do CRM registrada com sucesso.`);
    } catch (notaErr) {
      console.warn(`\n[AVISO] Falha ao registrar nota de teste no CRM (não aborta o teste principal):`, notaErr.message);
    }

    console.log("\n>>> TESTE DE TRANSAÇÃO CONCLUÍDO COM SUCESSO! REALIZANDO ROLLBACK PARA PRESERVAR OS DADOS DE PRODUÇÃO <<<");
    await client.query('ROLLBACK');
    console.log("[ROLLBACK] Banco de dados limpo com sucesso.");

  } catch (err) {
    console.error("\n[ERRO FATAL NA EXECUÇÃO DA TRANSAÇÃO]:", err);
    await client.query('ROLLBACK');
    console.log("[ROLLBACK Executado devido a falha]");
  }

  await client.end();
}

run().catch(err => {
  console.error("Erro na execução geral:", err);
});
