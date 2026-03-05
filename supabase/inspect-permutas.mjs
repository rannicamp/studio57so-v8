// Inspeciona os registros em contrato_permutas e busca o ID da conta de ativo
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: decodeURIComponent('postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres'),
    ssl: { rejectUnauthorized: false }
});
await client.connect();

const permutas = await client.query(`
    SELECT id, descricao, valor_permutado, data_registro, contrato_id, organizacao_id
    FROM public.contrato_permutas
    ORDER BY data_registro DESC
    LIMIT 20
`);
console.log('\n📋 Registros em contrato_permutas:');
console.table(permutas.rows);

const contasAtivo = await client.query(`
    SELECT id, nome, tipo FROM public.contas_financeiras
    WHERE tipo IN ('Conta de Ativo', 'Conta de Passivo')
    ORDER BY nome
`);
console.log('\n🏦 Contas patrimoniais cadastradas:');
console.table(contasAtivo.rows);

await client.end();
