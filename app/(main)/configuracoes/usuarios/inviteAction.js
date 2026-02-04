// Caminho: app/(main)/configuracoes/usuarios/inviteAction.js
'use server';

import { createClient } from '@supabase/supabase-js';

// ⚠️ ATENÇÃO: Esta action usa a SERVICE_ROLE_KEY.
// Ela roda APENAS no servidor, então é segura.
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

    // 1. URL de redirecionamento (O PULO DO GATO 🐈)
    // Apontamos para o callback para trocar o 'code' pela sessão antes de ir para a página de senha
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirectUrl = `${siteUrl}/auth/callback?next=/atualizar-senha`;

    // 2. Convidar usuário via Supabase Auth Admin
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        nome,
        sobrenome,
        cargo_inicial_id: cargoId // Metadado de segurança
      },
      redirectTo: redirectUrl
    });

    if (inviteError) {
      console.error("❌ Erro no Invite Auth:", inviteError);
      throw new Error(inviteError.message);
    }

    const newUserId = authData.user.id;
    console.log("✅ Usuário Auth criado com ID:", newUserId);

    // 3. Criar registro na tabela pública 'usuarios' JÁ COM O CARGO
    const { error: userTableError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: newUserId,
        email: email,
        nome: nome,
        sobrenome: sobrenome,
        funcao_id: cargoId, // <--- AQUI ESTÁ A MÁGICA! Cargo travado.
        organizacao_id: organizacaoId,
        is_active: true,
        avatar_url: null, 
        aceitou_termos: false
      });

    if (userTableError) {
      // Se falhar no banco público, removemos do Auth para não ficar "fantasma"
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