import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { projetoBimId, versaoAnterior, versaoNova, organizacaoId, deltas } = await request.json();

    if (!projetoBimId || !versaoNova || !organizacaoId) {
      return NextResponse.json(
        { error: 'projetoBimId, versaoNova e organizacaoId são obrigatórios.' },
        { status: 400 }
      );
    }

    if (!deltas || !Array.isArray(deltas) || deltas.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum delta de alteração para registrar.',
        registros: []
      });
    }

    // Preparar os registros de deltas para inserção
    const dbRecords = deltas.map(d => ({
      projeto_bim_id: parseInt(projetoBimId, 10),
      organizacao_id: parseInt(organizacaoId, 10),
      versao_anterior: versaoAnterior ? parseInt(versaoAnterior, 10) : null,
      versao_nova: parseInt(versaoNova, 10),
      external_id: d.external_id,
      categoria: d.categoria || null,
      familia: d.familia || null,
      tipo: d.tipo || null,
      acao: d.acao, // 'adicionado', 'removido', 'modificado'
      propriedade_alterada: d.propriedade_alterada || null,
      valor_anterior: d.valor_anterior !== undefined && d.valor_anterior !== null ? String(d.valor_anterior) : null,
      valor_novo: d.valor_novo !== undefined && d.valor_novo !== null ? String(d.valor_novo) : null
    }));

    // Inserir os deltas no Supabase usando o cliente admin
    const supabase = createAdminClient();
    
    // Inserimos em chunks de 1000 registros para evitar estourar limites de payload do Postgres
    const CHUNK_SIZE = 1000;
    let registrosInseridos = [];

    for (let i = 0; i < dbRecords.length; i += CHUNK_SIZE) {
      const chunk = dbRecords.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from('historico_elementos_bim')
        .insert(chunk)
        .select();

      if (error) {
        console.error('[APS Compare] Erro ao salvar deltas no banco:', error);
        throw new Error(`Erro ao gravar histórico de deltas no banco: ${error.message}`);
      }
      
      registrosInseridos = registrosInseridos.concat(data);
    }

    return NextResponse.json({
      success: true,
      message: `${registrosInseridos.length} deltas de elementos registrados com sucesso para a versão v${versaoNova}.`,
      count: registrosInseridos.length
    });

  } catch (error) {
    console.error('[APS COMPARE API ERROR]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
