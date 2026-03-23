require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from('feedback')
    .select('id, descricao, pagina, status, created_at, usuario:usuarios(nome, sobrenome)')
    .in('status', ['Novo', 'Em Análise'])
    .order('created_at', { ascending: false });

  if (error) {
      console.log('Erro:', error);
      return;
  }

  let md = "# 📋 Relatório de Chamados Pendentes (Ideias & Bugs)\n\n";
  md += "Este artefato lista todos os tickets que ainda não foram tratados/implementados no Kanban.\n\n";
  md += "| ID | O Que (Descrição) | Onde (Página/Módulo) | Quem (Autor) | Quando (Data e Hora) | Status |\n";
  md += "|:---:|:---|:---|:---|:---:|:---:|\n";

  data.forEach(p => {
      const nome = p.usuario ? `${p.usuario.nome} ${p.usuario.sobrenome || ''}`.trim() : 'Anônimo';
      const dataFormatada = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
      const desc = p.descricao.replace(/\n/g, ' - ');
      const pagina = p.pagina || 'Sem Origem Específica';
      md += `| #${p.id} | ${desc} | 📍 **${pagina}** | ${nome} | ${dataFormatada} | ${p.status} |\n`;
  });

  const caminho = 'C:/Users/Ranniere/.gemini/antigravity/brain/b8c2ec7e-2451-44f9-bd9c-69a71fe1ddcc/feedbacks_pendentes.md';
  console.log("MARKDOWN_GERADO_INICIO");
  console.log(md);
  console.log("MARKDOWN_GERADO_FIM");
}
run();
