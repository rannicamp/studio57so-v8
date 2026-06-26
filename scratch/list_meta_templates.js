// scratch/list_meta_templates.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("=== BUSCANDO TEMPLATES DA META PARA A ORGANIZAÇÃO 2 ===");
  
  const { data: config, error: errC } = await supabase
    .from('configuracoes_whatsapp')
    .select('*')
    .eq('organizacao_id', 2)
    .limit(1)
    .maybeSingle();

  if (errC || !config) {
    console.error("Erro ao buscar configuração do WhatsApp:", errC || "Não encontrada");
    return;
  }

  const token = config.whatsapp_permanent_token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  const url = `https://graph.facebook.com/v20.0/${config.whatsapp_business_account_id}/message_templates?fields=name,status,category,language,components&limit=100`;

  try {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const resJson = await res.json();
      const templates = resJson.data || [];
      console.log(`Total de templates retornados: ${templates.length}`);
      
      const approved = templates.filter(t => t.status === 'APPROVED');
      console.log(`Total de templates APROVADOS: ${approved.length}`);

      let output = `=== TEMPLATES APROVADOS DA META (ORG 2) ===\n\n`;
      approved.forEach((t, i) => {
        output += `${i + 1}. Nome: ${t.name} | Categoria: ${t.category} | Idioma: ${t.language}\n`;
        output += `   Componentes:\n`;
        (t.components || []).forEach(comp => {
          output += `     - Tipo: ${comp.type}\n`;
          if (comp.text) output += `       Texto: "${comp.text}"\n`;
          if (comp.format) output += `       Formato: ${comp.format}\n`;
          if (comp.buttons) {
            output += `       Botões: ${JSON.stringify(comp.buttons)}\n`;
          }
        });
        output += `-`.repeat(60) + `\n`;
      });

      fs.writeFileSync('scratch/meta_templates.txt', output, 'utf-8');
      console.log("Salvo com sucesso em scratch/meta_templates.txt");
    } else {
      console.error("Erro na API da Meta. Status:", res.status);
      const errText = await res.text();
      console.error(errText);
    }
  } catch (err) {
    console.error("Erro crítico ao buscar templates:", err.message);
  }
}

main();
