import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/googleCalendar';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'agenda';

    const url = getAuthUrl(tipo);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('Erro ao gerar URL do Google:', error);
    return NextResponse.json({ error: 'Falha ao iniciar autenticação com Google' }, { status: 500 });
  }
}
