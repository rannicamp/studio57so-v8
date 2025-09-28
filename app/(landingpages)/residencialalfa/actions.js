// Caminho do arquivo: app/(landingpages)/residencialalfa/actions.js

'use server';

import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';

// =================================================================================
// O PORQUÊ DESTA FUNÇÃO EXTRA
// Esta função é a nossa "solução à prova de balas". Em vez de apenas procurar
// por um funil e uma coluna, ela GARANTE que eles existam.
// Se não encontrar um "Funil de Vendas" ou uma coluna "Novos Leads", ela os cria
// na hora. Isso torna o sistema muito mais robusto e evita falhas silenciosas
// como a que acabamos de ver.
// =================================================================================
async function ensureFunilAndFirstColumn(supabase, organizacaoId) {
    console.log(`[actions.js] Garantindo funil e coluna para a organização: ${organizacaoId}`);

    // Primeiro, busca um funil com o nome padrão "Funil de Vendas"
    let { data: funil } = await supabase
        .from('funis')
        .select('id')
        .eq('nome', 'Funil de Vendas')
        .eq('organizacao_id', organizacaoId)
        .single();

    // Se não encontrar, cria um
    if (!funil) {
        console.log(`[actions.js] Funil não encontrado. Criando 'Funil de Vendas'...`);
        const { data: newFunil, error: funilCreateError } = await supabase
            .from('funis')
            .insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId })
            .select('id')
            .single();
        if (funilCreateError) throw new Error(`Erro ao criar funil: ${funilCreateError.message}`);
        funil = newFunil;
    }

    // Agora, busca a primeira coluna do funil
    let { data: primeiraColuna } = await supabase
        .from('colunas_funil')
        .select('id')
        .eq('funil_id', funil.id)
        .order('ordem', { ascending: true })
        .limit(1)
        .single();

    // Se não encontrar nenhuma coluna, cria a coluna de entrada "Novos Leads"
    if (!primeiraColuna) {
        console.log(`[actions.js] Nenhuma coluna encontrada. Criando 'Novos Leads'...`);
        const { data: newColuna, error: colunaCreateError } = await supabase
            .from('colunas_funil')
            .insert({ funil_id: funil.id, nome: 'Novos Leads', ordem: 0, organizacao_id: organizacaoId })
            .select('id')
            .single();
        if (colunaCreateError) throw new Error(`Erro ao criar coluna: ${colunaCreateError.message}`);
        primeiraColuna = newColuna;
    }

    // Retorna o ID da coluna que garantimos que existe
    return primeiraColuna.id;
}


export async function salvarLead(formData) {
  const nome = formData.get('nome');
  const email = formData.get('email');
  const telefone = formData.get('telefone');
  const origem = formData.get('origem');
  const supabase = createClient();

  try {
    // 1. Busca a organização padrão para associar o novo lead.
    const { data: orgData, error: orgError } = await supabase
      .from('organizacoes')
      .select('id')
      .limit(1)
      .single();

    if (orgError || !orgData) {
      throw new Error('Nenhuma organização padrão foi encontrada no sistema.');
    }
    const organizacaoId = orgData.id;

    // 2. Cria o novo contato.
    const { data: novoContato, error: contatoError } = await supabase
      .from('contatos')
      .insert({
        nome: nome,
        origem: origem,
        tipo_contato: 'Lead',
        personalidade_juridica: 'Pessoa Física',
        organizacao_id: organizacaoId
      })
      .select('id')
      .single();

    if (contatoError) {
      throw new Error(`Erro ao salvar o contato: ${contatoError.message}`);
    }
    const contatoId = novoContato.id;

    // 3. Salva email e telefone.
    if (email) {
      await supabase.from('emails').insert({ 
        contato_id: contatoId, email: email, tipo: 'Principal', organizacao_id: organizacaoId 
      });
    }
    if (telefone) {
      await supabase.from('telefones').insert({ 
        contato_id: contatoId, telefone: telefone.replace(/\D/g, ''), tipo: 'Celular', organizacao_id: organizacaoId
      });
    }

    // 4. CHAMA NOSSA NOVA FUNÇÃO "À PROVA DE BALAS"
    const colunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);

    // 5. Insere o card do lead no funil na coluna correta.
    await supabase
      .from('contatos_no_funil')
      .insert({
        contato_id: contatoId,
        coluna_id: colunaId,
        organizacao_id: organizacaoId
      });
    
    console.log(`[actions.js] Sucesso TOTAL! Lead ${contatoId} inserido no CRM na coluna ${colunaId}.`);

  } catch (error) {
    console.error('Falha crítica no processo de salvar lead da landing page:', error.message);
  }
  
  // 6. Redireciona o usuário para a página de agradecimento.
  redirect('/residencialalfa/obrigado');
}