import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.json({ error: "Config error" }, { status: 500 });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { list_id } = await request.json();

        // 1. Buscar a Lista e seus Filtros
        const { data: list, error: listError } = await supabaseAdmin
            .from('whatsapp_broadcast_lists')
            .select('*')
            .eq('id', list_id)
            .single();

        if (listError || !list) return NextResponse.json({ error: "Lista não encontrada" }, { status: 404 });

        const filters = list.filtros_usados;
        if (!filters) return NextResponse.json({ message: "Lista manual (sem filtros), nada a sincronizar." });

        console.log(`[Sync] Sincronizando lista ${list.nome}... Filtros:`, filters);

        // 2. Rodar a Busca de Contatos (A mesma lógica do Modal, mas no servidor)
        let query = supabaseAdmin
            .from('contatos')
            .select(`
                id, 
                telefones!inner(telefone),
                contatos_no_funil!contatos_no_funil_contato_id_fkey (coluna_id)
            `)
            .eq('organizacao_id', list.organizacao_id);

        // Aplica Filtros
        if (filters.nameSearch) query = query.ilike('nome', `%${filters.nameSearch}%`);
        if (filters.contactType) query = query.eq('tipo_contato', filters.contactType);

        const { data: contacts, error: searchError } = await query;
        if (searchError) throw searchError;

        // Filtragem em Memória (Funil/Etapa)
        let validIds = [];
        
        if (contacts) {
            // Filtra quem tem telefone
            let filtered = contacts.filter(c => c.telefones && c.telefones.length > 0 && c.telefones[0].telefone);

            // Filtra Funil
            if (filters.funnelId || filters.columnId) {
                // Precisamos buscar as colunas do funil se for filtro só por funil
                let validColumnIds = [];
                if (filters.funnelId && !filters.columnId) {
                    const { data: cols } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', filters.funnelId);
                    validColumnIds = cols.map(c => c.id);
                }

                filtered = filtered.filter(contact => {
                    const entries = Array.isArray(contact.contatos_no_funil) ? contact.contatos_no_funil : (contact.contatos_no_funil ? [contact.contatos_no_funil] : []);
                    if (entries.length === 0) return false;

                    if (filters.columnId) return entries.some(e => e.coluna_id === filters.columnId);
                    if (filters.funnelId) return entries.some(e => validColumnIds.includes(e.coluna_id));
                    return true;
                });
            }
            
            validIds = filtered.map(c => c.id);
        }

        console.log(`[Sync] Encontrados ${validIds.length} contatos atuais.`);

        // 3. Atualizar a Tabela de Membros (Transação "Fake")
        
        // Remove membros antigos
        await supabaseAdmin
            .from('whatsapp_list_members')
            .delete()
            .eq('lista_id', list_id);

        // Insere novos (se houver)
        if (validIds.length > 0) {
            const membersPayload = validIds.map(id => ({
                lista_id: list_id,
                contato_id: id
            }));
            
            const { error: insertError } = await supabaseAdmin
                .from('whatsapp_list_members')
                .insert(membersPayload);
                
            if (insertError) throw insertError;
        }

        // Atualiza timestamp da lista
        await supabaseAdmin
            .from('whatsapp_broadcast_lists')
            .update({ created_at: new Date().toISOString() }) // Força update visual
            .eq('id', list_id);

        return NextResponse.json({ 
            success: true, 
            count: validIds.length,
            message: `Lista atualizada! ${validIds.length} membros.` 
        });

    } catch (error) {
        console.error("[Sync Error]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}