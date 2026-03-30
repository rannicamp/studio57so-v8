import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const pad = (num) => num.toString().padStart(2, '0');
const formatDateStr = (dateStr) => {
    const d = new Date(dateStr);
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};

async function checkContato(nomeLike) {
    const { data: contatos } = await supabase.from('contatos').select('id, nome').ilike('nome', `%${nomeLike}%`);
    if (!contatos || contatos.length === 0) {
        return { nomeLike, contatos: [], lancamentos: [] };
    }
    
    // Pega as receitas desse contato
    const devIds = contatos.map(c => c.id);
    const { data: lancs } = await supabase.from('lancamentos')
        .select('*')
        .eq('tipo', 'Receita')
        .in('favorecido_contato_id', devIds)
        .order('data_vencimento', { ascending: true });
        
    return { nomeLike, contatos, lancamentos: lancs || [] };
}

async function main() {
    console.log("🕵️ Investigando Karina e Paulo Roberto minuciosamente...");
    
    let content = `# 🕵️ Investigação Dossiê: Karina e Paulo (Lote 26/11)\n\n`;

    const resKarina = await checkContato("KARINA LUCAS");
    const resPaulo = await checkContato("PAULO ROBERTO GOVEA");
    
    const results = [resKarina, resPaulo];

    for (let res of results) {
        content += `## 🔍 Alvo: ${res.nomeLike}\n`;
        if (res.contatos.length === 0) {
            content += `⚠️ **ALERTA: NENHUM CONTATO ENCONTRADO para '${res.nomeLike}'.**\n\n`;
            continue;
        }
        
        content += `✅ Encontrados ${res.contatos.length} contatos.\n`;
        res.contatos.forEach(c => content += `- \`${c.id}\` - ${c.nome}\n`);
        
        content += `\n### Lançamentos no Banco:\n`;
        content += `| ID Boleto | Vencimento | Valor | Conta Atual | Agrupamento de Antecipação |\n`;
        content += `| --- | --- | --- | --- | --- |\n`;
        for (let l of res.lancamentos) {
            let trDate = formatDateStr(l.data_vencimento);
            let ant = l.antecipacao_grupo_id ? '🔴 Sim' : '🟢 Não';
            content += `| \`${l.id}\` | ${trDate} | R$ ${l.valor} | ${l.conta_id} | ${ant} |\n`;
        }
        content += `\n---\n`;
    }

    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/DOSSIE_FANTASMAS_2611.md', content);
    console.log("✅ Dossiê gerado com sucesso!");
}

main().catch(console.error);
