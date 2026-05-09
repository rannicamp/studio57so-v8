import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createContact } from '@/lib/googleContacts';
import { updateGoogleTokens } from '@/lib/googleCalendar'; // Reutilizamos a função de atualizar token

// Usando service role para ignorar RLS e ler qualquer token necessário no teste
const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

export async function GET(request) {
  try {
    const supabase = createAdminClient();

    // 1. Pega a integração de contatos (idealmente seria vinculada ao usuário logado, 
    // mas para o teste pegamos a mais recente do tipo 'contatos')
    const { data: integracoes } = await supabase.from('integracoes_google')
        .select('*')
        .eq('tipo_conexao', 'contatos')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (!integracoes || integracoes.length === 0) {
      return NextResponse.json({ 
        error: 'Nenhuma integração de contatos encontrada. Conecte sua conta primeiro na central de integrações.' 
      }, { status: 400 });
    }

    const integracao = integracoes[0];

    // 2. Dispara a criação do contato de teste
    const testContactData = {
      nome: 'Lead Teste',
      telefone: '+55 11 99999-9999',
      email: 'leadteste@elo57.com.br',
      empresa: 'Studio 57',
      sufixo: ' - Elo 57'
    };

    const result = await createContact({
      accessToken: integracao.access_token,
      refreshToken: integracao.refresh_token,
      contatoData: testContactData
    });

    // Em um cenário real, se a função falhasse por token expirado, 
    // a googleapis tentaria renovar (se tiver refresh_token).
    // Opcionalmente podemos usar o catch para forçar a renovação manual, mas a googleapis + setCredentials costuma gerenciar isso se configurado.

    return NextResponse.json({
      success: true,
      message: 'Contato criado com sucesso na agenda do Google!',
      resourceName: result.resourceName, // ID interno do contato no Google
      contato: testContactData
    });

  } catch (error) {
    console.error('Erro no test-contatos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
