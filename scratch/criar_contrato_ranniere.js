const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// 1. Função de cálculo de 3 dias úteis
function calcularDataTresDiasUteis(dataInicial = new Date()) {
  let data = new Date(dataInicial);
  let diasUteisAdicionados = 0;
  
  while (diasUteisAdicionados < 3) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay();
    
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasUteisAdicionados++;
    }
  }
  
  return data.toISOString().split('T')[0];
}

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== INICIANDO CRIAÇÃO DE CONTRATO EM RASCUNHO REAL PARA RANNIERE ===");

  const contatoId = 5598; // RANNIERE CAMPOS MENDES
  const organizacaoId = 2; // Studio 57

  // A. Obter dados do contato Ranniere
  const resContato = await client.query(`
    SELECT id, nome, cpf, rg, regime_bens, conjuge_id
    FROM public.contatos
    WHERE id = $1 AND organizacao_id = $2
  `, [contatoId, organizacaoId]);

  if (resContato.rows.length === 0) {
    console.error("Contato do Ranniere não encontrado.");
    await client.end();
    return;
  }

  const ranniere = resContato.rows[0];
  console.log(`Contato: ${ranniere.nome} (ID: ${ranniere.id})`);

  // B. Buscar uma unidade disponível no Residencial Alfa (ID 1)
  const resProduto = await client.query(`
    SELECT id, unidade, valor_venda_calculado, empreendimento_id
    FROM public.produtos_empreendimento
    WHERE status = 'Disponível' AND organizacao_id = $1 AND empreendimento_id = 1
    LIMIT 1
  `, [organizacaoId]);

  if (resProduto.rows.length === 0) {
    console.error("Nenhum lote 'Disponível' no Residencial Alfa.");
    await client.end();
    return;
  }

  const produto = resProduto.rows[0];
  console.log(`Unidade comercializada de teste: ${produto.unidade} (ID: ${produto.id}, Valor: R$ ${produto.valor_venda_calculado})`);

  // C. Configurar dados da proposta simulada de fechamento
  const valorVenda = parseFloat(produto.valor_venda_calculado) || 450000.00;
  const entrada = valorVenda * 0.20; // 20% de entrada
  const parcelasObra = valorVenda * 0.40; // 40% em parcelas de obra
  const saldoChaves = valorVenda * 0.40; // 40% de saldo final
  const tresDiasUteis = calcularDataTresDiasUteis(new Date());

  const dadosContrato = {
    tipo_documento: 'CONTRATO',
    empreendimento_id: 1, // Residencial Alfa
    produto_id: produto.id,
    valor_final_venda: valorVenda,
    plano_pagamento: {
      desconto_valor: 0,
      entrada_valor: entrada,
      num_parcelas_entrada: 1,
      data_primeira_parcela_entrada: tresDiasUteis,
      parcelas_obra_valor: parcelasObra,
      num_parcelas_obra: 36,
      data_primeira_parcela_obra: null, // Sistema calcula 1 mês após a entrada
      saldo_remanescente_valor: saldoChaves
    },
    // Vamos cadastrar um cônjuge fictício para testar o fluxo de cadastro e associação completa
    dados_conjuge: {
      nome: "Stella Mendes IA",
      cpf: "88888888888",
      rg: "MG9999999",
      cargo: "Assistente de Negócios Inteligentes",
      nacionalidade: "Brasileira",
      email: "stella.ia@studio57.com.br",
      telefone: "31988888888"
    }
  };

  try {
    // 1. Garantir que o Ranniere está na tabela contatos_no_funil
    const resFunil = await client.query(`
      SELECT id FROM public.contatos_no_funil WHERE contato_id = $1 AND organizacao_id = $2 LIMIT 1
    `, [contatoId, organizacaoId]);

    let funilId = resFunil.rows[0]?.id || null;

    if (!funilId) {
      console.log("Ranniere não está no funil comercial. Inserindo no funil na etapa de Contrato...");
      // Buscar ID da coluna CONTRATO ou etapa inicial
      const resColuna = await client.query(`
        SELECT id FROM public.funil_colunas 
        WHERE organizacao_id = $1 AND nome ILIKE '%contrato%'
        LIMIT 1
      `, [organizacaoId]);
      
      let colunaId = resColuna.rows[0]?.id;
      if (!colunaId) {
        // Fallback para qualquer coluna
        const resCol = await client.query(`SELECT id FROM public.funil_colunas WHERE organizacao_id = $1 LIMIT 1`, [organizacaoId]);
        colunaId = resCol.rows[0]?.id || 'c69be155-8422-45a2-a59d-0d47458be1bc';
      }

      const resInsFunil = await client.query(`
        INSERT INTO public.contatos_no_funil (contato_id, coluna_id, organizacao_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [contatoId, colunaId, organizacaoId]);
      
      funilId = resInsFunil.rows[0].id;
      console.log(`[OK] Ranniere adicionado ao funil. ID: ${funilId}`);
    } else {
      console.log(`[OK] Ranniere já está no funil comercial. ID: ${funilId}`);
    }

    // Mudar tipo de contato de 'Lead' para 'Cliente'
    await client.query(`
      UPDATE public.contatos SET tipo_contato = 'Cliente' WHERE id = $1
    `, [contatoId]);
    console.log("[OK] Tipo do contato atualizado para 'Cliente'.");

    // 2. Processar Cônjuge
    let conjugeId = null;
    const conj = dadosContrato.dados_conjuge;
    
    // Buscar se já existe cônjuge Stella
    const resConjExistente = await client.query(`
      SELECT id FROM public.contatos WHERE cpf = $1 AND organizacao_id = $2 LIMIT 1
    `, [conj.cpf, organizacaoId]);

    if (resConjExistente.rows.length > 0) {
      conjugeId = resConjExistente.rows[0].id;
      console.log(`[OK] Cônjuge Stella já cadastrado anteriormente. ID: ${conjugeId}`);
    } else {
      const resInsConj = await client.query(`
        INSERT INTO public.contatos (nome, cpf, rg, cargo, nacionalidade, tipo_contato, organizacao_id, status)
        VALUES ($1, $2, $3, $4, $5, 'Cliente', $6, 'Ativo')
        RETURNING id
      `, [conj.nome, conj.cpf, conj.rg, conj.cargo, conj.nacionalidade, organizacaoId]);
      
      conjugeId = resInsConj.rows[0].id;
      console.log(`[OK] Cônjuge Stella cadastrado com sucesso. ID: ${conjugeId}`);
      
      // Emails e Telefones do cônjuge
      await client.query(`INSERT INTO public.emails (contato_id, email, organizacao_id) VALUES ($1, $2, $3)`, [conjugeId, conj.email, organizacaoId]);
      await client.query(`INSERT INTO public.telefones (contato_id, telefone, organizacao_id) VALUES ($1, $2, $3)`, [conjugeId, conj.telefone, organizacaoId]);
      console.log(`[OK] Emails e Telefones do cônjuge cadastrados.`);
    }

    // Vincular cônjuge ao Ranniere
    await client.query(`UPDATE public.contatos SET conjuge_id = $1, regime_bens = 'Comunhão Parcial de Bens' WHERE id = $2`, [conjugeId, contatoId]);
    console.log("[OK] Cônjuge e Regime de Bens associados ao contato do Ranniere.");

    // 3. Criar Contrato
    const resContrato = await client.query(`
      INSERT INTO public.contratos (
        contato_id, produto_id, empreendimento_id, data_venda, 
        valor_final_venda, status_contrato, tipo_documento, 
        organizacao_id, conjuge_id, regime_bens, indice_reajuste
      )
      VALUES ($1, $2, $3, CURRENT_DATE, $4, 'Rascunho', $5, $6, $7, $8, 'INCC')
      RETURNING id
    `, [
      contatoId, 
      produto.id, 
      produto.empreendimento_id, 
      dadosContrato.valor_final_venda, 
      dadosContrato.tipo_documento, 
      organizacaoId, 
      conjugeId, 
      'Comunhão Parcial de Bens'
    ]);
    
    const contratoId = resContrato.rows[0].id;
    console.log(`[OK] Registro de contrato inserido com sucesso. ID do Contrato: ${contratoId}`);

    // 4. Vincular contrato_produtos
    await client.query(`
      INSERT INTO public.contrato_produtos (contrato_id, produto_id, organizacao_id)
      VALUES ($1, $2, $3)
    `, [contratoId, produto.id, organizacaoId]);
    console.log("[OK] Vínculo em contrato_produtos inserido.");

    // 5. Reservar lote no estoque
    await client.query(`
      UPDATE public.produtos_empreendimento 
      SET status = 'Reservado' 
      WHERE id = $1
    `, [produto.id]);
    console.log(`[OK] Unidade "${produto.unidade}" reservada no estoque (status = 'Reservado').`);

    // 6. Chamar garantir_simulacao_para_contrato via RPC
    const resRpcSim = await client.query(`
      SELECT * FROM public.garantir_simulacao_para_contrato($1, $2)
    `, [contratoId, organizacaoId]);
    
    let simulacao = resRpcSim.rows[0].garantir_simulacao_para_contrato;
    if (typeof simulacao === 'string') {
      simulacao = JSON.parse(simulacao);
    }
    console.log(`[OK] RPC garantir_simulacao_para_contrato executada. ID Simulação: ${simulacao.id}`);

    // 7. Salvar parâmetros da simulação
    const p = dadosContrato.plano_pagamento;
    const dataPrimeiraObraObj = new Date(tresDiasUteis + 'T12:00:00');
    dataPrimeiraObraObj.setMonth(dataPrimeiraObraObj.getMonth() + 1);
    const dataPrimeiraObra = dataPrimeiraObraObj.toISOString().split('T')[0];

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
      dadosContrato.valor_final_venda,
      p.desconto_valor,
      p.entrada_valor,
      p.num_parcelas_entrada,
      tresDiasUteis,
      p.parcelas_obra_valor,
      p.num_parcelas_obra,
      dataPrimeiraObra,
      p.saldo_remanescente_valor,
      produto.id,
      simulacao.id
    ]);
    console.log("[OK] Dados da simulação atualizados com sucesso.");

    // 8. Regerar parcelas do contrato
    const resRpcParcelas = await client.query(`
      SELECT count(*) as total_parcelas 
      FROM public.regerar_parcelas_contrato($1, $2)
    `, [contratoId, organizacaoId]);
    console.log(`[OK] RPC regerar_parcelas_contrato executada. Total de parcelas geradas: ${resRpcParcelas.rows[0].total_parcelas}`);

    // 9. Mover lead no funil para a etapa "CONTRATO"
    // Buscamos o ID da coluna CONTRATO real (c69be155-8422-45a2-a59d-0d47458be1bc)
    await client.query(`
      UPDATE public.contatos_no_funil
      SET coluna_id = 'c69be155-8422-45a2-a59d-0d47458be1bc'
      WHERE id = $1
    `, [funilId]);
    console.log("[OK] Lead movido no funil do CRM para a coluna 'CONTRATO'!");

    // 10. Gravar nota no CRM (timeline)
    await client.query(`
      INSERT INTO public.crm_notas (contato_id, contato_no_funil_id, conteudo, organizacao_id)
      VALUES ($1, $2, $3, $4)
    `, [
      contatoId, 
      funilId, 
      `Confecção de Contrato Autônoma: Stella IA gerou com sucesso o rascunho de contrato para o Ranniere Campos Mendes referente à unidade "${produto.unidade}" (Residencial Alfa) no valor de R$ ${valorVenda}. O cônjuge "Stella Mendes IA" foi cadastrado e associado. O cronograma financeiro está montado e pronto para a emissão do PDF comercial.`, 
      organizacaoId
    ]);
    console.log("[OK] Nota comercial registrada na timeline do CRM.");

    console.log(`\n=== CONTRATO RASCUNHO REAL CRIADO COM SUCESSO! ID: ${contratoId} ===`);

  } catch (err) {
    console.error("Falha ao criar o contrato:", err);
  }

  await client.end();
}

run().catch(console.error);
