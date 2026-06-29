// scratch/testar_enriquecimento.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CONTATO_ID = 6170;

async function run() {
  console.log("=== SIMULANDO ENRIQUECIMENTO CADASTRAL COM CORREÇÃO BOLEANA E NUMÉRICA ===");

  // 1. Buscar o contato completo
  const { data: contatoInfo, error: errC } = await supabase
    .from('contatos')
    .select('*')
    .eq('id', CONTATO_ID)
    .single();

  if (errC) {
    console.error("Erro ao buscar contato:", errC.message);
    return;
  }

  console.log("Nome Atual no Banco:", contatoInfo.nome);

  // 2. Extrair dados_cliente que a IA enviou
  const parsedResult = {
    dados_cliente: {
      nome: "Maria",
      objetivo: "MORADIA",
      profissao: "Contratada",
      composicao_familiar: null,
      perfil_investidor: null,
      renda_familiar: "R$ 7.000,00",
      possui_fgts: "NÃO",
      mais_de_3_anos_clt: "SIM",
      cidade_atual: "Governador Valadares"
    }
  };

  const dc = parsedResult.dados_cliente;
  const currentContact = contatoInfo;

  if (currentContact) {
    const updateData = {};

    // REGRA DE NOME COMPLETO DO PRODUTO (IDÊNTICA AO PROCESSOR.JS)
    if (dc.nome && typeof dc.nome === 'string' && dc.nome.trim().length > 0) {
      const nomeDetectado = dc.nome.trim();
      const nomeAtual = (currentContact.nome || '').trim();
      const palavrasNovas = nomeDetectado.split(/\s+/).length;
      const palavrasAtuais = nomeAtual.split(/\s+/).length;

      const isGenericName = nomeAtual === '' || nomeAtual.toLowerCase().includes('lead') || /^\+?\d+$/.test(nomeAtual.replace(/[\s()+-]/g, ''));

      if (isGenericName || (palavrasNovas > palavrasAtuais && nomeDetectado.toLowerCase().includes(nomeAtual.split(/\s+/)[0].toLowerCase()))) {
        updateData.nome = nomeDetectado;
      }
    }

    const converterParaBooleano = (val) => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'boolean') return val;
      const s = String(val).trim().toLowerCase();
      if (s === 'sim' || s === 'true' || s === 's' || s === '1') return true;
      if (s === 'não' || s === 'nao' || s === 'false' || s === 'n' || s === '0') return false;
      return null;
    };

    const converterParaNumerico = (val) => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'number') return val;
      
      let cleanVal = String(val)
        .replace(/R\$/g, '')
        .replace(/\s/g, '')
        .trim();
        
      if (cleanVal === '') return null;
      
      // Tratamento de formato brasileiro: 7.000,00 -> remove pontos, troca vírgula por ponto
      if (cleanVal.includes(',') && cleanVal.includes('.')) {
        cleanVal = cleanVal.replace(/\./g, '').replace(/,/g, '.');
      } 
      // Se contiver apenas vírgula como decimal: 7000,00 -> troca por ponto
      else if (cleanVal.includes(',') && !cleanVal.includes('.')) {
        cleanVal = cleanVal.replace(/,/g, '.');
      }
      
      const num = parseFloat(cleanVal);
      return isNaN(num) ? null : num;
    };

    const atualizarSeDiferente = (field, value) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        const currentValue = currentContact[field];
        if (currentValue === null || currentValue === undefined || String(currentValue).trim().toLowerCase() !== String(value).trim().toLowerCase()) {
          updateData[field] = value;
        }
      }
    };

    atualizarSeDiferente('cargo', dc.profissao);
    atualizarSeDiferente('estado_civil', dc.composicao_familiar);
    
    // Renda Familiar Limpa (numérica)
    atualizarSeDiferente('renda_familiar', converterParaNumerico(dc.renda_familiar));
    
    // Booleanos
    atualizarSeDiferente('fgts', converterParaBooleano(dc.possui_fgts));
    atualizarSeDiferente('mais_de_3_anos_clt', converterParaBooleano(dc.mais_de_3_anos_clt));
    
    atualizarSeDiferente('city', dc.cidade_atual);

    if (dc.objetivo && ['MORADIA', 'INVESTIMENTO', 'LAZER'].includes(dc.objetivo.trim().toUpperCase())) {
      updateData.objetivo = dc.objetivo.trim().toUpperCase();
    }

    console.log(`\nPayload de Atualização corrigido:`, updateData);

    if (Object.keys(updateData).length > 0) {
      console.log("\nExecutando update no banco de dados...");
      const { data, error } = await supabase
        .from('contatos')
        .update(updateData)
        .eq('id', CONTATO_ID)
        .select();

      if (error) {
        console.error("Erro ao fazer update no banco:", error.message);
      } else {
        console.log("Update realizado com sucesso absoluto no banco de dados!");
        console.log("Contato atualizado:", data[0].nome, "- Cidade:", data[0].city, "- Renda:", data[0].renda_familiar, "- CLT:", data[0].mais_de_3_anos_clt);
      }
    } else {
      console.log("\nNenhum campo para atualizar!");
    }
  }
}

run().catch(console.error);
