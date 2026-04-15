import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buscarUltimoIndice } from '@/utils/bcbApi';
import { buscarUltimoInccFgv } from '@/utils/firecrawlIndicesApi';

export async function GET(request) {
  try {
    // 1. Validação de Segurança (Apenas quem tem a chave pode rodar o Cron)
    const authHeader = request.headers.get('authorization');
    const envSecret = process.env.CRON_SECRET;
    // Em dev, podemos ser mais lenientes, em prod exigimos.
    if (process.env.NODE_ENV === 'production' && envSecret) {
      if (authHeader !== `Bearer ${envSecret}`) {
        return NextResponse.json({ error: 'Não autorizado. CRON_SECRET inválido ou ausente.' }, { status: 401 });
      }
    }

    console.log('Iniciando sincronização (Cron Job) dos índices...');

    // 2. Conexão Admin com Supabase (Pois precisa injetar com id da Matriz ignorando o browser do usuário)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Credenciais do Supabase não configuradas no servidor.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Lista de todos osíndices mapeados na nossa biblioteca
    const listaParaSincronizar = ['IPCA', 'INPC', 'IGP-M', 'IGP-DI', 'INCC', 'IPC-FIPE', 'SELIC', 'CDI', 'TR'];
    const resultados = {
      sucesso: [],
      erros: [],
      ignorados: []
    };

    // 4. Executa a varredura um a um
    for (const indiceName of listaParaSincronizar) {
      try {
        let novoDado = null;

        // Se for INCC, nós ignoramos a lentidão do Banco Central e mandamos o IA Crawler ir na FGV Direto
        if (indiceName === 'INCC') {
           console.log(`[CRON] INCC Detectado: Engatilhando Inteligência de Scraping para a FGV...`);
           novoDado = await buscarUltimoInccFgv();
        }

        // Se a busca falhou ou se é outro índice genérico, caímos na segurança do SGS (Banco Central)
        if (!novoDado) {
           novoDado = await buscarUltimoIndice(indiceName);
        }

        if (novoDado) {
          // Tenta colocar no banco. Se for unique key violation (já temos este mes/ano cadastrado), o supbase rejeita e a gente pega o erro e ignora.
          const { error } = await supabaseAdmin
            .from('indices_governamentais')
            .insert([{
              nome_indice: novoDado.nome_indice,
              mes_ano: novoDado.mes_ano,
              data_referencia: novoDado.data_referencia,
              valor_mensal: novoDado.valor_mensal,
              descricao: novoDado.descricao,
              data_divulgacao_oficial: novoDado.data_divulgacao_oficial || null,
              organizacao_id: 1 // É da Matriz/Sistema
            }]);

          // Código postgres para Violação Constraint Unica (Já existe o registro que impede duplicidade mês a mês)
          if (error && error.code === '23505') {
            resultados.ignorados.push(`${novoDado.nome_indice} (${novoDado.mes_ano}) já estava atualizado.`);
          } else if (error) {
            resultados.erros.push(`Erro Supabase salvar ${indiceName}: ${error.message}`);
          } else {
            resultados.sucesso.push(`${novoDado.nome_indice} (${novoDado.mes_ano}) -> ${novoDado.valor_mensal}%`);
          }
        } else {
          resultados.erros.push(`APIs não retornaram nada para ${indiceName}.`);
        }

      } catch (falhaSinc) {
        resultados.erros.push(`Falha total em ${indiceName}: ${falhaSinc.message}`);
      }
      // Pausinha pequena para bater na API do governo sem gargalar (Boa prática Rate Limiting)
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('Processo de sincronização encerrado. Resumo:', resultados);

    return NextResponse.json({
      message: 'Sincronização em Lote Concluída',
      resumo: resultados
    }, { status: 200 });

  } catch (fatalError) {
    console.error('Fatal erro cron-sync:', fatalError);
    return NextResponse.json({ error: 'Falha interna na máquina cron.', detalhe: fatalError.message ? fatalError.message : String(fatalError)
    }, { status: 500 });
  }
}
