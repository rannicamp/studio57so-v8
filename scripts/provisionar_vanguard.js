// Caminho: scripts/provisionar_vanguard.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos nas variáveis de ambiente");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const ORG_ID = 57;

async function runProvisioning() {
  console.log(`🔄 Iniciando provisionamento dinâmico para a Organização Fictícia Vanguard (ID: ${ORG_ID})...`);

  try {
    // 1. Limpeza em cascata para garantir idempotência
    console.log("🧹 Limpando dados anteriores da Org 57...");
    
    await supabase.from('lancamentos').delete().eq('organizacao_id', ORG_ID);
    await supabase.from('contas_financeiras').delete().eq('organizacao_id', ORG_ID);
    await supabase.from('categorias_financeiras').delete().eq('organizacao_id', ORG_ID);
    await supabase.from('contrato_parcelas').delete().eq('organizacao_id', ORG_ID);
    await supabase.from('contratos').delete().eq('organizacao_id', ORG_ID);
    await supabase.from('contatos_no_funil').delete().eq('organizacao_id', ORG_ID);
    await supabase.from('colunas_funil').delete().eq('organizacao_id', ORG_ID);
    await supabase.from('funis').delete().eq('organizacao_id', ORG_ID);
    
    // Limpar telefones e emails vinculados antes de deletar contatos
    const { data: contatosParaLimpar } = await supabase.from('contatos').select('id').eq('organizacao_id', ORG_ID);
    if (contatosParaLimpar && contatosParaLimpar.length > 0) {
      const contatoIds = contatosParaLimpar.map(c => c.id);
      await supabase.from('telefones').delete().in('contato_id', contatoIds);
      await supabase.from('emails').delete().in('contato_id', contatoIds);
    }
    await supabase.from('contatos').delete().eq('organizacao_id', ORG_ID);
    
    await supabase.from('produtos_empreendimento').delete().eq('organizacao_id', ORG_ID);
    await supabase.from('empreendimentos').delete().eq('organizacao_id', ORG_ID);
    await supabase.from('cadastro_empresa').delete().eq('organizacao_id', ORG_ID);
    await supabase.from('organizacoes').delete().eq('id', ORG_ID);

    console.log("✅ Limpeza concluída com sucesso!");

    // 2. Inserir Organização (Vanguard)
    console.log("📦 Inserindo Organização...");
    const { error: orgErr } = await supabase.from('organizacoes').insert({
      id: ORG_ID,
      nome: 'Vanguard Incorporações & SPEs',
      subscription_status: 'active',
      trial_ends_at: new Date('2030-12-31').toISOString(),
      subscription_expires_at: new Date('2030-12-31').toISOString(),
    });
    if (orgErr) throw new Error(`Erro ao criar organizacao: ${orgErr.message}`);

    // 3. Inserir Empresa em cadastro_empresa (retornar o ID gerado)
    console.log("🏢 Inserindo Empresa (SPE)...");
    const { data: empData, error: empErr } = await supabase.from('cadastro_empresa').insert({
      razao_social: 'Vanguard Incorporadora e Construtora Ltda',
      nome_fantasia: 'Vanguard Incorporações',
      cnpj: '45.188.358/0001-90',
      cep: '35160-290',
      city: 'Ipatinga',
      state: 'MG',
      neighborhood: 'Cariru',
      address_street: 'Rua Estados Unidos',
      address_number: '100',
      organizacao_id: ORG_ID,
      capital_social: 5000000.00,
      natureza_juridica: 'Sociedade Limitada'
    }).select('id').single();
    
    if (empErr) throw new Error(`Erro ao criar cadastro_empresa: ${empErr.message}`);
    const empresaId = empData.id;
    console.log(`✅ Empresa (SPE) criada com ID: ${empresaId}`);

    // 4. Inserir Empreendimento (referenciando empresaId)
    console.log("📐 Inserindo Empreendimento...");
    const { data: empdData, error: empdErr } = await supabase.from('empreendimentos').insert({
      empresa_proprietaria_id: empresaId,
      nome: 'Residencial Vista Parque',
      nome_empreendimento: 'Residencial Vista Parque',
      address_street: 'Avenida Roberto Burle Marx',
      address_number: '500',
      cep: '35160-001',
      city: 'Ipatinga',
      state: 'MG',
      neighborhood: 'Parque Ipanema',
      status: 'Em Obras',
      valor_total: '12.000.000',
      prazo_entrega: 'Dezembro de 2027',
      indice_reajuste: 'INCC',
      listado_para_venda: true,
      organizacao_id: ORG_ID
    }).select('id').single();
    
    if (empdErr) throw new Error(`Erro ao criar empreendimento: ${empdErr.message}`);
    const empreendimentoId = empdData.id;
    console.log(`✅ Empreendimento criado com ID: ${empreendimentoId}`);

    // 5. Inserir Unidades (produtos_empreendimento)
    console.log("🏠 Inserindo Unidades (Estoque)...");
    const unidades = [];
    for (let i = 1; i <= 10; i++) {
      const andar = Math.floor((i - 1) / 2) + 1;
      const num = 100 * andar + (i % 2 === 0 ? 2 : 1);
      const isVendida = i <= 3; // 3 vendidas, o resto livre
      
      unidades.push({
        empreendimento_id: empreendimentoId,
        tipo: 'Apartamento',
        unidade: `AP ${num}`,
        area_m2: num % 2 === 0 ? 78.5 : 56.2,
        valor_base: num % 2 === 0 ? 450000.00 : 320000.00,
        status: isVendida ? 'Vendido' : 'Disponível',
        organizacao_id: ORG_ID
      });
    }
    const { data: prodData, error: prodErr } = await supabase.from('produtos_empreendimento').insert(unidades).select('id', 'unidade');
    if (prodErr) throw new Error(`Erro ao criar unidades: ${prodErr.message}`);
    
    const unidadesMap = {};
    prodData.forEach(p => {
      unidadesMap[p.unidade] = p.id;
    });
    console.log("✅ Unidades criadas e mapeadas!");

    // 6. Inserir Categorias Financeiras
    console.log("🏷️ Inserindo Categorias Financeiras...");
    const categorias = [
      { nome: 'Venda de Unidades', tipo: 'Receita', organizacao_id: ORG_ID },
      { nome: 'Aporte de Sócios', tipo: 'Receita', organizacao_id: ORG_ID },
      { nome: 'Materiais de Construção', tipo: 'Despesa', organizacao_id: ORG_ID },
      { nome: 'Mão de Obra', tipo: 'Despesa', organizacao_id: ORG_ID },
      { nome: 'Marketing & Comercial', tipo: 'Despesa', organizacao_id: ORG_ID },
      { nome: 'Administrativo & Salários', tipo: 'Despesa', organizacao_id: ORG_ID }
    ];
    const { data: catData, error: catErr } = await supabase.from('categorias_financeiras').insert(categorias).select('id', 'nome');
    if (catErr) throw new Error(`Erro ao criar categorias: ${catErr.message}`);
    
    const categoriasMap = {};
    catData.forEach(c => {
      categoriasMap[c.nome] = c.id;
    });

    // 7. Inserir Contas Financeiras
    console.log("🏦 Inserindo Conta Bancária...");
    const { data: contaData, error: contaErr } = await supabase.from('contas_financeiras').insert({
      nome: 'Banco do Brasil - Conta Operacional Vanguard',
      tipo: 'Conta Corrente',
      saldo_inicial: 150000.00,
      instituicao: 'Banco do Brasil',
      empresa_id: empresaId,
      agencia: '1234-5',
      numero_conta: '98765-4',
      organizacao_id: ORG_ID
    }).select('id').single();
    if (contaErr) throw new Error(`Erro ao criar conta financeira: ${contaErr.message}`);
    const contaId = contaData.id;

    // 8. Inserir Contatos de Teste
    console.log("📇 Inserindo Contatos (Clientes, Leads, Corretores)...");
    const contatosFicticios = [
      { nome: 'João de Souza Beltrano', tipo_contato: 'Cliente', personalidade_juridica: 'Pessoa Física', cpf: '111.222.333-44', organizacao_id: ORG_ID, status: 'Ativo' },
      { nome: 'Maria Ciclana de Oliveira', tipo_contato: 'Cliente', personalidade_juridica: 'Pessoa Física', cpf: '555.666.777-88', organizacao_id: ORG_ID, status: 'Ativo' },
      { nome: 'Lucas Alencar (Lead de Testes)', tipo_contato: 'Lead', personalidade_juridica: 'Pessoa Física', organizacao_id: ORG_ID, status: 'Ativo', ia_atendimento_ativo: true },
      { nome: 'Patrícia Lima Mendes', tipo_contato: 'Lead', personalidade_juridica: 'Pessoa Física', organizacao_id: ORG_ID, status: 'Ativo' },
      { nome: 'Carlos Eduardo Corretor', tipo_contato: 'Corretor', personalidade_juridica: 'Pessoa Física', creci: 'MG-99887', organizacao_id: ORG_ID, status: 'Ativo' },
      { nome: 'ConstruMais Distribuidora', tipo_contato: 'Fornecedor', personalidade_juridica: 'Pessoa Jurídica', cnpj: '99.888.777/0001-66', organizacao_id: ORG_ID, status: 'Ativo' }
    ];
    
    const { data: contData, error: contErr } = await supabase.from('contatos').insert(contatosFicticios).select('id', 'nome');
    if (contErr) throw new Error(`Erro ao criar contatos: ${contErr.message}`);
    
    const contatosMap = {};
    contData.forEach(c => {
      contatosMap[c.nome] = c.id;
    });

    // Inserir telefones e emails para os contatos criados usando os IDs reais
    console.log("📱 Inserindo Telefones e E-mails dos Contatos...");
    const telefones = [
      { contato_id: contatosMap['João de Souza Beltrano'], telefone: '31988887777', country_code: '+55' },
      { contato_id: contatosMap['Maria Ciclana de Oliveira'], telefone: '31977776666', country_code: '+55' },
      { contato_id: contatosMap['Lucas Alencar (Lead de Testes)'], telefone: '5533991912291', country_code: '+55' },
      { contato_id: contatosMap['Patrícia Lima Mendes'], telefone: '31955554444', country_code: '+55' }
    ];
    const emails = [
      { contato_id: contatosMap['João de Souza Beltrano'], email: 'joao.beltrano@exemplo.com' },
      { contato_id: contatosMap['Maria Ciclana de Oliveira'], email: 'maria.ciclana@exemplo.com' },
      { contato_id: contatosMap['Lucas Alencar (Lead de Testes)'], email: 'rannierecampos@studio57.arq.br' },
      { contato_id: contatosMap['Patrícia Lima Mendes'], email: 'patricia.mendes@exemplo.com' }
    ];
    await supabase.from('telefones').insert(telefones);
    await supabase.from('emails').insert(emails);

    // 9. Inserir Funil de Vendas e Colunas
    console.log("🎯 Inserindo Funil de Vendas do CRM...");
    const { data: funilData, error: funilErr } = await supabase.from('funis').insert({
      empreendimento_id: empreendimentoId,
      nome: 'Funil Geral Vanguard',
      organizacao_id: ORG_ID,
      is_sistema: true
    }).select('id').single();
    if (funilErr) throw new Error(`Erro ao criar funil: ${funilErr.message}`);
    const funilId = funilData.id;

    const colunas = [
      { funil_id: funilId, nome: 'Sem Contato (Novo)', ordem: 1, cor: 'bg-blue-50', tipo_coluna: 'etapa', organizacao_id: ORG_ID },
      { funil_id: funilId, nome: 'Qualificação Stella IA', ordem: 2, cor: 'bg-purple-50', tipo_coluna: 'etapa', organizacao_id: ORG_ID },
      { funil_id: funilId, nome: 'Visita Agendada', ordem: 3, cor: 'bg-amber-50', tipo_coluna: 'etapa', organizacao_id: ORG_ID },
      { funil_id: funilId, nome: 'Proposta Enviada', ordem: 4, cor: 'bg-indigo-50', tipo_coluna: 'etapa', organizacao_id: ORG_ID },
      { funil_id: funilId, nome: 'Fechamento / Contrato', ordem: 5, cor: 'bg-green-50', tipo_coluna: 'etapa', organizacao_id: ORG_ID }
    ];
    const { data: colData, error: colErr } = await supabase.from('colunas_funil').insert(colunas).select('id', 'nome');
    if (colErr) throw new Error(`Erro ao criar colunas do funil: ${colErr.message}`);
    
    const colunasMap = {};
    colData.forEach(col => {
      colunasMap[col.nome] = col.id;
    });

    // Posicionar os leads no funil
    console.log("📌 Posicionando Leads nas Colunas...");
    const leadsNoFunil = [
      { contato_id: contatosMap['Lucas Alencar (Lead de Testes)'], coluna_id: colunasMap['Qualificação Stella IA'], numero_card: 1, corretor_id: contatosMap['Carlos Eduardo Corretor'], organizacao_id: ORG_ID },
      { contato_id: contatosMap['Patrícia Lima Mendes'], coluna_id: colunasMap['Visita Agendada'], numero_card: 2, corretor_id: contatosMap['Carlos Eduardo Corretor'], organizacao_id: ORG_ID }
    ];
    await supabase.from('contatos_no_funil').insert(leadsNoFunil);

    // 10. Inserir Contrato (Corrigido com os nomes reais de campos do dump)
    console.log("📄 Inserindo Contrato...");
    const { data: contrData, error: contrErr } = await supabase.from('contratos').insert({
      contato_id: contatosMap['João de Souza Beltrano'], // Campo correto
      produto_id: unidadesMap['AP 101'],
      empreendimento_id: empreendimentoId,
      data_venda: '2026-01-15', // Campo correto
      valor_final_venda: 450000.00, // Campo correto
      status_contrato: 'Ativo', // Campo correto
      organizacao_id: ORG_ID,
      observacoes_contrato: 'Contrato padrão de demonstração Vanguard' // Campo correto
    }).select('id').single();
    if (contrErr) throw new Error(`Erro ao criar contrato: ${contrErr.message}`);
    const contratoId = contrData.id;

    // 11. Inserir Lançamentos Financeiros (Fluxo Realista de Caixa)
    console.log("💸 Inserindo Lançamentos Financeiros (Receitas e Despesas)...");
    const lancamentos = [
      { descricao: 'Parcela de Sinal - Contrato Vanguard (AP 101)', valor: 50000.00, tipo: 'Receita', status: 'Pago', conta_id: contaId, categoria_id: categoriasMap['Venda de Unidades'], data_transacao: '2026-01-15', data_pagamento: '2026-01-15', organizacao_id: ORG_ID, contrato_id: contratoId },
      { descricao: 'Mensalidade 01/12 - Contrato Vanguard (AP 101)', valor: 5000.00, tipo: 'Receita', status: 'Pago', conta_id: contaId, categoria_id: categoriasMap['Venda de Unidades'], data_transacao: '2026-02-15', data_pagamento: '2026-02-15', organizacao_id: ORG_ID, contrato_id: contratoId },
      { descricao: 'Mensalidade 02/12 - Contrato Vanguard (AP 101)', valor: 5000.00, tipo: 'Receita', status: 'Pago', conta_id: contaId, categoria_id: categoriasMap['Venda de Unidades'], data_transacao: '2026-03-15', data_pagamento: '2026-03-15', organizacao_id: ORG_ID, contrato_id: contratoId },
      { descricao: 'Mensalidade 03/12 - Contrato Vanguard (AP 101)', valor: 5000.00, tipo: 'Receita', status: 'Pendente', conta_id: contaId, categoria_id: categoriasMap['Venda de Unidades'], data_transacao: '2026-04-15', data_vencimento: '2026-04-15', organizacao_id: ORG_ID, contrato_id: contratoId },
      
      { data_transacao: '2026-01-05', data_pagamento: '2026-01-05', descricao: 'Aporte de Capital - Sócios Investidores', valor: 250000.00, tipo: 'Receita', status: 'Pago', conta_id: contaId, categoria_id: categoriasMap['Aporte de Sócios'], organizacao_id: ORG_ID },
      
      { data_transacao: '2026-02-10', data_pagamento: '2026-02-10', descricao: 'Compra de Cimento CP-II (500 sacos) - ConstruMais', valor: -18500.00, tipo: 'Despesa', status: 'Pago', conta_id: contaId, categoria_id: categoriasMap['Materiais de Construção'], organizacao_id: ORG_ID, favorecido_contato_id: contatosMap['ConstruMais Distribuidora'] },
      { data_transacao: '2026-02-12', data_pagamento: '2026-02-12', descricao: 'Locação de Betoneira e Andaimes', valor: -4200.00, tipo: 'Despesa', status: 'Pago', conta_id: contaId, categoria_id: categoriasMap['Materiais de Construção'], organizacao_id: ORG_ID },
      { data_transacao: '2026-02-28', data_pagamento: '2026-02-28', descricao: 'Folha de Pagamento - Equipe de Fundação Obra', valor: -22400.00, tipo: 'Despesa', status: 'Pago', conta_id: contaId, categoria_id: categoriasMap['Mão de Obra'], organizacao_id: ORG_ID },
      { data_transacao: '2026-02-18', data_pagamento: '2026-02-18', descricao: 'Fatura de Anúncios - Facebook Ads (Meta)', valor: -1500.00, tipo: 'Despesa', status: 'Pago', conta_id: contaId, categoria_id: categoriasMap['Marketing & Comercial'], organizacao_id: ORG_ID },
      { data_transacao: '2026-03-20', data_vencimento: '2026-03-25', descricao: 'Material Elétrico e Tubulações Tigre', valor: -12600.00, tipo: 'Despesa', status: 'Pendente', conta_id: contaId, categoria_id: categoriasMap['Materiais de Construção'], organizacao_id: ORG_ID }
    ];
    
    const { error: lancErr } = await supabase.from('lancamentos').insert(lancamentos);
    if (lancErr) throw new Error(`Erro ao criar lançamentos: ${lancErr.message}`);

    console.log("🚀 ======================================================= 🚀");
    console.log("🎉 PARABÉNS! PROVISIONAMENTO DA VANGUARD CONCLUÍDO COM SUCESSO!");
    console.log(`Organização ID: ${ORG_ID}`);
    console.log(`Empresa ID: ${empresaId} (Vanguard Incorporações)`);
    console.log(`Empreendimento ID: ${empreendimentoId} (Residencial Vista Parque)`);
    console.log("Contatos, CRM, Financeiro e Contratos inseridos com amarrações dinâmicas!");
    console.log("🚀 ======================================================= 🚀");

  } catch (error) {
    console.error("❌ OCORREU UM ERRO DURANTE O PROVISIONAMENTO:", error.message);
  }
}

runProvisioning();
