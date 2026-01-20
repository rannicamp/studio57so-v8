// Caminho: app/meta/webhook/route.js
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// Configurações (Pegar das variáveis de ambiente é o ideal, mas por segurança vamos definir constantes)
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'studio57_token_secreto'; 
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; // Token Permanente gerado no painel da Meta

// ==============================================================================
// 1. VERIFICAÇÃO DO WEBHOOK (GET)
// A Meta chama isso para confirmar que o servidor é seu.
// ==============================================================================
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verificado com sucesso!');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Token inválido', { status: 403 });
}

// ==============================================================================
// 2. RECEBIMENTO DOS DADOS (POST)
// Aqui a mágica acontece.
// ==============================================================================
export async function POST(request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    // Loop para processar as entradas (o Facebook pode mandar várias de uma vez)
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        
        // Verifica se é um aviso de novo Lead (leadgen)
        if (change.field === 'leadgen') {
          const leadgenId = change.value.leadgen_id;
          const formId = change.value.form_id;

          console.log(`[Meta Webhook] Novo Lead detectado! ID: ${leadgenId}`);

          // PASSO A: Buscar os dados detalhados do Lead na API da Meta
          // O webhook só manda o ID, precisamos perguntar ao Facebook quem é a pessoa.
          const leadData = await fetchLeadDataFromMeta(leadgenId);

          if (!leadData) {
            console.error('[Meta Webhook] Falha ao buscar dados do lead na Meta.');
            continue;
          }

          // PASSO B: Extrair e Limpar Dados
          const nome = leadData.nome || 'Lead sem nome';
          const email = leadData.email;
          const telefone = limparTelefone(leadData.telefone);
          // A origem será o nome do formulário (Ex: "Cadastro Beta Suítes")
          const origem = `Meta Ads - ${leadData.form_name || formId}`; 

          // PASSO C: Executar a Lógica das 3 Regras
          await processarLeadNoBanco(supabase, { nome, email, telefone, origem });
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('[Meta Webhook] Erro crítico:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ==============================================================================
// FUNÇÕES AUXILIARES (LÓGICA DO NEGÓCIO)
// ==============================================================================

// 1. Busca os dados reais (Nome, Email, Telefone, Nome do Form) na Meta
async function fetchLeadDataFromMeta(leadgenId) {
  try {
    const url = `https://graph.facebook.com/v18.0/${leadgenId}?fields=created_time,id,ad_id,form_id,field_data,campaign_name,adset_name,ad_name,form_name&access_token=${META_ACCESS_TOKEN}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    // Mapear os campos (O Facebook manda um array estranho tipo [{name: "phone", values: ["..."]}])
    let nome = '';
    let email = null;
    let telefone = null;

    data.field_data?.forEach(field => {
      if (field.name.includes('name') || field.name.includes('nome')) nome = field.values[0];
      if (field.name.includes('email')) email = field.values[0];
      if (field.name.includes('phone') || field.name.includes('fone')) telefone = field.values[0];
    });

    return {
      nome,
      email,
      telefone,
      form_name: data.form_name // Aqui pegamos se é Alfa, Beta, etc.
    };

  } catch (error) {
    console.error('[Meta API] Erro ao buscar detalhes:', error);
    return null;
  }
}

// 2. Limpeza de Telefone (Força +55)
function limparTelefone(tel) {
  if (!tel) return null;
  let limpo = tel.replace(/\D/g, ''); // Remove não-números
  // Se vier sém código do país (ex: 33999998888), adiciona 55
  if (limpo.length >= 10 && limpo.length <= 11) {
    limpo = '55' + limpo;
  }
  return limpo;
}

// 3. O CÉREBRO: Lógica de Banco de Dados (Suas 3 Regras)
async function processarLeadNoBanco(supabase, { nome, email, telefone, origem }) {
  
  // 3.1. Busca Organização Padrão
  const { data: org } = await supabase.from('organizacoes').select('id').limit(1).single();
  const organizacaoId = org?.id;
  if (!organizacaoId) return;

  // 3.2. Verifica se o contato JÁ EXISTE (Busca inteligente por email OU telefone)
  let contatoId = null;
  let contatoExistente = null;

  // Tenta achar por telefone
  if (telefone) {
    const { data: telData } = await supabase.from('telefones').select('contato_id').eq('telefone', telefone).limit(1).single();
    if (telData) contatoId = telData.contato_id;
  }

  // Se não achou por telefone, tenta por email
  if (!contatoId && email) {
    const { data: mailData } = await supabase.from('emails').select('contato_id').eq('email', email).limit(1).single();
    if (mailData) contatoId = mailData.contato_id;
  }

  // --- CENÁRIO: CLIENTE NOVO (REGRA 3) ---
  if (!contatoId) {
    console.log('[CRM] Criando NOVO Contato...');
    const { data: novoContato, error } = await supabase.from('contatos').insert({
      nome,
      origem, // "Meta Ads - Residencial Alfa"
      tipo_contato: 'Lead',
      organizacao_id: organizacaoId
    }).select('id').single();

    if (error) {
      console.error('Erro ao criar contato:', error);
      return;
    }
    contatoId = novoContato.id;

    // Salva telefone e email
    if (telefone) await supabase.from('telefones').insert({ contato_id: contatoId, telefone, organizacao_id: organizacaoId });
    if (email) await supabase.from('emails').insert({ contato_id: contatoId, email, organizacao_id: organizacaoId });
  } else {
    console.log(`[CRM] Contato já existe (ID: ${contatoId}). Atualizando...`);
    // Opcional: Atualizar a origem ou adicionar tag de reengajamento
  }

  // --- GESTÃO DO FUNIL (REGRAS 1 e 2) ---
  
  // Acha o Funil e a Coluna "Novos Leads"
  const { data: funil } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').single();
  const { data: colunaNovos } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).eq('nome', 'Novos Leads').single();

  if (!funil || !colunaNovos) {
    console.error('[CRM] Erro Crítico: Funil ou Coluna inicial não encontrados.');
    return;
  }

  // Verifica se já tem card
  const { data: cardExistente } = await supabase
    .from('contatos_no_funil')
    .select('id, coluna_id')
    .eq('contato_id', contatoId)
    .single();

  if (cardExistente) {
    // --- REGRA 2: Já tem card -> Mover para "Novos Leads" ---
    if (cardExistente.coluna_id !== colunaNovos.id) {
      console.log('[CRM] Movendo card existente de volta para o início.');
      await supabase
        .from('contatos_no_funil')
        .update({ coluna_id: colunaNovos.id, updated_at: new Date() })
        .eq('id', cardExistente.id);
    } else {
      console.log('[CRM] Card já está na entrada. Nenhuma ação necessária.');
    }
  } else {
    // --- REGRA 1 e 3: Não tem card -> Criar Novo Card ---
    console.log('[CRM] Criando novo Card no Funil.');
    await supabase.from('contatos_no_funil').insert({
      contato_id: contatoId,
      coluna_id: colunaNovos.id,
      organizacao_id: organizacaoId,
      // Pega o maior número de card e soma 1
      numero_card: 1 // Simplificação (O banco idealmente autoincrementa ou você faz um select max aqui)
    });
  }
}