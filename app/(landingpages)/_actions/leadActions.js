// Caminho: app/(landingpages)/_actions/leadActions.js
'use server';

// Usamos o cliente com Service Role (Crachá Mestre) para ignorar o RLS
import { createClient } from '@supabase/supabase-js'; 
import { redirect } from 'next/navigation';
import { sendMetaEvent } from '../../../utils/metaCapi';

/**
 * Função Universal para Salvar Leads + API de Conversões do Facebook
 * VERSÃO FINAL: Grava dados financeiros nas colunas específicas do banco
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

  // 2. Coleta de Dados Básicos
  const nome = formData.get('nome');
  const email = formData.get('email');
  const origem = formData.get('origem') || origemPadrao || 'Landing Page - Genérica';
  
  // --- TRATAMENTO DE DADOS FINANCEIROS (CAIXA) ---
  const rawRenda = formData.get('renda');
  let rendaFamiliar = null;
  let fgts = false;
  let maisDe3AnosClt = false;
  let isFinancialForm = false; // Flag para saber se atualizamos esses dados

  // Se o campo 'renda' veio no formulário, tratamos como um Lead Financeiro
  if (rawRenda) {
      isFinancialForm = true;
      
      // Formata Renda: "5.000,00" -> 5000.00 (Formato aceito pelo numeric do Postgres)
      const cleanRenda = rawRenda.toString().replace(/\./g, '').replace(',', '.');
      const parsedRenda = parseFloat(cleanRenda);
      if (!isNaN(parsedRenda)) {
          rendaFamiliar = parsedRenda;
      }

      // Checkboxes: Se vierem no formData, é true.
      fgts = formData.get('fgts') ? true : false;
      maisDe3AnosClt = formData.get('tempo_trabalho') ? true : false;
  }
  
  // --- LÓGICA DE TELEFONE INTERNACIONAL ---
  const rawPhone = formData.get('telefone');
  const rawCountryCode = formData.get('country_code') || '+55';

  // Limpeza
  const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : '';
  let cleanCountryCode = rawCountryCode.trim();
  if (!cleanCountryCode.startsWith('+')) {
    cleanCountryCode = '+' + cleanCountryCode.replace(/\D/g, '');
  }

  let telefoneCompleto = null;
  if (cleanPhone) {
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
        .eq('telefone', telefoneCompleto)
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

    // 5. TOMADA DE DECISÃO (Insert ou Update)
    if (!contatoId) {
      // --- NOVO LEAD ---
      console.log(`[LeadActions] Novo Lead: ${nome}`);
      
      const insertData = {
          nome: nome,
          origem: origem,
          tipo_contato: 'Lead',
          personalidade_juridica: 'Pessoa Física',
          organizacao_id: organizacaoId,
          status: 'Ativo'
      };

      // Se for formulário financeiro, adiciona os dados nas colunas específicas
      if (isFinancialForm) {
          insertData.renda_familiar = rendaFamiliar;
          insertData.fgts = fgts;
          insertData.mais_de_3_anos_clt = maisDe3AnosClt;
      }
      
      const { data: novoContato, error: contatoError } = await supabase
        .from('contatos')
        .insert(insertData)
        .select('id')
        .single();

      if (contatoError) throw new Error(`Erro ao salvar contato: ${contatoError.message}`);
      contatoId = novoContato.id;

      // Salva Telefone
      if (telefoneCompleto) {
        await supabase.from('telefones').insert({ 
          contato_id: contatoId, 
          telefone: telefoneCompleto, 
          country_code: cleanCountryCode,
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

      await sendMetaEvent('Lead', {
        email: email,
        telefone: telefoneCompleto,
        primeiro_nome: nome ? nome.split(' ')[0] : undefined,
        sobrenome: nome ? nome.split(' ').slice(1).join(' ') : undefined
      }, {
        content_name: origem, 
        status: 'Novo',
        currency: 'BRL',
        value: rendaFamiliar || 0 // Envia a renda como valor para o pixel (opcional, ajuda o algoritmo)
      });

    } else {
      // --- LEAD RECORRENTE (Update) ---
      console.log(`[LeadActions] Lead recorrente (ID: ${contatoId}). Atualizando dados.`);
      
      const updateData = { updated_at: new Date() };

      // Só atualizamos os campos financeiros se eles vieram nesse formulário
      // Isso evita zerar dados se o cliente preencher um formulário simples depois
      if (isFinancialForm) {
          updateData.renda_familiar = rendaFamiliar;
          updateData.fgts = fgts;
          updateData.mais_de_3_anos_clt = maisDe3AnosClt;
      }

      await supabase
        .from('contatos')
        .update(updateData)
        .eq('id', contatoId);

      await sendMetaEvent('Contact', {
        email: email,
        telefone: telefoneCompleto,
      }, {
        content_name: origem
      });
    }

    // 6. GESTÃO DO FUNIL (Mantida)
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

// --- FUNÇÕES AUXILIARES ---
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