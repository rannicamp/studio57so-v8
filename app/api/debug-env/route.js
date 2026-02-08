import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  console.log("--- INICIANDO DIAGNÓSTICO DE AMBIENTE ---");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const metaPageAccessToken = process.env.META_PAGE_ACCESS_TOKEN; // Chave para buscar o lead
  const metaVerifyToken = process.env.META_VERIFY_TOKEN; // Chave para verificar o webhook

  const debugInfo = {
    variaveis_de_ambiente: {
      SUPABASE_URL_ENCONTRADA: !!supabaseUrl,
      SUPABASE_SERVICE_KEY_ENCONTRADA: !!serviceRoleKey,
      META_PAGE_ACCESS_TOKEN_ENCONTRADO: !!metaPageAccessToken,
      META_VERIFY_TOKEN_ENCONTRADO: !!metaVerifyToken,
    },
    teste_conexao_supabase: {
      status: 'Não testado',
      detalhes: ''
    }
  };

  if (!!supabaseUrl && !!serviceRoleKey) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      // Tenta fazer uma consulta simples para validar a conexão e permissões
      const { data, error } = await supabaseAdmin.from('funis').select('id').limit(1);
      
      if (error) {
        throw error;
      }
      
      debugInfo.teste_conexao_supabase.status = 'SUCESSO';
      debugInfo.teste_conexao_supabase.detalhes = 'Conexão com o banco de dados e leitura da tabela "funis" bem-sucedida.';
      console.log("DIAGNÓSTICO: Conexão com Supabase OK.");

    } catch (error) {
      debugInfo.teste_conexao_supabase.status = 'FALHA';
      debugInfo.teste_conexao_supabase.detalhes = `Erro ao conectar ou consultar o Supabase: ${error.message}`;
      console.error("DIAGNÓSTICO: Falha na conexão com Supabase.", error);
    }
  } else {
    debugInfo.teste_conexao_supabase.status = 'PULADO';
    debugInfo.teste_conexao_supabase.detalhes = 'Teste pulado pois as variáveis do Supabase não foram encontradas.';
  }

  console.log("--- FIM DO DIAGNÓSTICO ---");
  return NextResponse.json(debugInfo);
}