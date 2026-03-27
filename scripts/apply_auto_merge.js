const fs = require('fs');
const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function applyAutoMergeRPC() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    
    try {
        await prod.connect();
        console.log('✅ Conectado ao banco de dados com bypass de SSL.');
        
        const sql = fs.readFileSync('supabase/migrations/20260327_fix_auto_merge_contacts.sql', 'utf8');
        
        await prod.query(sql);
        console.log('🚀 Função auto_merge_contacts_and_relink (ambiguidade limpa + blindagem) aplicada com sucesso!');
        
    } catch (err) {
        console.error('❌ Erro Fatal:', err.message);
    } finally {
        await prod.end();
    }
}

applyAutoMergeRPC();
