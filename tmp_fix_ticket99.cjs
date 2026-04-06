const { Client } = require('pg');

const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function runSQL() {
  const client = new Client({
      connectionString: decodeURIComponent(STUDIO_URL),
      ssl: SSL
  });
  
  try {
     console.log("Estabelecendo link com Supabase oficial...");
     await client.connect();
     
     // 1. Procurar todos os triggers vinculados em funcionarios
     const resTriggers = await client.query("SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE event_object_table IN ('funcionarios', 'historico_salarial');");
     console.log("🔥 Triggers Encontrados antes da Deleção:");
     console.table(resTriggers.rows);
     
     const triggersFuncionarios = resTriggers.rows.filter(t => t.event_object_table === 'funcionarios');
     for(let t of triggersFuncionarios) {
         if (t.trigger_name.includes('salar') || t.trigger_name.includes('provis')) {
             console.log(`Removendo Trigger de Folha: ${t.trigger_name}...`);
             await client.query(`DROP TRIGGER IF EXISTS "${t.trigger_name}" ON funcionarios;`);
         }
     }

     const triggersHistorico = resTriggers.rows.filter(t => t.event_object_table === 'historico_salarial');
     for(let t of triggersHistorico) {
         if (t.trigger_name.includes('salar') || t.trigger_name.includes('provis')) {
             console.log(`Removendo Trigger de Historico: ${t.trigger_name}...`);
             await client.query(`DROP TRIGGER IF EXISTS "${t.trigger_name}" ON historico_salarial;`);
         }
     }

     console.log("⚡ Dropando Funções Inúteis da Folha...");
     await client.query(`DROP FUNCTION IF EXISTS public.trigger_agendar_salarios_novofuncionario() CASCADE;`);
     await client.query(`DROP FUNCTION IF EXISTS public.agendar_salario_provisionado(bigint, date) CASCADE;`);
     await client.query(`DROP FUNCTION IF EXISTS public.trigger_limpar_provisoes_demissao() CASCADE;`);
     await client.query(`DROP FUNCTION IF EXISTS public.limpar_provisoes_demissao() CASCADE;`);

     console.log("🚀 Criando Função Exclusão Atômica (Cascata Lógica)...");
     
     const createRpcSql = `
     CREATE OR REPLACE FUNCTION public.excluir_lancamento_financeiro(p_lancamento_id bigint, p_organizacao_id bigint)
     RETURNS boolean
     LANGUAGE plpgsql
     SECURITY DEFINER
     AS $$
     BEGIN
         -- 1. Certificar que o lançamento pertence a esta organziacao
         IF NOT EXISTS (SELECT 1 FROM public.lancamentos WHERE id = p_lancamento_id AND organizacao_id = p_organizacao_id) THEN
            RAISE EXCEPTION 'Lançamento Inexistente ou Permissão Negada.';
         END IF;

         -- 2. Limpar logs e anexos atrelados
         DELETE FROM public.auditoria_ia_logs WHERE lancamento_id = p_lancamento_id;
         DELETE FROM public.lancamentos_anexos WHERE lancamento_id = p_lancamento_id;
         DELETE FROM public.historico_lancamentos_financeiros WHERE lancamento_id = p_lancamento_id;
         
         -- 3. Desvincular e Pender dependências externas baseadas em Folha/Vales/Parcelas/OFX
         UPDATE public.banco_de_horas 
         SET lancamento_id = NULL, status = 'Aguardando' 
         WHERE lancamento_id = p_lancamento_id;

         UPDATE public.vales_agendados 
         SET lancamento_id = NULL, status = 'Agendado' 
         WHERE lancamento_id = p_lancamento_id;

         UPDATE public.banco_transacoes_ofx 
         SET lancamento_id = NULL, status = 'Pendente' 
         WHERE lancamento_id = p_lancamento_id;

         UPDATE public.contrato_parcelas 
         SET lancamento_id = NULL, status = 'Pendente' 
         WHERE lancamento_id = p_lancamento_id;
         
         -- 4. Excluir o lançamento propriamente dito
         DELETE FROM public.lancamentos WHERE id = p_lancamento_id;

         RETURN TRUE;
     END;
     $$;
     `;
     await client.query(createRpcSql);

     console.log("✅ Operação SQL finalizada com sucesso!");
  } catch(e) {
     console.error("❌ FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
