// Caminho: app/(landingpages)/_actions/leadActions.js
'use server';

// MUDANÇA: Importamos 'createClient' do pacote JS puro para usar a chave mestra
import { createClient } from '@supabase/supabase-js'; 
import { redirect } from 'next/navigation';
import { sendMetaEvent } from '../../../utils/metaCapi';

/**
 * Função Universal para Salvar Leads + API de Conversões do Facebook
 * AGORA COM BYPASS DE RLS (SEGURANÇA)
 */
export async function processarLeadUniversal(formData, redirectUrl, origemPadrao) {
  
  // 1. CRIANDO O CLIENTE COM SUPERPODERES (SERVICE ROLE)
  // Isso permite gravar no banco mesmo que o usuário não esteja logado
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY, 
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // 2. Coleta e Limpeza de Dados
  const nome = formData.get('nome');
  const email = formData.get('email');
  const rawPhone = formData.get('telefone');
  const origem = formData.get('origem') || origemPadrao || 'Landing Page - Genérica';

  // Limpeza do Telefone (Padrão +55)
  let telefone = null;
  if (rawPhone) {
    let limpo = rawPhone.replace(/\D/g, ''); 
    if (limpo.length >= 10 && limpo.length <= 11) {
      limpo = '55' + limpo; 
    }
    telefone = limpo;
  }

  try {
    // 3. Busca a organização padrão
    const { data: orgData, error: orgError } = await supabase
      .from('organizacoes')
      .select('id')
      .limit(1)
      .single();

    if (orgError || !orgData) throw new Error('Nenhuma organização padrão encontrada.');
    const organizacaoId = orgData.id;

    // 4. INVESTIGAÇÃO (Deduplicação)
    let contatoId = null;

    if (telefone) {
      const { data: telData } = await supabase
        .from('telefones')
        .select('contato_id')
        .eq('telefone', telefone)
        .limit(1)
        .single();
      if (telData) contatoId = telData.contato_id;
    }

    if (!contatoId && email) {
      const { data: mailData } = await supabase
        .from('emails')
        .select('contato_id')
        .eq('email', email)
        .limit(1)
        .single();
      if (mailData) contatoId = mailData.contato_id;
    }

    // 5. TOMADA DE DECISÃO: CRIAR OU ATUALIZAR
    if (!contatoId) {
      // --- NOVO LEAD ---
      console.log(`[LeadActions] Novo Lead detectado: ${nome}`);
      
      const { data: novoContato, error: contatoError } = await supabase
        .from('contatos')
        .insert({
          nome: nome,
          origem: origem,
          tipo_contato: 'Lead',
          personalidade_juridica: 'Pessoa Física',
          organizacao_id: organizacaoId,
          status: 'Ativo' // Garantindo status
        })
        .select('id')
        .single();

      if (contatoError) {
        // Log detalhado para te ajudar se der ruim de novo
        console.error('[LeadActions] Erro Supabase:', contatoError);
        throw new Error(`Erro ao salvar contato: ${contatoError.message}`);
      }
      
      contatoId = novoContato.id;

      if (telefone) {
        await supabase.from('telefones').insert({ 
          contato_id: contatoId, 
          telefone: telefone, 
          tipo: 'Celular', 
          organizacao_id: organizacaoId
        });
      }

      if (email) {
        await supabase.from('emails').insert({ 
          contato_id: contatoId, 
          email: email, 
          tipo: 'Principal', 
          organizacao_id: organizacaoId 
        });
      }

      // 🔥 DISPARO DO PIXEL (CAPI)
      await sendMetaEvent('Lead', {
        email: email,
        telefone: telefone,
        primeiro_nome: nome ? nome.split(' ')[0] : undefined,
        sobrenome: nome ? nome.split(' ').slice(1).join(' ') : undefined
      }, {
        content_name: origem, 
        status: 'Novo'
      });

    } else {
      console.log(`[LeadActions] Lead recorrente identificado (ID: ${contatoId}).`);
      
      await sendMetaEvent('Contact', {
        email: email,
        telefone: telefone,
      }, {
        content_name: origem
      });
    }

    // 6. GESTÃO DO FUNIL (Usando a lógica de ID FIXO que criamos)
    const funilId = await ensureFunilExists(supabase, organizacaoId);
    const colunaId = await getEntradaColumnId(supabase, funilId, organizacaoId);

    const { data: cardExistente } = await supabase
      .from('contatos_no_funil')
      .select('id, coluna_id')
      .eq('contato_id', contatoId)
      .single();

    if (cardExistente) {
      if (cardExistente.coluna_id !== colunaId) {
        await supabase
          .from('contatos_no_funil')
          .update({ 
            coluna_id: colunaId, 
            updated_at: new Date() 
          })
          .eq('id', cardExistente.id);
      }
    } else {
      await supabase.from('contatos_no_funil').insert({
        contato_id: contatoId,
        coluna_id: colunaId,
        organizacao_id: organizacaoId,
        numero_card: 1 
      });
    }

  } catch (error) {
    console.error('[LeadActions] Erro crítico:', error.message);
    // Em produção, talvez você não queira travar o redirect se der erro de log,
    // mas por enquanto vamos deixar assim para debugging.
  }

  redirect(redirectUrl);
}

// --- FUNÇÕES AUXILIARES ---

async function ensureFunilExists(supabase, organizacaoId) {
  const FUNIL_ID_FIXO = 'c0dd9026-6ede-4789-a77e-ec0e7fe8fa66';

  let { data: funil } = await supabase
    .from('funis')
    .select('id')
    .eq('id', FUNIL_ID_FIXO)
    .single();

  if (!funil) {
    const { data: funilPorNome } = await supabase
      .from('funis')
      .select('id')
      .eq('nome', 'Funil de Vendas')
      .eq('organizacao_id', organizacaoId)
      .single();
      
    if (funilPorNome) return funilPorNome.id;

    const { data: newFunil } = await supabase
      .from('funis')
      .insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId })
      .select('id')
      .single();
    funil = newFunil;
  }
  return funil.id;
}

async function getEntradaColumnId(supabase, funilId, organizacaoId) {
  const ID_COLUNA_ENTRADA = 'e8e88027-c7be-4e8c-9667-e17fa4e06ce5';

  let { data: coluna } = await supabase
    .from('colunas_funil')
    .select('id')
    .eq('id', ID_COLUNA_ENTRADA)
    .single();

  if (coluna) return coluna.id;

  const { data: colunaPorNome } = await supabase
    .from('colunas_funil')
    .select('id')
    .eq('funil_id', funilId)
    .eq('nome', 'ENTRADA')
    .single();

  if (colunaPorNome) return colunaPorNome.id;

  const { data: newColuna } = await supabase
    .from('colunas_funil')
    .insert({ 
      funil_id: funilId, 
      nome: 'ENTRADA', 
      ordem: 0, 
      organizacao_id: organizacaoId,
      cor: 'bg-gray-100' 
    })
    .select('id')
    .single();
    
  return newColuna.id;
}