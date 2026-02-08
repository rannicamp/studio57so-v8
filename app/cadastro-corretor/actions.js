// app/cadastro-corretor/actions.js
'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server' 
import { cookies } from 'next/headers'

// IDs Corretos do Studio 57
const ORGANIZACAO_PADRAO_ID = 2
const FUNCAO_CORRETOR_ID = 20

export async function registerRealtor(formData) {
  console.log('[ACTION] Iniciando cadastro completo de corretor...');
  
  const cookieStore = cookies()
  const supabase = await createClient() 
  const supabaseAdmin = createAdminClient()

  const { 
      nome, email, password, confirmPassword, creci, cpf, termId,
      estado_civil, cep, address_street, address_number, address_complement, neighborhood, city, state
  } = formData

  // --- Validações ---
  if (!nome || !email || !password || !creci || !cpf || !address_street || !city || !state || !cep || !estado_civil) {
      return { error: 'Preencha todos os campos obrigatórios (Dados Pessoais e Endereço).' }
  }
  if (password !== confirmPassword) {
      return { error: 'Senhas não conferem.' }
  }
  if (password.length < 6) {
      return { error: 'Senha deve ter no mínimo 6 caracteres.' }
  }
  if (!termId) {
      return { error: 'Erro nos Termos de Uso. Recarregue a página e tente novamente.' }
  }

  let newUserId = null; 

  try {
    // 1. SignUp
    console.log(`[ACTION] Criando Auth para: ${email}`);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
    })

     if (authError) {
      console.error('[ACTION] Erro no SignUp:', authError.message);
      if (authError.message.includes('User already registered') || authError.message.includes('already registered')) {
          return { error: 'Este e-mail já está cadastrado no sistema.' }
      }
      throw new Error(`Erro Auth: ${authError.message}`);
    }
    
    if (authData.user) {
        newUserId = authData.user.id;
    } else if (authData.id) {
         newUserId = authData.id; 
    }

    if (!newUserId) throw new Error('Usuário criado, mas ID não retornado.');
    console.log(`[ACTION] Auth criado. ID: ${newUserId}`);

    // 2. Perfil (usuarios)
    console.log('[ACTION] Criando Perfil...');
    const { error: profileError } = await supabaseAdmin.from('usuarios').upsert({
      id: newUserId,
      organizacao_id: ORGANIZACAO_PADRAO_ID, 
      funcao_id: FUNCAO_CORRETOR_ID, 
      nome: nome,
      email: email,
      aceitou_termos: true,
      data_aceite_termos: new Date().toISOString()
    })

    if (profileError) throw new Error(`Erro Perfil: ${profileError.message}`)

    // 3. Contato COMPLETO (contatos)
    console.log('[ACTION] Criando Contato Completo...');
    const { error: contactError } = await supabaseAdmin.from('contatos').insert({
      nome: nome,
      cpf: cpf,
      creci: creci, 
      
      // Dados Profissionais Implícitos
      tipo_contato: 'Corretor', 
      cargo: 'Corretor de Imóveis', // Adicionado para constar na ficha
      
      // Dados Pessoais Extras
      estado_civil: estado_civil,

      // Endereço Completo
      cep: cep,
      address_street: address_street,
      address_number: address_number,
      address_complement: address_complement,
      neighborhood: neighborhood,
      city: city,
      state: state,
      
      organizacao_id: ORGANIZACAO_PADRAO_ID, 
      criado_por_usuario_id: newUserId,
    })

    if (contactError) throw new Error(`Erro Contato: ${contactError.message}`)

    // 4. Aceite Termos
    await supabaseAdmin.from('termos_aceite').insert({
        user_id: newUserId,
        termo_id: termId,
        organizacao_id: ORGANIZACAO_PADRAO_ID
    })
    
    console.log('[ACTION] Sucesso Total!');
    return { success: true }

  } catch (error) {
    console.error('[ACTION] CATCH:', error); 
    if (newUserId) {
        try { await supabaseAdmin.auth.admin.deleteUser(newUserId); } catch (e) {}
    }
    return { error: error.message || 'Erro inesperado no servidor.' };
  }
}