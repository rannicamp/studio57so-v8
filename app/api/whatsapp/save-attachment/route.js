//app\api\whatsapp\save-attachment\route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    try {
        // Recebe os dados do anexo do corpo da requisição
        const dadosParaSalvar = await request.json();

        // Validação simples para garantir que os dados essenciais estão presentes
        if (!dadosParaSalvar.contato_id || !dadosParaSalvar.storage_path) {
            return NextResponse.json({ error: 'Dados insuficientes para salvar o anexo.' }, { status: 400 });
        }
        
        // Insere os dados diretamente na tabela, sem chamar uma função RPC
        const { error } = await supabaseAdmin
            .from('whatsapp_attachments')
            .insert(dadosParaSalvar);

        if (error) {
            console.error('Erro ao inserir anexo no banco:', error);
            // Lança o erro para ser pego pelo bloco catch
            throw error;
        }

        return NextResponse.json({ success: true, message: 'Anexo registrado com sucesso.' });

    } catch (error) {
        return NextResponse.json({ success: false, error: `Erro no servidor ao salvar anexo: ${error.message}` }, { status: 500 });
    }
}