const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function runSQL() {
  const client = new Client({
      connectionString: decodeURIComponent(STUDIO_URL),
      ssl: SSL
  });
  
  try {
     console.log("Conectando ao banco...");
     await client.connect();
     
     // 1. Achar o empreendimento
     const resEmp = await client.query("SELECT * FROM empreendimentos WHERE nome ILIKE $1", ['%alfa%']);
     if (resEmp.rows.length === 0) {
         console.log("Empreendimento 'alfa' não encontrado.");
         return;
     }
     
     const alfa = resEmp.rows[0];
     console.log("Empreendimento encontrado:", alfa.nome, "ID:", alfa.id);
     
     let output = `# Dados Brutos - ${alfa.nome}\n\n`;
     output += `## Tabela: empreendimentos\n`;
     output += '```json\n' + JSON.stringify(alfa, null, 2) + '\n```\n\n';
     
     // 2. Achar todas as tabelas com a coluna 'empreendimento_id'
     const resCols = await client.query(`
         SELECT table_name 
         FROM information_schema.columns 
         WHERE column_name = 'empreendimento_id' 
         AND table_schema = 'public'
     `);
     
     const tables = resCols.rows.map(r => r.table_name);
     console.log(`Encontradas ${tables.length} tabelas com 'empreendimento_id'`);
     
     // 3. Buscar dados em cada tabela
     for (const table of tables) {
         try {
             const resTable = await client.query(`SELECT * FROM ${table} WHERE empreendimento_id = $1`, [alfa.id]);
             if (resTable.rows.length > 0) {
                 output += `## Tabela: ${table} (${resTable.rows.length} registros)\n`;
                 output += '```json\n' + JSON.stringify(resTable.rows, null, 2) + '\n```\n\n';
             }
         } catch(e) {
             console.log(`Erro ao buscar na tabela ${table}: ${e.message}`);
         }
     }
     
     // 4. Salvar em arquivo
     fs.writeFileSync('.agents/residencial_alfa/dados_brutos.md', output);
     console.log("Dados extraídos e salvos em .agents/residencial_alfa/dados_brutos.md");

  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
