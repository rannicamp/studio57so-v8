const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== INICIANDO VALIDAÇÃO DE REAGENDAMENTO INTELIGENTE ===");

  const contatoId = 5598; // Ranniere
  const organizacaoId = 2; // Studio 57

  try {
    await client.query("BEGIN");

    // Obter o ID do usuário Stella para a Org 2
    const resUser = await client.query(`
      SELECT id FROM public.usuarios 
      WHERE email = 'stella.org2@elo57.com.br' AND organizacao_id = $1
    `, [organizacaoId]);

    if (resUser.rows.length === 0) {
      throw new Error("Usuário Stella (stella.org2@elo57.com.br) não encontrado no banco.");
    }
    const stellaUserId = resUser.rows[0].id;
    console.log(`[OK] Usuário Stella encontrado. ID: ${stellaUserId}`);

    // 1. Limpar atividades pendentes da Stella para o contato de teste antes de iniciar
    await client.query(`
      DELETE FROM public.activities 
      WHERE contato_id = $1 AND responsavel_texto = 'Stella IA' AND status = 'Não iniciado'
    `, [contatoId]);
    console.log("[OK] Limpeza inicial de atividades de teste realizada.");

    // 2. Simular primeiro agendamento (Ex: Cliente quer ser chamado amanhã às 08:00)
    console.log("\n--- Simulação do Primeiro Agendamento ---");
    const agendamento1 = {
      nome: "Chamar Ranniere às 8:00",
      descricao: "Conversa sobre o Residencial Alfa",
      data_inicio_prevista: "2026-06-08",
      hora_inicio: "08:00:00"
    };

    // Lógica equivalente à implementada no backend:
    // 2.1 Buscar atividade pendente
    const resExist1 = await client.query(`
      SELECT id, data_inicio_prevista, hora_inicio FROM public.activities
      WHERE contato_id = $1 AND responsavel_texto = 'Stella IA' AND status = 'Não iniciado'
    `, [contatoId]);

    let actId1;
    if (resExist1.rows.length > 0) {
      console.log("[ERRO] Não deveria existir atividade pendente neste ponto.");
    } else {
      console.log("[OK] Nenhuma atividade pendente encontrada. Criando novo registro (INSERT)...");
      const insertRes = await client.query(`
        INSERT INTO public.activities (
          contato_id, organizacao_id, criado_por_usuario_id, funcionario_id,
          nome, descricao, data_inicio_prevista, data_fim_prevista, hora_inicio,
          tipo_atividade, duracao_horas, duracao_dias, status, responsavel_texto
        )
        VALUES ($1, $2, $3, null, $4, $5, $6, $6, $7, 'Evento', 1.0, 0, 'Não iniciado', 'Stella IA')
        RETURNING id
      `, [contatoId, organizacaoId, stellaUserId, agendamento1.nome, agendamento1.descricao, agendamento1.data_inicio_prevista, agendamento1.hora_inicio]);
      actId1 = insertRes.rows[0].id;
      console.log(`[OK] Atividade criada com ID: ${actId1}`);
    }

    // 3. Simular segundo agendamento consecutivamente (Ex: Cliente muda o horário para 10:00)
    console.log("\n--- Simulação do Segundo Agendamento (Reagendamento) ---");
    const agendamento2 = {
      nome: "Chamar Ranniere às 10:00 (MUDOU)",
      descricao: "Conversa sobre o Residencial Alfa - Ajustado",
      data_inicio_prevista: "2026-06-08",
      hora_inicio: "10:00:00"
    };

    // 3.1 Buscar atividade pendente
    const resExist2 = await client.query(`
      SELECT id, data_inicio_prevista, hora_inicio FROM public.activities
      WHERE contato_id = $1 AND responsavel_texto = 'Stella IA' AND status = 'Não iniciado'
    `, [contatoId]);

    if (resExist2.rows.length > 0) {
      const existingAct = resExist2.rows[0];
      console.log(`[OK] Atividade pendente encontrada (ID: ${existingAct.id})! Reagendando (UPDATE) de ${existingAct.data_inicio_prevista} às ${existingAct.hora_inicio} para ${agendamento2.data_inicio_prevista} às ${agendamento2.hora_inicio}...`);
      
      await client.query(`
        UPDATE public.activities
        SET nome = $1, descricao = $2, data_inicio_prevista = $3, data_fim_prevista = $3, hora_inicio = $4
        WHERE id = $5
      `, [agendamento2.nome, agendamento2.descricao, agendamento2.data_inicio_prevista, agendamento2.hora_inicio, existingAct.id]);
      
      console.log(`[OK] Atividade ID ${existingAct.id} atualizada com sucesso.`);
    } else {
      console.log("[ERRO] Deveria ter encontrado a atividade do passo anterior.");
    }

    // 4. Validação final no banco dentro da transação
    console.log("\n--- Validação Final ---");
    
    // Contar total de atividades não iniciadas da Stella para o contato
    const resCount = await client.query(`
      SELECT COUNT(*) as total FROM public.activities
      WHERE contato_id = $1 AND responsavel_texto = 'Stella IA' AND status = 'Não iniciado'
    `, [contatoId]);
    const total = parseInt(resCount.rows[0].total);
    console.log(`Quantidade de atividades pendentes após os testes: ${total}`);

    // Buscar a atividade para verificar as informações
    const resAct = await client.query(`
      SELECT id, nome, descricao, data_inicio_prevista, hora_inicio FROM public.activities
      WHERE contato_id = $1 AND responsavel_texto = 'Stella IA' AND status = 'Não iniciado'
    `, [contatoId]);
    console.log("Detalhes da atividade salva no banco:", resAct.rows[0]);

    if (total === 1 && resAct.rows[0].hora_inicio === '10:00:00') {
      console.log("\n🏆 SUCESSO: Apenas 1 atividade pendente registrada e os dados foram reagendados corretamente!");
    } else {
      console.log("\n❌ FALHA: Comportamento inesperado na validação.");
    }

    await client.query("ROLLBACK");
    console.log("\n[OK] Rollback da transação executado. Banco mantido limpo.");
  } catch (err) {
    console.error("Erro no teste:", err);
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
}

run().catch(console.error);
