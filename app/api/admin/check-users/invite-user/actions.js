'use server';

import { createClient } from '@supabase/supabase-js';

// ATENÇÃO: Esta action usa a SERVICE_ROLE_KEY para ter permissão de Admin
// Nunca exponha essa chave no cliente!
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
 console.log("🚀 Iniciando convite para:", email);

 // 1. Convidar usuário via Supabase Auth
 // O Supabase vai enviar o e-mail automaticamente com o link para /atualizar-senha
 const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
 data: {
 nome,
 sobrenome,
 // Dica do Devonildo: Passamos o cargo aqui nos metadados também por segurança
 cargo_inicial_id: cargoId },
 redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/atualizar-senha`
 });

 if (inviteError) {
 console.error("❌ Erro no Invite Auth:", inviteError);
 throw new Error(inviteError.message);
 }

 const newUserId = authData.user.id;
 console.log("✅ Usuário Auth criado com ID:", newUserId);

 // 2. Criar registro na tabela pública 'usuarios' (VINCULANDO O CARGO AGORA!)
 // Isso garante que quando ele logar, já terá o cargo certo.
 const { error: userTableError } = await supabaseAdmin
 .from('usuarios')
 .insert({
 id: newUserId,
 email: email,
 nome: nome,
 sobrenome: sobrenome,
 funcao_id: cargoId, // <--- O PULO DO GATO: Cargo já definido!
 organizacao_id: organizacaoId,
 is_active: true,
 // Opcional: Se tiver tabela de funcionários, pode criar aqui também
 });

 if (userTableError) {
 // Se der erro aqui, talvez seja bom deletar o usuário do Auth para não ficar "manco"
 await supabaseAdmin.auth.admin.deleteUser(newUserId);
 console.error("❌ Erro na tabela usuarios:", userTableError);
 throw new Error("Erro ao criar perfil do usuário: " + userTableError.message);
 }

 return { success: true, message: "Convite enviado e perfil criado com sucesso!" };

 } catch (error) {
 console.error("🔥 Erro Geral no Invite:", error);
 return { success: false, error: error.message };
 }
}