import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request) {
    try {
        const supabase = await createClient();

        // 1. Recebe os dados
        const dadosRecebidos = await request.json();
        
        // 2. Extraímos com nomes claros para o computador não se perder
        // Tentamos pegar 'organizacaoId' ou 'organizacao_id' (o que vier)
        const idDoContato = dadosRecebidos.contact_id;
        const idDaOrganizacao = dadosRecebidos.organizacaoId || dadosRecebidos.organizacao_id;

        // 3. Verificação de segurança (Log para você ver no terminal)
        console.log('[Mark Read] Dados extraídos:', { idDoContato, idDaOrganizacao });

        if (!idDoContato || !idDaOrganizacao) {
            return NextResponse.json({ 
                error: 'Faltando contact_id ou organizacaoId',
                recebido: { idDoContato, idDaOrganizacao }
            }, { status: 400 });
        }

        // 4. Atualização no Supabase usando as novas variáveis
        const { error } = await supabase
            .from('whatsapp_conversations')
            .update({ unread_count: 0 })
            .eq('contato_id', idDoContato)
            .eq('organizacao_id', idDaOrganizacao);

        if (error) {
            console.error('[Mark Read API] Erro Supabase:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error('[Mark Read API] Erro Fatal:', err);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}