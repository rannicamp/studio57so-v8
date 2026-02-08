// Caminho: app/(main)/configuracoes/usuarios/inviteAction.js
'use server';

import { createClient } from '@supabase/supabase-js';

// ⚠️ ATENÇÃO: Esta action usa a SERVICE_ROLE_KEY.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function inviteUser({ email, nome, sobrenome, cargoId, organizacaoId }) {
  try {
    console.log("🚀 [Devonildo] Iniciando convite para:", email);

    // --- LÓGICA DE URL INTELIGENTE DO DEVONILDO 🧠 ---
    // 1. Tenta pegar a variável de ambiente (O ideal)
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    // 2. Se a variável estiver vazia, decidimos com base no ambiente
    if (!siteUrl) {
      if (process.env.NODE_ENV === 'production') {
        // 🚨 AQUI ESTÁ A CORREÇÃO: Força o domínio oficial em produção
        siteUrl = 'https://studio57.arq.br'; 
      } else {
        // Em desenvolvimento local
        siteUrl = 'http://localhost:3000';
      }
    }

    // Remove barra no final se houver (para evitar // no link)
    siteUrl = siteUrl.replace(/\/$/, '');

    // Monta a URL de Callback (Troca o código por sessão e manda pra senha)
    const redirectUrl = `${siteUrl}/auth/callback?next=/atualizar-senha`;
    
    console.log("🔗 URL Gerada para o Convite:", redirectUrl);

    // --------------------------------------------------

    // 2. Convidar usuário via Supabase Auth Admin
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        nome,
        sobrenome,
        cargo_inicial_id: cargoId
      },
      redirectTo: redirectUrl
    });

    if (inviteError) {
      console.error("❌ Erro no Invite Auth:", inviteError);
      throw new Error(inviteError.message);
    }

    const newUserId = authData.user.id;
    console.log("✅ Usuário Auth criado com ID:", newUserId);

    // 3. Criar registro na tabela pública 'usuarios'
    const { error: userTableError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: newUserId,
        email: email,
        nome: nome,
        sobrenome: sobrenome,
        funcao_id: cargoId,
        organizacao_id: organizacaoId,
        is_active: true,
        avatar_url: null, 
        aceitou_termos: false
      });

    if (userTableError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      console.error("❌ Erro na tabela usuarios:", userTableError);
      throw new Error("Erro ao criar perfil do usuário: " + userTableError.message);
    }

    return { success: true, message: `Convite enviado para ${email} com sucesso!` };

  } catch (error) {
    console.error("🔥 Erro Geral no Invite:", error);
    return { success: false, error: error.message };
  }
}