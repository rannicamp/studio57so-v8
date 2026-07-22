// scripts/reorganizar_beta_suites_ativos.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = "C:\\Users\\ranni\\.gemini\\antigravity\\brain\\b7506348-c729-448b-a8ec-dad32ef8f01b";

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey);

  console.log("1. Atribuindo Ranniere (ID 1) às tarefas ativas sem responsável no Beta Suítes...");
  
  // Busca tarefas ativas do Beta Suítes sem responsável
  const { data: actsNoResp, error: findError } = await supabase
    .from('activities')
    .select('id, nome')
    .eq('empreendimento_id', 5)
    .eq('organizacao_id', 2)
    .not('status', 'in', '("Concluído","Cancelado")')
    .is('funcionario_id', null)
    .or('responsavel_texto.is.null,responsavel_texto.eq.');

  if (findError) {
    console.error("Erro ao buscar tarefas sem responsável:", findError);
    return;
  }

  console.log(`Encontradas ${actsNoResp.length} tarefas sem responsável para atualizar.`);

  for (const act of actsNoResp) {
    const { error: updateError } = await supabase
      .from('activities')
      .update({ funcionario_id: 1, responsavel_texto: null })
      .eq('id', act.id);

    if (updateError) {
      console.error(`Erro ao atualizar tarefa ID ${act.id}:`, updateError);
    } else {
      console.log(`Tarefa ID ${act.id} ("${act.nome}") agora está sob sua responsabilidade.`);
    }
  }

  console.log("\n2. Buscando apenas as tarefas ativas do Beta Suítes...");
  const { data: activeActs, error: searchError } = await supabase
    .from('activities')
    .select(`
      id, nome, status, data_inicio_prevista, data_fim_prevista, responsavel_texto,
      funcionario_id, atividade_pai_id,
      funcionarios(full_name)
    `)
    .eq('empreendimento_id', 5)
    .eq('organizacao_id', 2)
    .not('status', 'in', '("Concluído","Cancelado")');

  if (searchError) {
    console.error("Erro ao buscar tarefas ativas:", searchError);
    return;
  }

  console.log(`Encontradas ${activeActs.length} tarefas ativas.`);

  // Lógica de estruturação hierárquica (Pai -> Filhos) das ativas
  const map = new Map();
  const roots = [];

  activeActs.forEach(act => {
    map.set(act.id, { ...act, children: [] });
  });

  activeActs.forEach(act => {
    const item = map.get(act.id);
    if (act.atividade_pai_id && map.has(act.atividade_pai_id)) {
      map.get(act.atividade_pai_id).children.push(item);
    } else {
      roots.push(item);
    }
  });

  const flatten = (nodes, depth = 0) => {
    let list = [];
    const sorted = [...nodes].sort((a, b) => {
      if (a.data_inicio_prevista !== b.data_inicio_prevista) {
        if (!a.data_inicio_prevista) return 1;
        if (!b.data_inicio_prevista) return -1;
        return a.data_inicio_prevista < b.data_inicio_prevista ? -1 : 1;
      }
      return a.id - b.id;
    });

    sorted.forEach(node => {
      list.push({ ...node, depth });
      if (node.children && node.children.length > 0) {
        list = list.concat(flatten(node.children, depth + 1));
      }
    });
    return list;
  };

  const structuredActs = flatten(roots);

  // 3. Escrever o relatório markdown
  let md = `# 📋 Atividades Ativas (Em Andamento / Pendentes) - Beta Suítes\n\n`;
  md += `Relatório gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
  md += `Total de atividades ativas: **${structuredActs.length}**\n\n`;
  md += `| ID | Atividade | Status | Data Início | Data Fim | Responsável | Atividade Pai |\n`;
  md += `| :---: | :--- | :---: | :---: | :---: | :--- | :--- |\n`;

  for (const act of structuredActs) {
    const indent = act.depth > 0 ? "    ".repeat(act.depth) + "↳ " : "";
    const resp = act.funcionarios?.full_name || act.responsavel_texto || "Sem responsável";
    const start = act.data_inicio_prevista ? act.data_inicio_prevista.split('-').reverse().join('/') : "-";
    const end = act.data_fim_prevista ? act.data_fim_prevista.split('-').reverse().join('/') : "-";
    
    let paiNome = "-";
    if (act.atividade_pai_id) {
      // Busca o pai dentro de TODAS as atividades da obra (pode ser que o pai esteja concluído e não esteja na lista de ativas!)
      const { data: paiObj } = await supabase.from('activities').select('nome').eq('id', act.atividade_pai_id).single();
      paiNome = paiObj ? `${paiObj.nome} (#${act.atividade_pai_id})` : `ID ${act.atividade_pai_id}`;
    }

    md += `| ${act.id} | ${indent}${act.nome} | ${act.status} | ${start} | ${end} | ${resp} | ${paiNome} |\n`;
  }

  const outputPath = path.join(ARTIFACT_DIR, 'atividades_ativas_beta_suites.md');
  fs.writeFileSync(outputPath, md, 'utf8');
  console.log(`SUCESSO: Novo relatório atividades_ativas_beta_suites.md gerado!`);
}

run();
