// Caminho: app/(landingpages)/_actions/leadActions.js
'use server';

import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Função Universal para Salvar Leads.
 * AGORA BLINDADA: Evita duplicatas e move leads antigos para o topo.
 */
export async function processarLeadUniversal(formData, redirectUrl, origemPadrao) {
  const supabase = await createClient();
  
  // 1. Coleta e Limpeza de Dados
  const nome = formData.get('nome');
  const email = formData.get('email');
  const rawPhone = formData.get('telefone');
  // Usa a origem do formulário OU a padrão passada na chamada
  const origem = formData.get('origem') || origemPadrao || 'Landing Page - Genérica';

  // Limpeza do Telefone (Padrão +55)
  let telefone = null;
  if (rawPhone) {
    let limpo = rawPhone.replace(/\D/g, ''); // Remove tudo que não é número
    // Se tiver 10 ou 11 dígitos (ex: 33999998888), adiciona o 55
    if (limpo.length >= 10 && limpo.length <= 11) {
      limpo = '55' + limpo; 
    }
    telefone = limpo;
  }

  try {
    // 2. Busca a organização padrão
    const { data: orgData, error: orgError } = await supabase
      .from('organizacoes')
      .select('id')
      .limit(1)
      .single();

    if (orgError || !orgData) throw new Error('Nenhuma organização padrão encontrada.');
    const organizacaoId = orgData.id;

    // 3. INVESTIGAÇÃO (Deduplicação)
    // Vamos descobrir se esse lead já existe antes de tentar criar
    let contatoId = null;

    // Tenta achar por telefone
    if (telefone) {
      const { data: telData } = await supabase
        .from('telefones')
        .select('contato_id')
        .eq('telefone', telefone)
        .limit(1)
        .single();
      if (telData) contatoId = telData.contato_id;
    }

    // Se não achou por telefone, tenta por email
    if (!contatoId && email) {
      const { data: mailData } = await supabase
        .from('emails')
        .select('contato_id')
        .eq('email', email)
        .limit(1)
        .single();
      if (mailData) contatoId = mailData.contato_id;
    }

    // 4. TOMADA DE DECISÃO: CRIAR OU ATUALIZAR
    if (!contatoId) {
      // --- CENÁRIO: É um NOVO Lead ---
      console.log(`[LeadActions] Novo Lead detectado: ${nome}`);
      
      const { data: novoContato, error: contatoError } = await supabase
        .from('contatos')
        .insert({
          nome: nome,
          origem: origem,
          tipo_contato: 'Lead',
          personalidade_juridica: 'Pessoa Física',
          organizacao_id: organizacaoId
        })
        .select('id')
        .single();

      if (contatoError) throw new Error(`Erro ao salvar contato: ${contatoError.message}`);
      contatoId = novoContato.id;

      // Salva Telefone
      if (telefone) {
        await supabase.from('telefones').insert({ 
          contato_id: contatoId, 
          telefone: telefone, 
          tipo: 'Celular', 
          organizacao_id: organizacaoId
        });
      }

      // Salva Email
      if (email) {
        await supabase.from('emails').insert({ 
          contato_id: contatoId, 
          email: email, 
          tipo: 'Principal', 
          organizacao_id: organizacaoId 
        });
      }

    } else {
      // --- CENÁRIO: É um Lead RECORRENTE ---
      console.log(`[LeadActions] Lead recorrente identificado (ID: ${contatoId}). Atualizando...`);
      // Opcional: Atualizar origem ou data de interação aqui se quiser
    }

    // 5. GESTÃO DO FUNIL (A Mágica do Card) 🎩✨
    // Garante funil e coluna
    const funilId = await ensureFunilExists(supabase, organizacaoId);
    const colunaId = await ensureFirstColumnExists(supabase, funilId, organizacaoId);

    // Verifica se já existe Card para este contato
    const { data: cardExistente } = await supabase
      .from('contatos_no_funil')
      .select('id, coluna_id')
      .eq('contato_id', contatoId)
      .single();

    if (cardExistente) {
      // REGRA: Se já tem card, move de volta para o início ("Novos Leads")
      if (cardExistente.coluna_id !== colunaId) {
        console.log('[LeadActions] Movendo card existente para o topo do funil.');
        await supabase
          .from('contatos_no_funil')
          .update({ 
            coluna_id: colunaId, 
            updated_at: new Date() // Atualiza data para subir na ordem
          })
          .eq('id', cardExistente.id);
      }
    } else {
      // REGRA: Se não tem card, cria um novo
      console.log('[LeadActions] Criando novo card no funil.');
      await supabase.from('contatos_no_funil').insert({
        contato_id: contatoId,
        coluna_id: colunaId,
        organizacao_id: organizacaoId,
        numero_card: 1 // Placeholder, o ideal seria calcular o próximo
      });
    }

  } catch (error) {
    console.error('[LeadActions] Erro crítico:', error.message);
    // Mantemos o fluxo para redirecionar o usuário mesmo se der erro no log interno
  }

  // 6. Redirecionamento Final
  redirect(redirectUrl);
}

// --- FUNÇÕES AUXILIARES (Separadas para ficar limpo) ---

async function ensureFunilExists(supabase, organizacaoId) {
  let { data: funil } = await supabase
    .from('funis')
    .select('id')
    .eq('nome', 'Funil de Vendas')
    .eq('organizacao_id', organizacaoId)
    .single();

  if (!funil) {
    const { data: newFunil } = await supabase
      .from('funis')
      .insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId })
      .select('id')
      .single();
    funil = newFunil;
  }
  return funil.id;
}

async function ensureFirstColumnExists(supabase, funilId, organizacaoId) {
  let { data: coluna } = await supabase
    .from('colunas_funil')
    .select('id')
    .eq('funil_id', funilId)
    .eq('nome', 'Novos Leads')
    .single();

  if (!coluna) {
    const { data: newColuna } = await supabase
      .from('colunas_funil')
      .insert({ funil_id: funilId, nome: 'Novos Leads', ordem: 0, organizacao_id: organizacaoId })
      .select('id')
      .single();
    coluna = newColuna;
  }
  return coluna.id;
}