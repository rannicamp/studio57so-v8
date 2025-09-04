import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const funilId = searchParams.get('funil_id')

  if (!funilId) {
    return NextResponse.json({ error: 'Funil ID é obrigatório' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('colunas_funil')
      .select(`
        id,
        nome,
        ordem,
        contatos_no_funil (
          id,
          updated_at,
          numero_card,
          contato:contato_id (
            id,
            nome,
            foto_url,
            telefones (telefone),
            emails (email)
          ),
          corretor:corretor_id (
            id,
            nome,
            foto_url
          ),
          produto:produto_id (
            id,
            unidade
          ),
          simulacao:simulacao_id (
            id,
            valor_venda
          )
        )
      `)
      .eq('funil_id', funilId)
      .order('ordem', { ascending: true })
      .order('updated_at', { foreignTable: 'contatos_no_funil', ascending: false });

    if (error) {
      console.error('Erro ao buscar colunas e contatos do funil:', error)
      throw error
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  const supabase = createClient()
  const { contatoId, novaColunaId, funilId } = await request.json()

  try {
    const { data: card, error: fetchError } = await supabase
      .from('contatos_no_funil')
      .select('id, coluna_id')
      .eq('contato_id', contatoId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // Ignora erro se o contato não está no funil
      throw new Error(`Erro ao buscar contato no funil: ${fetchError.message}`)
    }

    if (card) {
      // Atualiza o card existente
      const { error: updateError } = await supabase
        .from('contatos_no_funil')
        .update({ coluna_id: novaColunaId, updated_at: new Date().toISOString() })
        .eq('id', card.id)
      
      if (updateError) throw new Error(`Erro ao mover contato: ${updateError.message}`)
    } else {
      // Adiciona o novo contato ao funil
      const { error: insertError } = await supabase
        .from('contatos_no_funil')
        .insert({
          contato_id: contatoId,
          coluna_id: novaColunaId,
        })
      
      if (insertError) throw new Error(`Erro ao adicionar contato: ${insertError.message}`)
    }

    return NextResponse.json({ message: 'Operação realizada com sucesso!' })
  } catch (error) {
    console.error('Erro na operação do funil:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


export async function PATCH(request) {
  const supabase = createClient()
  const { cardId, corretorId } = await request.json()

  if (!cardId) {
    return NextResponse.json({ error: 'ID do Card é obrigatório' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('contatos_no_funil')
      .update({ 
        corretor_id: corretorId,
        updated_at: new Date().toISOString()
       })
      .eq('id', cardId)
      .select()

    if (error) {
      console.error('Erro ao atualizar corretor:', error)
      throw error
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}