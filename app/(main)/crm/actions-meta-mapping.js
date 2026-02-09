'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// --- CONSTANTES ---

// Campos do Meta que ignoramos na visualização (Esquerda do Mapeamento)
// Escondemos campos técnicos e dados que o webhook já processa nativamente (Nome, Email, Tel)
const IGNORED_META_FIELDS = [
  'id', 'created_time', 'form_id', 'page_id', 'leadgen_id', 
  'ad_id', 'adgroup_id', 'campaign_id', 'platform', 'form_name',
  'full_name', 'email', 'phone_number', 'phone'
]

// --- FUNÇÕES AUXILIARES ---

// Formata "renda_familiar" para "Renda Familiar" (Capitalize)
function formatColumnName(name) {
  if (!name) return ''
  return name
    .replace(/_/g, ' ') // Troca underline por espaço
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Busca formulários na API do Meta (com lógica User/Page token)
async function fetchFormsFromMetaAPI() {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  
  if (!token) {
    throw new Error('Token de acesso do Meta não configurado no servidor (.env).')
  }

  console.log("Devonildo: Iniciando busca de formulários. Verificando tipo do token...")
  
  let targetPageId = 'me'
  let pageAccessToken = token

  try {
      const accountsUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token&access_token=${token}`
      const accountsRes = await fetch(accountsUrl)
      const accountsData = await accountsRes.json()

      if (accountsData.data && accountsData.data.length > 0) {
          const page = accountsData.data[0]
          targetPageId = page.id
          if (page.access_token) {
            pageAccessToken = page.access_token
          }
          console.log(`Devonildo: Token de Usuário detectado. Redirecionando para a página: ${page.name} (ID: ${page.id})`)
      }
  } catch (error) {
      console.warn("Devonildo: Falha leve ao verificar contas (ignorada). Tentando método direto.", error)
  }

  // Removidos campos depreciados para evitar erro #12
  const formsUrl = `https://graph.facebook.com/v20.0/${targetPageId}/leadgen_forms?fields=id,name,status&limit=500&access_token=${pageAccessToken}`
  
  const response = await fetch(formsUrl)
  const data = await response.json()

  if (data.error) {
    console.error('Erro Meta API:', data.error)
    throw new Error(`Erro ao conectar no Meta: ${data.error.message}`)
  }

  return data.data || []
}

// --- SERVER ACTIONS ---

// Sincroniza o catálogo manualmente (botão do modal)
export async function syncMetaFormsCatalog(organizacaoId) {
  const supabase = await createClient()

  try {
    const formsFromApi = await fetchFormsFromMetaAPI()
    
    if (!formsFromApi || formsFromApi.length === 0) {
      return { success: true, message: 'Nenhum formulário encontrado no Meta.' }
    }

    const upsertData = formsFromApi.map(form => ({
      organizacao_id: organizacaoId,
      form_id: form.id,
      name: form.name,
      status: form.status,
      last_synced: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('meta_forms_catalog')
      .upsert(upsertData, { 
        onConflict: 'organizacao_id,form_id',
        ignoreDuplicates: false 
      })

    if (error) throw error

    revalidatePath('/crm')
    return { success: true, count: formsFromApi.length }

  } catch (error) {
    console.error('Erro ao sincronizar formulários:', error)
    return { success: false, error: error.message }
  }
}

// Lista os formulários do catálogo
export async function getMetaFormsList(organizacaoId) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meta_forms_catalog')
    .select('form_id, name, last_synced')
    .eq('organizacao_id', organizacaoId)
    .eq('status', 'ACTIVE') 
    .order('last_synced', { ascending: false })

  if (error) {
    console.error('Erro ao buscar catálogo:', error)
    return []
  }

  return data.map(f => ({
    id: f.form_id,
    name: f.name,
    last_synced: f.last_synced
  }))
}

// NOVA VERSÃO: Lê direto da estrutura da tabela via RPC
export async function getSystemFieldsForMapping(organizacaoId) {
  const supabase = await createClient()

  // Chama a função SQL que criamos para listar as colunas reais
  const { data: columns, error } = await supabase.rpc('get_contatos_columns')

  if (error) {
    console.error('Erro ao ler colunas do banco:', error)
    return []
  }

  // Mapeia para o formato que o componente espera
  return columns.map(col => ({
    id: col.column_name, // O ID agora é o próprio nome da coluna (ex: 'renda_familiar')
    nome_exibicao: formatColumnName(col.column_name), // Ex: 'Renda Familiar'
    nome_coluna: col.column_name
  }))
}

// Busca perguntas do formulário (com filtro de ignorados)
export async function getFormQuestions(organizacaoId, metaFormId) {
  const supabase = await createClient()
  let token = process.env.META_PAGE_ACCESS_TOKEN

  // Tentativa 1: API do Meta
  if (token) {
    try {
      const url = `https://graph.facebook.com/v20.0/${metaFormId}?fields=questions&access_token=${token}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.questions && Array.isArray(data.questions)) {
        return data.questions
          .filter(q => q.key && !IGNORED_META_FIELDS.includes(q.key)) // APLICA O FILTRO
          .map(q => q.key)
      }
    } catch (e) {
      console.warn('Falha ao buscar perguntas na API, tentando fallback local...', e)
    }
  }

  // Tentativa 2: Banco de Dados (Último lead)
  const { data } = await supabase
    .from('contatos')
    .select('meta_form_data')
    .eq('organizacao_id', organizacaoId)
    .eq('meta_form_id', metaFormId)
    .not('meta_form_data', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (data?.meta_form_data) {
    return Object.keys(data.meta_form_data).filter(key => 
      !IGNORED_META_FIELDS.includes(key) // APLICA O FILTRO
    )
  }

  return []
}

// Busca mapeamentos salvos (Adaptado para campo_destino)
export async function getSavedMappings(organizacaoId, metaFormId) {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('meta_form_config')
    .select('id, meta_field_name, campo_destino')
    .eq('organizacao_id', organizacaoId)
    .eq('meta_form_id', metaFormId)

  // Adaptamos o retorno para o frontend não quebrar
  return (data || []).map(item => ({
    id: item.id,
    meta_field_name: item.meta_field_name,
    // O frontend espera campo_sistema_id, vamos passar o nome da coluna aqui
    campo_sistema_id: item.campo_destino 
  }))
}

// Salva mapeamento (Adaptado para campo_destino)
export async function saveMappingRule(organizacaoId, metaFormId, metaFieldName, campoDestino) {
  const supabase = await createClient()

  if (!campoDestino) {
    await supabase.from('meta_form_config').delete()
      .eq('organizacao_id', organizacaoId)
      .eq('meta_form_id', metaFormId)
      .eq('meta_field_name', metaFieldName)
    return { success: true }
  }

  const { data: existing } = await supabase.from('meta_form_config').select('id')
    .eq('organizacao_id', organizacaoId)
    .eq('meta_form_id', metaFormId)
    .eq('meta_field_name', metaFieldName)
    .single()

  if (existing) {
    // Atualiza a coluna de TEXTO agora
    await supabase.from('meta_form_config').update({ campo_destino: campoDestino }).eq('id', existing.id)
  } else {
    await supabase.from('meta_form_config').insert({
      organizacao_id: organizacaoId,
      meta_form_id: metaFormId,
      meta_field_name: metaFieldName,
      campo_destino: campoDestino // Salvando texto puro
    })
  }

  revalidatePath('/crm')
  return { success: true }
}