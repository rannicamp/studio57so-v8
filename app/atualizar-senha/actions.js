"use server";

import { createClient } from '@/utils/supabase/server';

export async function updatePasswordAction(password) {
    try {
        const supabase = await createClient();
        
        // 1. Validar se a sessão existe no servidor (lendo dos cookies que o callback setou)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
            console.error("Server Action: Sem sessão para atualizar a senha.");
            return { error: 'Sessão inválida ou expirada. Solicite uma nova recuperação de senha.' };
        }

        // 2. Atualizar a senha
        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            console.error("Server Action erro ao atualizar senha:", error);
            let errorMessage = "Ocorreu um erro ao atualizar sua senha.";
            
            if (error.message.includes("New password should be different")) {
                errorMessage = "A nova senha deve ser diferente da senha atual.";
            } else if (error.message.includes("Password should be at least")) {
                errorMessage = "A senha deve ter no mínimo 6 caracteres.";
            } else {
                errorMessage = error.message;
            }

            return { error: errorMessage };
        }

        return { success: true };
    } catch (err) {
        console.error("Erro interno no updatePasswordAction:", err);
        return { error: 'Ocorreu um erro interno ao atualizar a senha.' };
    }
}
