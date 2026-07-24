// Caminho: app/(landingpages)/elo57/actions.js
'use server';

import { processarLeadUniversal } from '../_actions/leadActions';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function salvarLeadElo57(formData) {
  // Chamamos o processador universal de leads forçando a organizacao_id = 2 (Studio 57)
  await processarLeadUniversal(formData, '/elo57/obrigado', 'Landing Page - Elo 57', 2);
}

export async function salvarLeadEventoFiemg(formData) {
  // Chamamos o processador universal de leads forçando a organizacao_id = 2 (Studio 57) com a origem do evento
  await processarLeadUniversal(formData, '/elo57/obrigado', 'Evento FIEMG - Elo 57', 2);
}

export async function buscarPublicacoes() {
  const { data, error } = await supabase
    .from('publicacoes_midia')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error("Erro ao buscar publicacoes:", error);
    return [];
  }
  return data;
}

export async function criarPublicacao(campanha, titulo, slidesData) {
  const { data, error } = await supabase
    .from('publicacoes_midia')
    .insert({
      campanha,
      titulo,
      slides_data: slidesData,
      organizacao_id: 2 // Studio 57 / Elo 57
    })
    .select('*')
    .single();
  if (error) {
    console.error("Erro ao criar publicacao:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function atualizarPublicacao(id, slidesData) {
  const { data, error } = await supabase
    .from('publicacoes_midia')
    .update({ slides_data: slidesData, updated_at: new Date() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error("Erro ao atualizar publicacao:", error);
    throw new Error(error.message);
  }
  return data;
}

