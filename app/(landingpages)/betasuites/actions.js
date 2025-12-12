// Caminho: app/(landingpages)/studiosbeta/actions.js
'use server';

import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';

// =================================================================================
// O PORQUÊ DESTA FUNÇÃO (IDÊNTICA À SUA DO ALFA)
// Mantive sua função "à prova de balas" que garante que o funil e a coluna
// "Novos Leads" existam. Isso é essencial para o sistema funcionar corretamente.
// =================================================================================
async function ensureFunilAndFirstColumn(supabase, organizacaoId) {
  let { data: funil } = await supabase
    .from('funis')
    .select('id')
    .eq('nome', 'Funil de Vendas')
    .eq('organizacao_id', organizacaoId)
    .single();

  if (!funil) {
    const { data: newFunil, error } = await supabase
      .from('funis')
      .insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId })
      .select('id').single();
    if (error) throw new Error(`Erro ao criar funil: ${error.message}`);
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
    const { data: newColuna, error } = await supabase
      .from('colunas_funil')
      .insert({ funil_id: funil.id, nome: 'Novos Leads', ordem: 0, organizacao_id: organizacaoId })
      .select('id').single();
    if (error) throw new Error(`Erro ao criar coluna: ${error.message}`);
    primeiraColuna = newColuna;
  }

  return primeiraColuna.id;
}

// O PORQUÊ DAS MUDANÇAS:
// - Nome da função: Renomeei para 'salvarLeadBeta' para ficar específico.
// - Campos: Removi a variável 'email', pois o novo formulário não terá esse campo.
// - Origem: O valor do campo 'origem' é fixo para 'Landing Page - Studios Beta'.
// - Redirect: O redirecionamento no final aponta para a página de obrigado do Beta.
export async function salvarLeadBeta(formData) {
  const nome = formData.get('nome');
  const telefone = formData.get('telefone');
  const origem = 'Landing Page - Studios Beta'; // Origem fixa
  const supabase = createClient();

  try {
    const { data: orgData, error: orgError } = await supabase
      .from('organizacoes').select('id').limit(1).single();
    if (orgError || !orgData) throw new Error('Nenhuma organização padrão encontrada.');
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
      .select('id').single();
    if (contatoError) throw new Error(`Erro ao salvar o contato: ${contatoError.message}`);
    const contatoId = novoContato.id;
    
    // Salva apenas o telefone, removendo o e-mail
    if (telefone) {
      await supabase.from('telefones').insert({ 
        contato_id: contatoId, 
        telefone: telefone.replace(/\D/g, ''), // Limpa a máscara
        tipo: 'Celular', 
        organizacao_id: organizacaoId
      });
    }

    const colunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);

    await supabase.from('contatos_no_funil').insert({
      contato_id: contatoId,
      coluna_id: colunaId,
      organizacao_id: organizacaoId
    });
    
  } catch (error) {
    console.error('Falha crítica no processo de salvar lead da LP Beta:', error.message);
    // Em caso de erro, podemos redirecionar para uma página de erro ou de volta
    // Mas por enquanto, apenas logamos no servidor.
    return { message: 'Erro ao salvar o lead.' }; // Adicionado retorno para o formulário
  }
  
  // Redireciona para a página de obrigado do Beta
  redirect('/studiosbeta/obrigado');
}