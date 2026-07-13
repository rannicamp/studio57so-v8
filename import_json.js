const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Client } = require('pg');
const crypto = require('crypto');

const ELO_MCP_URL = 'http://localhost:3000/api/mcp';
const TOKEN = 'elo57_usr_key_f6858678bbb6946ac8a7795a3218f47d7a0b250af4c84209';
const PG_CONN = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';

async function callMcpTool(methodName, args) {
  try {
    const payload = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: methodName,
        arguments: args
      },
      id: Date.now()
    };
    const res = await axios.post(ELO_MCP_URL, payload, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    if (res.data.error) {
      throw new Error(JSON.stringify(res.data.error));
    }
    const content = res.data.result.content;
    const textContent = content.find(c => c.type === 'text');
    return JSON.parse(textContent.text);
  } catch (err) {
    console.error(`Erro ao chamar ferramenta ${methodName}:`, err.message);
    throw err;
  }
}

async function runCleanup() {
  console.log('🧹 Limpando lançamentos e contas anteriores para Org 12...');
  const pgClient = new Client({
    connectionString: PG_CONN,
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();
  
  const delLanc = await pgClient.query('DELETE FROM public.lancamentos WHERE organizacao_id = 12;');
  console.log(`- Deletados ${delLanc.rowCount} lançamentos antigos.`);
  
  const delFaturas = await pgClient.query('DELETE FROM public.faturas_cartao WHERE organizacao_id = 12;');
  console.log(`- Deletadas ${delFaturas.rowCount} faturas de cartão da Org 12.`);
  
  const delContas = await pgClient.query('DELETE FROM public.contas_financeiras WHERE organizacao_id = 12;');
  console.log(`- Deletadas ${delContas.rowCount} contas antigas.`);
  
  await pgClient.end();
  console.log('✅ Limpeza concluída.');
}

function classificarTransacao(descricao, valorStr, fluxo) {
  const desc = String(descricao).toUpperCase();
  const valor = Math.abs(Number(valorStr));

  // Regras de valor específicas
  if (desc.includes('DÉB.TIT.COMPE EFETIVADO')) {
    if (Math.abs(valor - 215.00) < 0.01) return 'Moradia';
    if (Math.abs(valor - 99.90) < 0.01) return 'Moradia';
    if (Math.abs(valor - 221.37) < 0.01) return 'Moradia';
    if (Math.abs(valor - 102.53) < 0.01) return 'Moradia';
    if (Math.abs(valor - 2510.35) < 0.01) return 'Pagamento de Fatura (Duplicado)';
  }

  // Regras gerais
  const regras = {
    'Saúde (Dedutível)': ['UNIMED', 'HOSPITAL', 'CLINICA', 'FARMACIA', 'DROGASIL', 'MEDICO', 'ODONTO', 'PSICOLOG'],
    'Educação (Dedutível)': ['ESCOLA', 'COLEGIO', 'UNIVERSIDADE', 'FACULDADE', 'CURSO', 'MENSALIDADE ESC'],
    'Comissões de Vendas (Receita)': ['SC IMOVEIS'],
    'Pró-Labore (Receita)': ['PRO-LABORE', 'S57 ARQUITETURA', 'CRED.TRANSF.CONTAS INTERCREDIS'],
    'Venda de Bens (Receita)': ['BRASIL MOTOCICLETAS'],
    'Empréstimos Recebidos (Não Tributável)': ['EMPRESTIMO', 'STUDIO 57 INCORPORACOES', 'SONIA MARIA CAMPOS'],
    'Transferências Próprias': ['RANNIERE CAMPOS MENDES', 'RANNIERE CAMPOS MENDES ARQ', 'ASA STUDIO 57 INCORPOR'],
    'Rendimentos (Tributável)': ['SALARIO', 'PAGAMENTO SALARIO', 'PRO LABORE'],
    'Rendimentos (Isento/Nao Tributavel)': ['DIVIDENDOS', 'JCP', 'RENDIMENTO FUNDO', 'RESTITUICAO IR'],
    'Moradia': [
      'ALUGUEL', 'CONDOMINIO', 'ENERGIA', 'AGUA', 'GAS', 'IPTU', 
      '203.046-', '35.160.205 0001-19', 'ZAQUEU PEREIRA DO VALE', 
      'INTERNET', 'CONDOMINIO DO EDIFICIO RESIDENCIAL', '00.312.525/0001-62',
      'IBIPAR S A', '07.729.358/0001-07', 'ECOVILLE'
    ],
    'Supermercado': ['COELHO DINIZ', 'SUPERMERCADO'],
    'Comer Fora e Delivery': [
      'PADARIA', 'AÇOUGUE', 'RESTAURANTE', 'IFD', 'LUNCH', 'LANCHE', 
      'PIZZA', 'GELATO', 'CHURRAS', 'ESPETTOS', 'STEAKHOUSE', 'GOURMET', 
      'PÃO', 'PAO', 'CAFÉ', 'CAFE', 'MCDONALD', '24.996.155 0001-98', 
      'ZAMBEV', 'KI SABOR', 'GILSONPEIXOTO', 'PASTEL CARIOCA', 'RAPIDAO', 
      'BAR E RESTAU', 'GAUCHAO DO FABINHO', 'BRUNA BAT588', 'BRUNA BAT',
      '55333183 GLE', '55.333.183', '40026297 KEV', '40.026.297',
      'MP  LUDMILLA', 'MP LUDMILLA', 'MP*LUDMILLA'
    ],
    'Transporte': [
      'POSTO', 'UBER', '99APP', 'GASOLINA', 'COMBUSTIVEL', 'ESTACIONAMENTO', 
      'PEDAGIO', 'AUTO', 'MOTO', 'CARRO', 'OFICINA', 'MECANICO', 'JC PARK'
    ],
    'Lazer': ['R CAMPOS MEN', 'MINGLE'],
    'Assinaturas': [
      'SPOTIFY', 'NETFLIX', 'PLAYSTATION', 'TINDER', 'AMAZONPRIME', 
      'MELIMAIS', 'DISNEY', 'HBO', 'STREAM', 'YOUTUBE', 'IMUSIC', 
      'APPLE.COM/BILL', 'HOTMART', 'KIWIFY', 'GOOGLE ONE', 'GOOGLE*ONE', 'GOOGLE'
    ],
    'Compras e Variados': [
      'MERCADOLIVRE', 'AMAZON.COM', 'SHOPEE', 'ALIEXPRESS', 'SHEIN', 
      'MAGALU', 'CASAS BAHIA', 'LOJA', 'SHOPPING', 'FARMACIA', 'DROGARIA',
      'AMAZONMKTPLC', 'OBOTICARIO', 'BOTICARIO', 'ESTETICA NUNES'
    ],
    'Juros e Encargos': ['JUROS CHEQUE ESPECIAL', 'CHEQUE ESPECIAL', 'JUROS', 'MULTA'],
    'Impostos e Taxas': ['DÉB.IOF', 'IOF', 'IMPOSTO'],
    'Taxas Bancárias': ['DÉBITO PACOTE SERVIÇOS', 'PACOTE SERVIÇOS', 'TARIFA', 'CESTA'],
    'Seguros': ['DÉB. CONV. SEGUROS', 'SEGURO', 'FUNERARIO'],
    'Abertura de Empresa': ['20.625.141 0001-07'],
    'Doações': ['ESPACO DE SOBRIEDADE E', 'ADQF'],
    'Pagamento de Fatura (Duplicado)': [
      'PAGAMENTO DEBITO EM CONTA', 'DEB.AUT.CARTAO', 'PAGTO FATURA', 
      'PAG CARTAO', 'SICOOB CART', 'DÉB.CONV.DEMAIS EMPRESAS', 
      'BANCO INTER SA', '00.416.968/0001-01'
    ],
    'Investigar': [
      '***.447.056-**', '***.751.346-**', '***.653.766-**', '***.809.376-**',
      'MP*RYAMRAMALHO'
    ]
  };

  for (const [categoria, palavras] of Object.entries(regras)) {
    for (const palavra of palavras) {
      if (palavra === 'AGUA' || palavra === 'GAS' || palavra === 'IPTU') {
        const regex = new RegExp(`\\b${palavra}\\b`, 'i');
        if (regex.test(desc)) return categoria;
      } else if (desc.includes(palavra)) {
        return categoria;
      }
    }
  }

  return 'Outros';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // 1. Limpeza
  await runCleanup();

  console.log('\n=== INICIANDO CRIAÇÃO DE CONTAS E IMPORTAÇÃO COMPLETA 2026 ===');

  // 2. Criar as contas com saldos e configurações corretas
  const sicoobCorrente = await callMcpTool('criar_conta_financeira', {
    nome: 'Sicoob Corrente',
    tipo: 'Conta Corrente',
    saldo_inicial: 15530.89,
    instituicao: 'Sicoob'
  });
  console.log('Conta criada:', sicoobCorrente);

  const sicoobCartao = await callMcpTool('criar_conta_financeira', {
    nome: 'Sicoob Cartão',
    tipo: 'Cartão de Crédito',
    instituicao: 'Sicoob',
    dia_fechamento_fatura: 1,
    dia_pagamento_fatura: 11
  });
  console.log('Conta criada:', sicoobCartao);

  const interCartao = await callMcpTool('criar_conta_financeira', {
    nome: 'Inter Cartão',
    tipo: 'Cartão de Crédito',
    instituicao: 'Banco Inter',
    dia_fechamento_fatura: 29,
    dia_pagamento_fatura: 7
  });
  console.log('Conta criada:', interCartao);

  const dinheiroConta = await callMcpTool('criar_conta_financeira', {
    nome: 'Dinheiro',
    tipo: 'Dinheiro',
    saldo_inicial: 0.00,
    instituicao: 'Dinheiro'
  });
  console.log('Conta criada:', dinheiroConta);

  const accountsMap = {
    'Sicoob Corrente': sicoobCorrente.id,
    'Sicoob Cartão': sicoobCartao.id,
    'Inter Cartão': interCartao.id,
    'Dinheiro': dinheiroConta.id
  };

  // 3. Mapear Categorias
  let existingCats = await callMcpTool('listar_categorias_financeiras', {});
  
  // Garantir categoria "Transferências Próprias" do tipo "Receita"
  let hasTransferReceita = existingCats.some(cat => cat.nome === 'Transferências Próprias' && cat.tipo === 'Receita');
  if (!hasTransferReceita) {
    console.log('Criando categoria "Transferências Próprias" do tipo Receita...');
    await callMcpTool('criar_categoria_financeira', {
      nome: 'Transferências Próprias',
      tipo: 'Receita'
    });
    // Recarregar categorias
    existingCats = await callMcpTool('listar_categorias_financeiras', {});
  }

  const categoryMap = {};
  existingCats.forEach(cat => {
    categoryMap[`${cat.nome}|${cat.tipo}`] = cat.id;
  });
  console.log('Categorias mapeadas do DB:', Object.keys(categoryMap).length);

  // 4. Mapear Contatos CRM
  const contactMap = {};
  console.log('Utilizando busca dinâmica de contatos via CNPJ...');

  // 5. Ler arquivo consolidado de transações
  const jsonPath = path.join(__dirname, 'transactions_to_import.json');
  console.log(`Lendo transações consolidadas de: ${jsonPath}`);
  const txs = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Total de transações a serem inseridas: ${txs.length}`);

  const cnpjRegex = /\b\d{2}\.?\d{3}\.?\d{3}[/\s]?\d{4}[-\s]?\d{2}\b/;
  let count = 0;

  for (const tx of txs) {
    count++;
    const isDespesa = tx.amount < 0;
    const contaId = accountsMap[tx.conta];
    const isCreditCard = tx.conta === 'Sicoob Cartão' || tx.conta === 'Inter Cartão';

    // Lógica especial para saques (saque físico do caixa eletrônico)
    const descUpper = tx.desc.toUpperCase();
    if (tx.conta === 'Sicoob Corrente' && descUpper.includes('SAQUE')) {
      const transferenciaId = crypto.randomUUID();
      const catDespesaId = categoryMap['Transferências Próprias|Despesa'];
      const catReceitaId = categoryMap['Transferências Próprias|Receita'];
      
      // 1. Registrar a saída da conta corrente
      await callMcpTool('lancar_despesa', {
        descricao: `Saque para Dinheiro Vivo - ${tx.desc}`,
        valor: Math.abs(tx.amount),
        data_vencimento: tx.date,
        data_transacao: tx.real_date,
        data_pagamento: tx.date,
        conta_financeira_id: contaId,
        categoria_id: catDespesaId,
        status: 'Pago',
        transferencia_id: transferenciaId
      });

      // 2. Registrar a entrada na conta dinheiro
      await callMcpTool('lancar_receita', {
        descricao: `Recebido de Saque Sicoob - ${tx.desc}`,
        valor: Math.abs(tx.amount),
        data_vencimento: tx.date,
        data_transacao: tx.real_date,
        data_pagamento: tx.date,
        conta_financeira_id: accountsMap['Dinheiro'],
        categoria_id: catReceitaId,
        status: 'Pago',
        transferencia_id: transferenciaId
      });

      continue;
    }

    const catName = classificarTransacao(tx.desc, tx.amount, isDespesa ? 'Despesa' : 'Receita');
    
    let categoriaId = categoryMap[`${catName}|${isDespesa ? 'Despesa' : 'Receita'}`];
    if (!categoriaId) {
      categoriaId = categoryMap[`Outros|${isDespesa ? 'Despesa' : 'Receita'}`];
    }

    const absValor = Math.abs(tx.amount);

    let favorecidoContatoId = null;
    const cnpjMatch = tx.desc.match(cnpjRegex);
    if (cnpjMatch) {
      const cnpjRaw = cnpjMatch[0];
      const cnpjDigits = cnpjRaw.replace(/\D/g, '');
      
      if (contactMap[cnpjDigits]) {
        favorecidoContatoId = contactMap[cnpjDigits];
      } else {
        try {
          const searchRes = await callMcpTool('listar_clientes_crm', { busca: cnpjDigits });
          if (searchRes && searchRes.length > 0) {
            favorecidoContatoId = searchRes[0].id;
            contactMap[cnpjDigits] = favorecidoContatoId;
          }
        } catch (searchErr) {
          console.error(`[CRM] Erro ao buscar contato:`, searchErr.message);
        }

        if (!favorecidoContatoId) {
          try {
            await delay(200);
            const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`);
            const data = response.data;
            const razaoSocial = data.razao_social || data.nome_fantasia || tx.desc;
            const nomeFantasia = data.nome_fantasia || data.razao_social || tx.desc;
            
            const newContact = await callMcpTool('criar_contato_crm', {
              nome: nomeFantasia,
              cnpj: cnpjDigits,
              razao_social: razaoSocial,
              nome_fantasia: nomeFantasia,
              personalidade_juridica: 'Juridica',
              status: 'Ativo'
            });
            
            favorecidoContatoId = newContact.id;
            contactMap[cnpjDigits] = newContact.id;
          } catch (apiErr) {
            console.error(`[CNPJ] Falha ao consultar:`, apiErr.message);
          }
        }
      }
    }

    // Lançar transação com data_transacao
    if (isDespesa) {
      await callMcpTool('lancar_despesa', {
        descricao: tx.desc,
        valor: absValor,
        data_vencimento: tx.date,
        data_transacao: tx.real_date,
        data_pagamento: isCreditCard ? null : tx.date,
        conta_financeira_id: contaId,
        categoria_id: categoriaId,
        status: 'Pago',
        favorecido_contato_id: favorecidoContatoId
      });
    } else {
      await callMcpTool('lancar_receita', {
        descricao: tx.desc,
        valor: absValor,
        data_vencimento: tx.date,
        data_transacao: tx.real_date,
        data_pagamento: tx.date,
        conta_financeira_id: contaId,
        categoria_id: categoriaId,
        status: 'Pago',
        favorecido_contato_id: favorecidoContatoId
      });
    }

    if (count % 50 === 0) {
      console.log(`Processados ${count}/${txs.length} lançamentos...`);
    }
  }

  console.log(`\n=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO! ===`);
  console.log(`Total de lançamentos processados: ${txs.length}`);
}

main().catch(err => {
  console.error('Falha no processo:', err);
  process.exit(1);
});
