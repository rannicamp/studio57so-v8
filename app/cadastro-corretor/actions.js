// app/cadastro-corretor/actions.js
'use server'

// Importa AMBAS as funções do server.js
import { createClient, createAdminClient } from '@/utils/supabase/server' 
import { cookies } from 'next/headers'

// IDs Corretos
const ORGANIZACAO_PADRAO_ID = 2
const FUNCAO_CORRETOR_ID = 20

export async function registerRealtor(formData) {
  console.log('[ACTION v5] Iniciando registerRealtor...'); // Log v5
  const cookieStore = cookies()
  
  // Cliente NORMAL para autenticação (gerencia cookies)
  const supabase = createClient() 
  // Cliente ADMIN para operações no DB (ignora RLS)
  const supabaseAdmin = createAdminClient()

  const { nome, email, password, confirmPassword, creci, cpf } = formData
  console.log('[ACTION v5] Dados recebidos:', { nome, email, creci, cpf });

  // Validações Básicas... (iguais à v4)
  if (!nome || !email || !password || !creci) return { error: '...' }
  if (password !== confirmPassword) return { error: '...' }
  if (password.length < 6) return { error: '...' }

  let newUserId = null; 

  try {
    // Passo 1: SignUp (usando o cliente NORMAL)
    console.log('[ACTION v5] Tentando SignUp para:', email);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
      // SEM options.data aqui, pois o trigger não será mais usado para isso
    })

    // Tratamento de erro do SignUp... (igual à v4)
     if (authError) {
      console.error('[ACTION v5] Erro no SignUp:', authError.message);
      if (authError.message.includes('User already registered')) {
          return { error: 'Este e-mail já está cadastrado no sistema.' }
      }
      throw new Error(`Erro ao criar autenticação: ${authError.message}`);
    }
     if (!authData.user) {
       const isConfirmationRequired = authData.session === null; 
       if (isConfirmationRequired) {
           console.log('[ACTION v5] SignUp OK, mas requer confirmação de e-mail.');
           const potentialUserId = authData.user?.id || authData.id; 
           if (!potentialUserId) throw new Error('Falha ao obter ID do usuário após signup pendente.');
           newUserId = potentialUserId;
            console.log('[ACTION v5] SignUp pendente, User ID obtido:', newUserId);
       } else {
            throw new Error('Não foi possível criar o usuário (Auth retornou vazio).');
       }
    } else {
        newUserId = authData.user.id;
        console.log('[ACTION v5] SignUp OK! Novo User ID:', newUserId);
    }


    // Passo 2: Criar Perfil (usuarios) - Usando o cliente ADMIN!
    console.log('[ACTION v5] Tentando inserir em usuarios (ADMIN) para ID:', newUserId);
    const { error: profileError } = await supabaseAdmin.from('usuarios').insert({ // <-- USA supabaseAdmin
      id: newUserId,
      organizacao_id: ORGANIZACAO_PADRAO_ID, 
      funcao_id: FUNCAO_CORRETOR_ID, 
      nome: nome,
      email: email,
    })

    if (profileError) {
      console.error('[ACTION v5] Erro ao inserir em usuarios (ADMIN):', profileError.message);
      // RLS não deve ser problema aqui, mas verificamos outros erros
      throw new Error(`Falha ao configurar perfil de acesso: ${profileError.message}`)
    }
    console.log('[ACTION v5] Inserção em usuarios (ADMIN) OK!');

    // Passo 3: Criar Contato (contatos) - Usando o cliente ADMIN!
    console.log('[ACTION v5] Tentando inserir em contatos (ADMIN) para ID:', newUserId);
    const { error: contactError } = await supabaseAdmin.from('contatos').insert({ // <-- USA supabaseAdmin
      nome: nome,
      cpf: cpf || null,
      creci: creci, 
      tipo_contato: 'Corretor', 
      organizacao_id: ORGANIZACAO_PADRAO_ID, 
      criado_por_usuario_id: newUserId, // Foreign Key deve funcionar agora
    })

    if (contactError) {
      console.error('[ACTION v5] Erro ao inserir em contatos (ADMIN):', contactError.message);
      throw new Error(`Falha ao salvar dados do corretor: ${contactError.message}`)
    }
    console.log('[ACTION v5] Inserção em contatos (ADMIN) OK!');

    // Sucesso!
    console.log('[ACTION v5] Cadastro completo com sucesso!');
    return { success: true }

  } catch (error) {
    // CATCH SIMPLIFICADO: Apenas registra o erro e retorna para a página.
    console.error('[ACTION v5] Erro CATCH GERAL:', error.message); 
    console.error(error); 
    
    // Tenta limpar o usuário do Auth se ele chegou a ser criado (usando o cliente ADMIN)
    if (newUserId) {
        console.warn(`[ACTION v5] Tentando limpar usuário órfão (auth) com ID: ${newUserId}`);
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(newUserId); // <-- Usa supabaseAdmin aqui também!
        if (deleteError) {
             console.error('[ACTION v5] FALHA ao tentar limpar usuário órfão:', deleteError.message);
             // Retorna o erro original, mas avisa sobre o órfão
             return { error: `${error.message}. ATENÇÃO: Falha ao limpar usuário órfão (${email}).` };
        } else {
             console.log('[ACTION v5] Usuário órfão (auth) limpo com sucesso.');
        }
    }
    
    return { error: error.message };
  }
}