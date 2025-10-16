// Caminho do arquivo: app/(landingpages)/refugiobraunas/actions.js
'use server';

import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';

async function ensureFunilAndFirstColumn(supabase, organizacaoId) {
    console.log(`[actions.js] Garantindo funil e coluna para a organização: ${organizacaoId}`);

    let { data: funil } = await supabase
        .from('funis')
        .select('id')
        .eq('nome', 'Funil de Vendas')
        .eq('organizacao_id', organizacaoId)
        .single();

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

    let { data: primeiraColuna } = await supabase
        .from('colunas_funil')
        .select('id')
        .eq('funil_id', funil.id)
        .order('ordem', { ascending: true })
        .limit(1)
        .single();

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

    return primeiraColuna.id;
}


export async function salvarLead(formData) {
  const nome = formData.get('nome');
  const email = formData.get('email');
  const telefone = formData.get('telefone');
  const origem = formData.get('origem'); // Ex: "Modal - Book Refúgio Braúnas"
  const supabase = createClient();

  try {
    const { data: orgData, error: orgError } = await supabase
      .from('organizacoes')
      .select('id')
      .limit(1)
      .single();

    if (orgError || !orgData) {
      throw new Error('Nenhuma organização padrão foi encontrada no sistema.');
    }
    const organizacaoId = orgData.id;

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

    const colunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);

    await supabase
      .from('contatos_no_funil')
      .insert({
        contato_id: contatoId,
        coluna_id: colunaId,
        organizacao_id: organizacaoId
      });
    
    console.log(`[actions.js] Sucesso! Lead ${contatoId} do Refúgio Braúnas inserido no CRM.`);

  } catch (error) {
    console.error('Falha crítica no processo de salvar lead da landing page:', error.message);
  }
  
  redirect('/refugiobraunas/obrigado');
}