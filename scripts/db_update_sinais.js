const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function updateDatabase() {
    const password = process.env.SUPABASE_DB_PASSWORD || 'Srbr19010720@';
    const encodedPassword = encodeURIComponent(password);
    const DEV_URL_DIRECT = `postgresql://postgres:${encodedPassword}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;

    const client = new Client({
        connectionString: DEV_URL_DIRECT,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Atualizar todos os lançamentos existentes
        console.log("Atualizando base de dados histórica...");
        await client.query(`
            UPDATE lancamentos 
            SET valor = CASE 
                WHEN tipo = 'Despesa' THEN -ABS(valor)
                WHEN tipo = 'Receita' THEN ABS(valor)
                ELSE valor
            END
        `);
        console.log("Valores históricos atualizados.");

        // 2. Criar a função do Trigger
        console.log("Criando função de formatação de sinal...");
        await client.query(`
            CREATE OR REPLACE FUNCTION formatar_sinal_lancamento()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.tipo = 'Despesa' THEN
                    NEW.valor := -ABS(NEW.valor);
                ELSIF NEW.tipo = 'Receita' THEN
                    NEW.valor := ABS(NEW.valor);
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // 3. Criar ou Recriar o Trigger
        console.log("Criando trigger automático na tabela lancamentos...");
        await client.query(`
            DROP TRIGGER IF EXISTS trg_formatar_sinal_lancamento ON lancamentos;
            CREATE TRIGGER trg_formatar_sinal_lancamento
            BEFORE INSERT OR UPDATE ON lancamentos
            FOR EACH ROW EXECUTE FUNCTION formatar_sinal_lancamento();
        `);
        console.log("Trigger criado com sucesso.");

    } catch (e) {
        console.error("Erro ao alterar o banco:", e);
    } finally {
        await client.end();
    }
}

updateDatabase();
