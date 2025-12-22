import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const supabase = await createClient();
  
  try {
    const materials = await request.json();

    if (!Array.isArray(materials) || materials.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum dado válido para importar foi recebido.' },
        { status: 400 }
      );
    }

    // Garante que todas as linhas tenham pelo menos uma propriedade válida
    const validMaterials = materials.filter(m => m && typeof m === 'object' && Object.keys(m).length > 0);

    if (validMaterials.length === 0) {
       return NextResponse.json(
        { error: 'Os dados recebidos estão vazios ou em formato incorreto.' },
        { status: 400 }
      );
    }
    
    // As colunas com nomes compostos ou maiúsculas precisam ser colocadas entre aspas
    const dataToInsert = validMaterials.map(material => ({
        ...material,
        "Grupo": material.Grupo,
        "Código da Composição": material['Código da Composição']
    }));

    const { data, error, count } = await supabase
      .from('materiais')
      .insert(dataToInsert)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      // Tenta dar uma mensagem de erro mais útil
      if (error.code === '23505') { // violação de chave única
        return NextResponse.json({ error: `Erro de duplicidade: ${error.details}` }, { status: 409 });
      }
      if (error.code === '22P02') { // tipo de dado inválido
         return NextResponse.json({ error: `Tipo de dado incorreto. Verifique colunas como 'preco_unitario'. Detalhes: ${error.details}` }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Importação bem-sucedida!', count: count }, { status: 200 });

  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}