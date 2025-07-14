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
        const body = await request.json();
        
        // ***** INÍCIO DA CORREÇÃO *****
        // Usamos os mesmos nomes dos parâmetros, mas agora para um objeto de inserção
        const dadosParaSalvar = {
            contato_id: body.p_contato_id,
            storage_path: body.p_storage_path,
            public_url: body.p_public_url,
            file_name: body.p_file_name,
            file_type: body.p_file_type,
            file_size: body.p_file_size
        };

        if (!dadosParaSalvar.contato_id || !dadosParaSalvar.storage_path) {
            return NextResponse.json({ error: 'Dados insuficientes para salvar o anexo.' }, { status: 400 });
        }
        
        // Trocamos a chamada RPC por um INSERT direto, que o nosso teste provou que funciona.
        const { error } = await supabaseAdmin
            .from('whatsapp_attachments')
            .insert(dadosParaSalvar);
        // ***** FIM DA CORREÇÃO *****

        if (error) {
            console.error('Erro ao inserir anexo no banco:', error);
            throw error;
        }

        return NextResponse.json({ success: true, message: 'Anexo registrado com sucesso.' });

    } catch (error) {
        return NextResponse.json({ success: false, error: `Erro no servidor ao salvar anexo: ${error.message}` }, { status: 500 });
    }
}