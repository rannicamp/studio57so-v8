// =========================================================
//  Migra registros de contrato_permutas -> lancamentos
//  vinculando à "Conta de Ativos Imobiliários" (id=48)
//  Uso: node supabase/migrar-permutas-para-ativos.mjs
// =========================================================
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: decodeURIComponent('postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres'),
    ssl: { rejectUnauthorized: false }
});
await client.connect();
console.log('✅ Conectado!\n');

// 1. Ver o que vai ser migrado
const preview = await client.query(`
    SELECT id, descricao, valor_permutado, data_registro, contrato_id, organizacao_id
    FROM public.contrato_permutas
    ORDER BY data_registro DESC
`);
console.log(`📋 Total de registros a migrar: ${preview.rows.length}`);
console.table(preview.rows.map(r => ({
    id: r.id,
    descricao: r.descricao?.substring(0, 40),
    valor: r.valor_permutado,
    data: r.data_registro
})));

if (preview.rows.length === 0) {
    console.log('ℹ️ Nenhum registro para migrar.');
    await client.end();
    process.exit(0);
}

// 2. Verificar se já foram migrados (evita duplicata)
const jaExistem = await client.query(`
    SELECT COUNT(*) FROM public.lancamentos
    WHERE tipo = 'Ativo' AND conta_id = 48
`);
console.log(`\nℹ️ Lançamentos Ativo já existentes na conta 48: ${jaExistem.rows[0].count}`);

// 3. Executar a migração
console.log('\n⏳ Migrando registros...');
let migrados = 0;
let erros = 0;

for (const permuta of preview.rows) {
    try {
        await client.query(`
            INSERT INTO public.lancamentos (
                organizacao_id, tipo, descricao, valor,
                data_transacao, data_vencimento,
                conta_id, contrato_id,
                status, data_pagamento,
                created_at
            ) VALUES ($1, 'Ativo', $2, $3, $4, $4, 48, $5, 'Pago', $4, $6)
        `, [
            permuta.organizacao_id,
            permuta.descricao || 'Permuta imobiliária',
            parseFloat(permuta.valor_permutado || 0),
            permuta.data_registro || new Date().toISOString().split('T')[0],
            permuta.contrato_id || null,
            permuta.created_at || new Date().toISOString()
        ]);
        console.log(`   ✅ Migrado: ${permuta.descricao?.substring(0, 40)} — R$ ${permuta.valor_permutado}`);
        migrados++;
    } catch (e) {
        console.error(`   ❌ Erro em ID ${permuta.id}: ${e.message}`);
        erros++;
    }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`✅ Migrados com sucesso: ${migrados}`);
console.log(`❌ Erros: ${erros}`);
console.log('='.repeat(50));

// 4. Verificar resultado
const resultado = await client.query(`
    SELECT COUNT(*) as total, SUM(valor) as valor_total
    FROM public.lancamentos
    WHERE tipo = 'Ativo' AND conta_id = 48
`);
console.log('\n📊 Resultado final na conta de Ativos Imobiliários:');
console.table(resultado.rows);

await client.end();
console.log('\n🔌 Concluído!');
