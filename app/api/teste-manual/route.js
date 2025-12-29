import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Garante que não faça cache

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Tenta usar a chave mestra, se não tiver, usa a anônima
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.from('app_logs').insert({ 
      origem: 'TESTE NAVEGADOR', 
      mensagem: 'A API está viva e conectada ao banco!' 
    }).select();

    if (error) throw error;

    return NextResponse.json({ 
      status: 'Sucesso! ✅', 
      mensagem: 'Verifique a tabela app_logs agora.', 
      dados: data 
    });
  } catch (error) {
    return NextResponse.json({ 
      status: 'Erro ❌', 
      detalhe: error.message 
    }, { status: 500 });
  }
}