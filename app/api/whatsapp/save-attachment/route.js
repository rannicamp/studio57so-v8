import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("ERRO CRÍTICO: Variáveis de ambiente do Supabase não encontradas.");
        return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    try {
        const body = await request.json();
        const {
            p_contato_id,
            p_storage_path,
            p_public_url,
            p_file_name,
            p_file_type,
            p_file_size
        } = body;

        // Validação básica
        if (!p_contato_id || !p_storage_path) {
            return NextResponse.json({ error: 'Dados insuficientes para salvar o anexo.' }, { status: 400 });
        }
        
        // Chama o "Funcionário Interno" (RPC) com as permissões de admin
        const { error } = await supabaseAdmin.rpc('salvar_anexo_whatsapp', {
            p_contato_id,
            p_storage_path,
            p_public_url,
            p_file_name,
            p_file_type,
            p_file_size
        });

        if (error) {
            console.error('Erro ao chamar RPC para salvar anexo:', error);
            throw error;
        }

        return NextResponse.json({ success: true, message: 'Anexo registrado com sucesso.' });

    } catch (error) {
        return NextResponse.json({ success: false, error: `Erro no servidor ao salvar anexo: ${error.message}` }, { status: 500 });
    }
}