require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Ranniere ID: 90c6c1d4-8d9f-4d56-a663-8d84181be3c2 (rannierecampos1@hotmail.com)
  const ranniereId = '90c6c1d4-8d9f-4d56-a663-8d84181be3c2'; 
  
  // Mikaelly ID Funcionário: 13 | Contato ID: 4818
  // Empreendimento ID: 5 (Beta Suítes)
  // Organizacao ID: 2

  const hoje = '2026-05-28'; // Data tratada como string conforme Regra de Ouro do Studio 57
  const amanha = '2026-05-29'; // Data tratada como string conforme Regra de Ouro do Studio 57

  console.log("=== CRIANDO ATIVIDADE ===");
  const { data, error } = await supabase
    .from('activities')
    .insert([
      {
        nome: 'Tour 360 Beta Suítes',
        descricao: 'Produzir e organizar os novos renders e materiais em alta resolução (4K/8K) do Tour 360º do empreendimento Beta Suítes.',
        funcionario_id: 13, // ID da tabela funcionarios para a Mikaelly
        contato_id: 4818, // ID da tabela contatos correspondente
        responsavel_texto: 'Mikaelly Tetzner dos Santos Brunow',
        empreendimento_id: 5, // Beta Suítes
        data_inicio_prevista: hoje,
        data_fim_prevista: amanha,
        duracao_dias: 2,
        tipo_atividade: 'Marketing',
        status: 'Não iniciado',
        organizacao_id: 2,
        criado_por_usuario_id: ranniereId
      }
    ])
    .select();

  if (error) {
    console.error("Erro ao criar atividade:", error);
  } else {
    console.log("Atividade criada com sucesso:", data);
  }
}

run();
