import { NextResponse } from 'next/server';

// Configuração Next.js
export const dynamic = 'force-dynamic';

export async function POST(request) {
    // 🚨 FREIO DE MÃO PUXADO 🚨
    // O código abaixo foi neutralizado para salvar o Supabase.
    // Nenhuma conexão IMAP ou Banco de Dados será feita.
    
    console.log('🛑 [EMERGÊNCIA] Sincronização totalmente PAUSADA.');

    // Retorna sucesso fake para o frontend não quebrar
    return NextResponse.json({ 
        success: true, 
        message: 'Sincronização pausada temporariamente.',
        totalNew: 0, 
        totalPending: 0 
    });
}

export async function GET(req) { return POST(req); }