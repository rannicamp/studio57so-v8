import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { ModelDerivativeClient } from '@aps_sdk/model-derivative';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';
import { createAdminClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const sdk = SdkManagerBuilder.create().build();
const authenticationClient = new AuthenticationClient(sdk);
const modelDerivativeClient = new ModelDerivativeClient(sdk);

// Função recursiva para varrer a árvore do manifesto em busca de geometrias 2D/3D
function extractViewables(node, results = []) {
  if (!node) return results;

  if (node.type === 'geometry' && (node.role === '2d' || node.role === '3d')) {
    results.push({
      guid: node.guid,
      nome: node.name || 'Vista sem nome',
      tipo: node.role, // '2d' ou '3d'
      role: node.role === '2d' ? 'sheet' : '3dview'
    });
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      extractViewables(child, results);
    }
  }

  return results;
}

export async function POST(request) {
  try {
    const { urn, projetoBimId, organizacaoId } = await request.json();

    if (!urn || !projetoBimId || !organizacaoId) {
      return NextResponse.json(
        { error: 'URN, projetoBimId e organizacaoId são obrigatórios.' },
        { status: 400 }
      );
    }

    // 1. Autenticar com Autodesk
    const credentials = await authenticationClient.getTwoLeggedToken(
      process.env.APS_CLIENT_ID,
      process.env.APS_CLIENT_SECRET,
      [Scopes.ViewablesRead]
    );

    // 2. Buscar manifesto do modelo
    let manifest;
    try {
      manifest = await modelDerivativeClient.getManifest(
        urn,
        { accessToken: credentials.access_token }
      );
    } catch (err) {
      console.error('[APS Vistas] Erro ao buscar manifesto da Autodesk:', err.message);
      return NextResponse.json(
        { error: `Falha ao recuperar o manifesto da Autodesk: ${err.message}` },
        { status: 404 }
      );
    }

    if (!manifest || manifest.status !== 'success') {
      return NextResponse.json({
        success: false,
        status: manifest ? manifest.status : 'not_found',
        message: 'Tradução do modelo não está concluída ou falhou.'
      });
    }

    // 3. Extrair as pranchas 2D e vistas 3D recursivamente
    const viewables = [];
    if (manifest.derivatives && Array.isArray(manifest.derivatives)) {
      for (const derivative of manifest.derivatives) {
        if (derivative.children && Array.isArray(derivative.children)) {
          for (const child of derivative.children) {
            extractViewables(child, viewables);
          }
        }
      }
    }

    if (viewables.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum viewable 2D/3D encontrado no modelo.',
        vistas: []
      });
    }

    // 4. Preparar dados para salvar no Supabase
    const dbRecords = viewables.map(v => ({
      projeto_bim_id: parseInt(projetoBimId, 10),
      organizacao_id: parseInt(organizacaoId, 10),
      guid: v.guid,
      nome: v.nome,
      tipo: v.tipo,
      role: v.role
    }));

    // 5. Inserir/Upsert no Supabase
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('projetos_bim_vistas')
      .upsert(dbRecords, { onConflict: 'projeto_bim_id,guid' })
      .select();

    if (error) {
      console.error('[APS Vistas] Erro ao salvar vistas no banco:', error);
      throw new Error(`Erro ao gravar vistas no banco: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `${data.length} vistas/pranchas catalogadas com sucesso.`,
      vistas: data
    });

  } catch (error) {
    console.error('[APS VISTAS API ERROR]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
