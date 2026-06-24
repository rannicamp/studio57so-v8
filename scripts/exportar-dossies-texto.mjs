import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: emps, error } = await supabaseAdmin.from('empreendimentos')
    .select('id, nome, listado_para_venda, dossie_ia, observacoes, categoria')
    .eq('organizacao_id', 2);

  if (error) {
    console.error("Erro ao buscar empreendimentos:", error.message);
    return;
  }

  let markdownContent = `# 🏢 Dossiês Completos dos Empreendimentos - Studio 57\n\n`;
  markdownContent += `Este documento consolida os dossiês de todos os empreendimentos ativos da Org 2 (Studio 57) cadastrados no banco de dados para a inteligência cognitiva da Stella.\n\n---\n\n`;

  emps.forEach(e => {
    markdownContent += `## 🏗️ Empreendimento ID ${e.id}: ${e.nome}\n`;
    markdownContent += `* **Categoria:** ${e.categoria || 'Não informada'}\n`;
    markdownContent += `* **Listado para Venda:** ${e.listado_para_venda ? 'Sim' : 'Não'}\n`;
    markdownContent += `* **Observações no Banco:** ${e.observacoes || 'Nenhuma'}\n\n`;
    markdownContent += `### Dossiê Técnico IA:\n\n`;
    markdownContent += `${e.dossie_ia || '*Nenhum dossiê de IA cadastrado para este empreendimento.*'}\n\n`;
    markdownContent += `\n===================================================================\n\n`;
  });

  const targetPath = 'C:\\Users\\ranni\\.gemini\\antigravity\\brain\\0254b46f-ded9-44e2-9d20-658a8e0cad55\\dossies_empreendimentos_studio57.md';
  fs.writeFileSync(targetPath, markdownContent, 'utf-8');
  console.log(`Dossiês exportados com sucesso para: ${targetPath}`);
}

run();
