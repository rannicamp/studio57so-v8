// Caminho: app/(landingpages)/_actions/leadActions.js
'use server';

// Usamos o cliente com Service Role (Crachá Mestre) para ignorar o RLS
import { createClient } from '@supabase/supabase-js'; 
import { redirect } from 'next/navigation';
import { sendMetaEvent } from '../../../utils/metaCapi';

/**
 * Função Universal para Salvar Leads + API de Conversões do Facebook
 * PADRÃO NOVO: Suporte a múltiplos países (BR/US)
 */
export async function processarLeadUniversal(formData, redirectUrl, origemPadrao) {
  
  // 1. Conexão Mestre (Service Role)
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

  // 2. Coleta de Dados
  const nome = formData.get('nome');
  const email = formData.get('email');
  const origem = formData.get('origem') || origemPadrao || 'Landing Page - Genérica';
  
  // --- LÓGICA DE TELEFONE INTERNACIONAL ---
  const rawPhone = formData.get('telefone');
  const rawCountryCode = formData.get('country_code') || '+55'; // Padrão +55 se não vier nada

  // Limpeza (Remove tudo que não for número)
  const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : '';
  
  // Limpeza do Código do País (Garante formato "+55")
  let cleanCountryCode = rawCountryCode.trim();
  if (!cleanCountryCode.startsWith('+')) {
    cleanCountryCode = '+' + cleanCountryCode.replace(/\D/g, '');
  }

  // Montagem do Número Completo para o Banco (Regra: DDI + DDD + Numero, sem o +)
  // Ex BR: 55 + 33 + 999999999 = 5533999999999
  // Ex US: 1 + 555 + 1234567 = 15551234567
  let telefoneCompleto = null;
  
  if (cleanPhone) {
    // Removemos o "+" do código do país para concatenar
    const ddiSemMais = cleanCountryCode.replace('+', '');
    telefoneCompleto = ddiSemMais + cleanPhone;
  }

  try {
    // 3. Busca organização padrão
    const { data: orgData, error: orgError } = await supabase
      .from('organizacoes')
      .select('id')
      .limit(1)
      .single();

    if (orgError || !orgData) throw new Error('Nenhuma organização padrão encontrada.');
    const organizacaoId = orgData.id;

    // 4. INVESTIGAÇÃO (Deduplicação)
    let contatoId = null;

    if (telefoneCompleto) {
      const { data: telData } = await supabase
        .from('telefones')
        .select('contato_id')
        .eq('telefone', telefoneCompleto) // Busca pelo número completo formatado
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

    // 5. TOMADA DE DECISÃO
    if (!contatoId) {
      // --- NOVO LEAD ---
      console.log(`[LeadActions] Novo Lead: ${nome} (${cleanCountryCode} ${cleanPhone})`);
      
      const { data: novoContato, error: contatoError } = await supabase
        .from('contatos')
        .insert({
          nome: nome,
          origem: origem,
          tipo_contato: 'Lead',
          personalidade_juridica: 'Pessoa Física',
          organizacao_id: organizacaoId,
          status: 'Ativo'
        })
        .select('id')
        .single();

      if (contatoError) throw new Error(`Erro ao salvar contato: ${contatoError.message}`);
      contatoId = novoContato.id;

      // Salva Telefone com Country Code separado
      if (telefoneCompleto) {
        await supabase.from('telefones').insert({ 
          contato_id: contatoId, 
          telefone: telefoneCompleto, // Número cheio para WhatsApp
          country_code: cleanCountryCode, // +55 ou +1 separado para estatística
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

      // 🔥 Pixel Meta
      await sendMetaEvent('Lead', {
        email: email,
        telefone: telefoneCompleto, // Envia o número completo para matching
        primeiro_nome: nome ? nome.split(' ')[0] : undefined,
        sobrenome: nome ? nome.split(' ').slice(1).join(' ') : undefined
      }, {
        content_name: origem, 
        status: 'Novo'
      });

    } else {
      console.log(`[LeadActions] Lead recorrente (ID: ${contatoId}).`);
      await sendMetaEvent('Contact', {
        email: email,
        telefone: telefoneCompleto,
      }, {
        content_name: origem
      });
    }

    // 6. GESTÃO DO FUNIL (ID Fixo)
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
          .update({ coluna_id: colunaId, updated_at: new Date() })
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
  }

  redirect(redirectUrl);
}

// --- FUNÇÕES AUXILIARES (Mantidas da versão anterior) ---
async function ensureFunilExists(supabase, organizacaoId) {
  const FUNIL_ID_FIXO = 'c0dd9026-6ede-4789-a77e-ec0e7fe8fa66';
  let { data: funil } = await supabase.from('funis').select('id').eq('id', FUNIL_ID_FIXO).single();
  
  if (!funil) {
    const { data: funilPorNome } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').eq('organizacao_id', organizacaoId).single();
    if (funilPorNome) return funilPorNome.id;
    const { data: newFunil } = await supabase.from('funis').insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId }).select('id').single();
    funil = newFunil;
  }
  return funil.id;
}

async function getEntradaColumnId(supabase, funilId, organizacaoId) {
  const ID_COLUNA_ENTRADA = 'e8e88027-c7be-4e8c-9667-e17fa4e06ce5';
  let { data: coluna } = await supabase.from('colunas_funil').select('id').eq('id', ID_COLUNA_ENTRADA).single();
  if (coluna) return coluna.id;
  const { data: colunaPorNome } = await supabase.from('colunas_funil').select('id').eq('funil_id', funilId).eq('nome', 'ENTRADA').single();
  if (colunaPorNome) return colunaPorNome.id;
  const { data: newColuna } = await supabase.from('colunas_funil').insert({ funil_id: funilId, nome: 'ENTRADA', ordem: 0, organizacao_id: organizacaoId, cor: 'bg-gray-100' }).select('id').single();
  return newColuna.id;
}