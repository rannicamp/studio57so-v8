// app/cadastro/actions.js

'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function signUpAction(formData) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const organizacao = formData.get('organizacao');
  const nome = formData.get('nome');
  const email = formData.get('email');
  const password = formData.get('password');

  // 1. Criar a Organização primeiro
  const { data: orgData, error: orgError } = await supabase
    .from('organizacoes')
    .insert([{ nome: organizacao }])
    .select('id')
    .single();

  if (orgError) {
    return { error: { message: 'Não foi possível criar a organização. ' + orgError.message } };
  }

  const organizacaoId = orgData.id;

  // 2. Criar o usuário, passando os dados extras para o nosso gatilho
  // REMOVEMOS A CRIAÇÃO DA FUNÇÃO DAQUI. O gatilho vai cuidar de tudo.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: nome,
        organizacao_id: organizacaoId,
        // O funcao_id não é mais enviado daqui
      },
    },
  });

  if (error) {
    // Se deu erro no cadastro, apaga a organização que acabamos de criar.
    await supabase.from('organizacoes').delete().eq('id', organizacaoId);
    return { error };
  }

  return { data };
}