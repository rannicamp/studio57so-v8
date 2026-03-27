const fs = require('fs');
const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function applyUserPrefs() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    
    try {
        await prod.connect();
        console.log('✅ Conectado ao banco de dados com bypass de SSL.');
        
        const sql = fs.readFileSync('supabase/migrations/20260327_create_user_notification_prefs.sql', 'utf8');
        
        await prod.query(sql);
        console.log('🚀 Tabela de preferências e RPC get_user_allowed_notifications criadas/atualizadas com sucesso!');
        
    } catch (err) {
        console.error('❌ Erro Fatal:', err.message);
    } finally {
        await prod.end();
    }
}

applyUserPrefs();
