// Caminho: app/(main)/crm/capiActions.js
'use server';

import { createClient } from '@/utils/supabase/server';
import { sendMetaEvent } from '@/utils/metaCapi';
import { cookies } from 'next/headers';

/**
 * Verifica se a mudança de coluna deve disparar um evento para o Facebook (CAPI)
 * @param {string} contatoNoFunilId - ID do card no funil
 * @param {string} novaColunaId - ID da coluna para onde o card foi movido
 */
export async function verificarDisparoCapi(contatoNoFunilId, novaColunaId) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  try {
    // 1. Buscar o NOME da nova coluna
    const { data: colunaNova, error: erroColuna } = await supabase
      .from('colunas_funil')
      .select('nome')
      .eq('id', novaColunaId)
      .single();

    if (erroColuna || !colunaNova) return;

    // Normaliza o nome para evitar erros de digitação (ex: "Vendido " vira "VENDIDO")
    const nomeColuna = colunaNova.nome.trim().toUpperCase();

    // Se não for uma coluna de conversão, para por aqui e economiza recursos
    const colunasDeInteresse = ['VENDIDO', 'VENDA', 'PERDIDO', 'PERDA'];
    if (!colunasDeInteresse.includes(nomeColuna)) {
      return; 
    }

    // 2. Buscar dados do contato para o "Match Quality" do Facebook
    // Precisamos de Email e Telefone para o Facebook saber QUEM é a pessoa
    const { data: entry, error: erroContato } = await supabase
      .from('contatos_no_funil')
      .select(`
        contatos!inner (
          nome,
          razao_social,
          emails ( email ),
          telefones ( telefone )
        )
      `)
      .eq('id', contatoNoFunilId)
      .single();

    if (erroContato || !entry || !entry.contatos) {
      console.error('[CAPI] Erro ao buscar dados do contato:', erroContato);
      return;
    }

    const contato = entry.contatos;
    
    // Tratamento de dados para o Hash
    const nomeCompleto = contato.nome || contato.razao_social || 'Desconhecido';
    const partesNome = nomeCompleto.split(' ');
    const primeiroNome = partesNome[0];
    const sobrenome = partesNome.length > 1 ? partesNome.slice(1).join(' ') : '';
    
    // Pega o primeiro email e telefone disponíveis (prioridade para celular)
    const email = contato.emails?.[0]?.email;
    const telefone = contato.telefones?.[0]?.telefone;

    const userData = {
      email,
      telefone,
      primeiro_nome: primeiroNome,
      sobrenome: sobrenome
    };

    console.log(`[CAPI] 🚀 Disparando evento para coluna: ${nomeColuna}`);

    // 3. Disparo Cirúrgico
    if (nomeColuna === 'VENDIDO' || nomeColuna === 'VENDA') {
      // Evento de COMPRA (Purchase)
      // Se você tiver o valor da venda no card, podemos injetar aqui futuramente
      await sendMetaEvent('Purchase', userData, {
        currency: 'BRL',
        value: 0, // Ajuste se quiser passar um valor padrão ou buscar do contrato
        content_name: 'Imóvel Studio 57',
        status: 'Vendido'
      });
      console.log('✅ [CAPI] Evento PURCHASE enviado com sucesso!');
    } 
    else if (nomeColuna === 'PERDIDO' || nomeColuna === 'PERDA') {
      // Evento Customizado de Perda (Para o Facebook parar de gastar com esse perfil)
      await sendMetaEvent('LeadLost', userData, {
        status: 'Perdido'
      });
      console.log('📉 [CAPI] Evento LEAD LOST enviado.');
    }

  } catch (err) {
    console.error('[CAPI] Erro fatal no processamento:', err);
  }
}