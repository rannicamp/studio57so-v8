import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createContact } from '@/lib/googleContacts';

const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { contato_id, organizacao_id, user_id } = body;

    if (!contato_id) {
      return NextResponse.json({ error: 'contato_id é obrigatório' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Busca os dados completos do contato (Agrupando telefones e emails)
    const { data: contatoData, error: contatoError } = await supabase
      .from('contatos')
      .select(`
        id,
        nome,
        razao_social,
        empresa,
        tipo_contato,
        organizacao_id,
        telefones ( telefone ),
        emails ( email )
      `)
      .eq('id', contato_id)
      .single();

    if (contatoError || !contatoData) {
      return NextResponse.json({ error: 'Contato não encontrado ou erro na busca.' }, { status: 404 });
    }

    // Identificar a organização
    const orgId = organizacao_id || contatoData.organizacao_id;
    if (!orgId) {
       return NextResponse.json({ error: 'organizacao_id não definido no contato.' }, { status: 400 });
    }

    // 2. Prepara os dados formatados para o motor do Google
    const nomeExibicao = contatoData.nome || contatoData.razao_social || 'Sem Nome';
    const telefonePrincipal = contatoData.telefones?.[0]?.telefone || '';
    const emailPrincipal = contatoData.emails?.[0]?.email || '';

    const payloadGoogle = {
      nome: nomeExibicao,
      telefone: telefonePrincipal,
      email: emailPrincipal,
      empresa: contatoData.empresa || 'Cliente Studio 57',
      tipo_contato: contatoData.tipo_contato // Ex: 'Lead', 'Fornecedor', 'Corretor'
    };

    // 3. Buscar integrações ativas de CONTATOS
    let query = supabase
      .from('integracoes_google')
      .select('*')
      .eq('tipo_conexao', 'contatos')
      .eq('is_active', true)
      .eq('organizacao_id', orgId);

    // Se passou um user_id específico, sincroniza só pra ele. Se não, sincroniza pra todos da Org que conectaram!
    if (user_id) {
       query = query.eq('user_id', user_id);
    }

    const { data: integracoes } = await query;

    if (!integracoes || integracoes.length === 0) {
      return NextResponse.json({ message: 'Nenhuma integração de contatos ativa encontrada para sincronizar.' });
    }

    const results = [];

    // 4. Injeta o contato na agenda de todas as contas conectadas elegíveis
    for (const integracao of integracoes) {
      try {
        const result = await createContact({
          accessToken: integracao.access_token,
          refreshToken: integracao.refresh_token,
          contatoData: payloadGoogle
        });
        results.push({ user_id: integracao.user_id, status: 'success', resource: result.resourceName });
      } catch (err) {
        console.error(`Erro ao sincronizar contato ${contato_id} para usuário ${integracao.user_id}:`, err);
        results.push({ user_id: integracao.user_id, status: 'error', error: err.message });
      }
    }

    return NextResponse.json({ success: true, message: 'Processo de sincronização finalizado.', results });

  } catch (error) {
    console.error('Erro na API de sync de contatos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
