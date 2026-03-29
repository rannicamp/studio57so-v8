import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Carrega as variáveis do .env.local
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnosis() {
  console.log("==========================================");
  console.log("🔍 INICIANDO DIAGNÓSTICO DE ANEXOS HISTÓRICOS");
  console.log("==========================================\n");

  // 1. Puxar todos os Tipos
  const { data: tipos, error: errTipos } = await supabase
    .from('documento_tipos')
    .select('id, sigla, descricao');

  if (errTipos) {
    console.error("Erro ao buscar tipos:", errTipos);
    return;
  }

  // 2. Puxar todos os Anexos de Empreendimentos (mesmo que não tenham tipo)
  const { data: anexos, error: errAnexos } = await supabase
    .from('empreendimento_anexos')
    .select('id, nome_arquivo, categoria_aba, tipo_documento_id, caminho_arquivo');

  if (errAnexos) {
    console.error("Erro ao buscar anexos:", errAnexos);
    return;
  }

  console.log(`📊 Total de Anexos no Banco: ${anexos.length}`);
  console.log(`📑 Total de Tipos de Documentos Oficiais: ${tipos.length}\n`);

  let logContent = "========= ANÁLISE DOS ARQUIVOS SALVOS =========\n";
  
  if(anexos.length === 0){
      console.log("Nenhum arquivo encontrado na nuvem para analisar. A base está totalmente virgem.");
      return;
  }

  // Criar um mapeamento base de diagnóstico
  const diagnosticoJson = anexos.map(a => {
    const tipo = tipos.find(t => t.id === a.tipo_documento_id) || { sigla: 'NULL', descricao: 'Sem tipo assinalado' };
    return {
      id: a.id,
      nome_atual: a.nome_arquivo,
      aba_atual: a.categoria_aba || 'Nenhuma (NULL)',
      tipo_atual_sigla: tipo.sigla,
      tipo_atual_desc: tipo.descricao
    };
  });

  fs.writeFileSync('diagnostico_anexos.json', JSON.stringify(diagnosticoJson, null, 2), 'utf-8');

  console.log("\n==========================================");
  console.log("🧐 FIM DO DIAGNÓSTICO! Arquivo 'diagnostico_anexos.json' gerado com sucesso.");
  console.log("==========================================");

}

runDiagnosis();
