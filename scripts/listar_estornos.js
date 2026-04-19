const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function listar() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: c1 } = await supabase.from('categorias_financeiras')
        .select('*')
        .ilike('nome', '%estorno%');
        
    const { data: c2 } = await supabase.from('categorias_financeiras')
        .select('*')
        .ilike('nome', '%transfer%');

    let md = "# Categorias de Estorno e Transferência\n\n";
    md += "### ⛔ ESTORNOS\n";
    md += "| ID | Nome da Categoria | Tipo | Organizacao |\n";
    md += "|---|---|---|---|\n";
    c1.forEach(c => {
        md += `| ${c.id} | ${c.nome} | ${c.tipo} | ${c.organizacao_id} |\n`;
    });

    md += "\n### 🔄 TRANSFERÊNCIAS\n";
    md += "| ID | Nome da Categoria | Tipo | Organizacao |\n";
    md += "|---|---|---|---|\n";
    c2.forEach(c => {
        md += `| ${c.id} | ${c.nome} | ${c.tipo} | ${c.organizacao_id} |\n`;
    });

    console.log("=== ARTEFATO ===");
    console.log(md);
    console.log("=== FIM ARTEFATO ===");
}

listar();
