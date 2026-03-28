// app/api/instagram/link-contact/route.js
// GET  → Match inteligente: busca contatos similares pelo nome/username do participante
// PATCH → Vincula um contato ao participante Instagram (e propaga foto se contato não tiver)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// ─── GET: Match Inteligente ────────────────────────────────────────────────
// Busca possíveis contatos que combinam com o participante Instagram
export async function GET(request) {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const participantName = searchParams.get('name') || '';
    const participantUsername = searchParams.get('username') || '';
    const organizacaoId = searchParams.get('organizacao_id');
    const searchTerm = searchParams.get('search') || ''; // busca manual

    if (!organizacaoId) {
        return NextResponse.json({ error: 'organizacao_id obrigatório' }, { status: 400 });
    }

    try {
        let results = [];

        if (searchTerm) {
            // ── Modo busca manual (digitada pelo usuário) ──
            const { data } = await supabase
                .from('contatos')
                .select('id, nome, razao_social, foto_url, telefone, emails(email), telefones(telefone)')
                .eq('organizacao_id', organizacaoId)
                .or(`nome.ilike.%${searchTerm}%,razao_social.ilike.%${searchTerm}%`)
                .order('nome')
                .limit(10);

            results = (data || []).map(c => ({
                ...c,
                confidence: null,
                match_type: 'manual',
            }));

        } else {
            // ── Modo automático: Match Inteligente ──
            const nameParts = (participantName || '').split(' ').filter(Boolean);
            const firstName = nameParts[0] || '';

            // 1. Busca por nome completo exato (95%)
            if (participantName) {
                const { data: exactMatches } = await supabase
                    .from('contatos')
                    .select('id, nome, razao_social, foto_url, telefone, emails(email), telefones(telefone)')
                    .eq('organizacao_id', organizacaoId)
                    .ilike('nome', participantName)
                    .limit(5);

                (exactMatches || []).forEach(c => {
                    results.push({ ...c, confidence: 95, match_type: 'nome_exato' });
                });
            }

            // 2. Busca por primeiro nome (70%)
            if (firstName && firstName.length > 2) {
                const { data: partialMatches } = await supabase
                    .from('contatos')
                    .select('id, nome, razao_social, foto_url, telefone, emails(email), telefones(telefone)')
                    .eq('organizacao_id', organizacaoId)
                    .ilike('nome', `%${firstName}%`)
                    .limit(5);

                (partialMatches || []).forEach(c => {
                    if (!results.find(r => r.id === c.id)) {
                        results.push({ ...c, confidence: 70, match_type: 'nome_parcial' });
                    }
                });
            }

            // 3. Username Instagram bate com campo dedicado no contato (99%)
            // (campo instagram_username seria ideal — por ora busca em observacoes)
            if (participantUsername) {
                const { data: usernameMatches } = await supabase
                    .from('contatos')
                    .select('id, nome, razao_social, foto_url, telefone, emails(email), telefones(telefone)')
                    .eq('organizacao_id', organizacaoId)
                    .ilike('observacoes', `%${participantUsername}%`)
                    .limit(3);

                (usernameMatches || []).forEach(c => {
                    if (!results.find(r => r.id === c.id)) {
                        results.push({ ...c, confidence: 99, match_type: 'username' });
                    }
                });
            }

            // Ordena por confiança decrescente
            results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        }

        return NextResponse.json({ results });

    } catch (error) {
        console.error('[Link Contact API] GET error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ─── PATCH: Vincular Contato ───────────────────────────────────────────────
// Vincula um contato ao participante Instagram
export async function PATCH(request) {
    const supabase = getSupabaseAdmin();

    try {
        const body = await request.json();
        const { instagram_conversation_id, contato_id, organizacao_id, profile_pic_url } = body;

        if (!instagram_conversation_id || !organizacao_id) {
            return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
        }

        // 1. Atualiza a conversa Instagram com o contato vinculado
        const { error: convError } = await supabase
            .from('instagram_conversations')
            .update({ contato_id: contato_id || null })
            .eq('id', instagram_conversation_id)
            .eq('organizacao_id', organizacao_id);

        if (convError) throw convError;

        // 2. Se vinculando (não desvinculando) e tiver foto do Instagram:
        //    Propaga a foto para contatos.foto_url (APENAS se estiver vazia)
        if (contato_id && profile_pic_url) {
            const { data: contato } = await supabase
                .from('contatos')
                .select('id, foto_url')
                .eq('id', contato_id)
                .maybeSingle();

            if (contato && !contato.foto_url) {
                await supabase
                    .from('contatos')
                    .update({ foto_url: profile_pic_url })
                    .eq('id', contato_id);
                
                console.log(`[Link Contact] Foto Instagram propagada para contato ${contato_id}`);
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: contato_id ? 'Contato vinculado com sucesso!' : 'Vínculo removido.' 
        });

    } catch (error) {
        console.error('[Link Contact API] PATCH error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ─── DELETE: Desvincular ──────────────────────────────────────────────────
export async function DELETE(request) {
    return PATCH(request); // Reutiliza, basta enviar contato_id: null
}
