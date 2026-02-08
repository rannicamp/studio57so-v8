import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    console.log("--- INICIANDO TESTE FINAL DE INSERÇÃO ---");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("DEBUG: Variáveis de ambiente não encontradas.");
        return NextResponse.json({
            sucesso: false,
            etapa: "Verificação de Variáveis",
            mensagem: "URL ou Chave de Serviço do Supabase não encontradas no ambiente do servidor.",
        }, { status: 500 });
    }

    try {
        console.log("DEBUG: Inicializando cliente Supabase com Service Role Key.");
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        const dadosParaSalvar = {
            contato_id: 661, // Um ID fixo apenas para o teste
            storage_path: 'caminho/teste.txt',
            public_url: 'url/teste.txt',
            file_name: 'teste.txt',
            file_type: 'text/plain',
            file_size: 123
        };

        console.log("DEBUG: Tentando inserir os seguintes dados:", JSON.stringify(dadosParaSalvar, null, 2));

        const { data, error } = await supabaseAdmin
            .from('whatsapp_attachments')
            .insert(dadosParaSalvar)
            .select()
            .single();

        if (error) {
            console.error("ERRO DETECTADO AO INSERIR NO BANCO:", error);
            // Retornamos o erro completo para análise
            return NextResponse.json({
                sucesso: false,
                etapa: "Inserção no Banco de Dados",
                mensagem: error.message,
                detalhes_do_erro: error
            }, { status: 400 });
        }

        console.log("SUCESSO: Inserção no banco de dados realizada com sucesso.");
        return NextResponse.json({
            sucesso: true,
            mensagem: "Conexão e inserção com o banco de dados funcionaram perfeitamente!",
            dados_retornados: data
        });

    } catch (e) {
        console.error("ERRO INESPERADO NA API:", e);
        return NextResponse.json({
            sucesso: false,
            etapa: "Erro Inesperado na API",
            mensagem: e.message
        }, { status: 500 });
    }
}