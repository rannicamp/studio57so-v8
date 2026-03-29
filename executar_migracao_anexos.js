import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function executarMigracao() {
  console.log("==================================================");
  console.log("🚀 INICIANDO MIGRAÇÃO NO SUPABASE [FASE 3 - UPDATE]");
  console.log("==================================================\n");

  const proposta = JSON.parse(fs.readFileSync('proposta_migracao.json', 'utf-8'));
  
  // Vamos filtrar apenas os que precisam de update
  const modificar = proposta.filter(p => 
    p.NOVO_NOME !== p.nome_antigo || 
    p.NOVA_ABA !== p.aba_antiga || 
    p.sigla_antiga !== p.NOVA_SIGLA_DB
  );

  console.log(`🧹 Encontrados ${modificar.length} anexos que precisam de limpeza na tabela.\n`);

  let atualizadosCount = 0;
  let erroCount = 0;

  for (let i = 0; i < modificar.length; i++) {
    const p = modificar[i];
    
    // Preparar o objeto de atualização
    const dadosUpdate = {
      nome_arquivo: p.NOVO_NOME,
      categoria_aba: p.NOVA_ABA
    };

    if (p.NOVO_TIPO_ID) {
      dadosUpdate.tipo_documento_id = p.NOVO_TIPO_ID;
    }

    // Executar update direto no ID do anexo usando SERVICE_ROLE
    const { error } = await supabase
      .from('empreendimento_anexos')
      .update(dadosUpdate)
      .eq('id', p.id);

    if (error) {
      console.error(`❌ Erro atualizando ID=${p.id} (${p.nome_antigo}):`, error.message);
      erroCount++;
    } else {
      process.stdout.write(`✅ [${i+1}/${modificar.length}] ID=${p.id} atualizado para Aba '${p.NOVA_ABA}'.\r`);
      atualizadosCount++;
    }

    // Delay super rápido pra não bugar a API do Supabase (Rate Limiting)
    await new Promise(res => setTimeout(res, 50)); 
  }

  console.log("\n\n==================================================");
  console.log("🎬 MIGRAÇÃO CONCLUÍDA!");
  console.log(`Sucessos: ${atualizadosCount} | Falhas: ${erroCount}`);
  console.log("==================================================");
}

executarMigracao();
