const { Client } = require('pg');
const ELO_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;
const SSL = { rejectUnauthorized: false };

async function run() {
    const c = new Client({ connectionString: decodeURIComponent(ELO_URL), ssl: SSL });
    await c.connect();
    console.log('=== CONECTADO AO BANCO OFICIAL V (vhuvnutzklhskkwbpxdz) ===\n');

    const targetOrgs = [7, 8, 9, 11, 13, 14, 15, 16];

    try {
        // 1. Limpar organizações de teste (7, 8, 9, 11, 13, 14, 15, 16) e dependências
        console.log('Limpando dependências das organizações de teste...');
        
        const resFuncoes = await c.query(
            'DELETE FROM public.funcoes WHERE organizacao_id IN (7, 8, 9, 11, 13, 14, 15, 16)'
        );
        console.log(`- ${resFuncoes.rowCount} registro(s) deletado(s) de public.funcoes`);

        try {
            const resEmp = await c.query('DELETE FROM public.cadastro_empresa WHERE organizacao_id IN (7, 8, 9, 11, 13, 14, 15, 16)');
            console.log(`- ${resEmp.rowCount} registro(s) deletado(s) de public.cadastro_empresa`);
        } catch (e) {
            console.log(`- Sem suporte ou erro em public.cadastro_empresa: ${e.message}`);
        }

        try {
            const resWaba = await c.query('DELETE FROM public.configuracoes_whatsapp WHERE organizacao_id IN (7, 8, 9, 11, 13, 14, 15, 16)');
            console.log(`- ${resWaba.rowCount} registro(s) deletado(s) de public.configuracoes_whatsapp`);
        } catch (e) {
            console.log(`- Sem suporte ou erro em public.configuracoes_whatsapp: ${e.message}`);
        }

        console.log('\nExcluindo as organizações de teste na tabela public.organizacoes...');
        const resOrgDelete = await c.query(
            'DELETE FROM public.organizacoes WHERE id IN (7, 8, 9, 11, 13, 14, 15, 16)'
        );
        console.log(`- ${resOrgDelete.rowCount} organização(ões) deletada(s) com sucesso.`);

        // 2. Atualizar a Organização 12 (Nome, Usuário e Empresa)
        console.log('\nAtualizando a Organização 12...');
        const resOrgUpdate = await c.query(`
            UPDATE public.organizacoes 
            SET nome = 'Ranniere Campos Mendes Arquiteto' 
            WHERE id = 12
            RETURNING id, nome
        `);
        console.log('Organização 12 atualizada:', resOrgUpdate.rows);

        console.log('\nAtualizando usuário rannierecampos1@gmail.com (gmailteste)...');
        await c.query('ALTER TABLE public.usuarios DISABLE TRIGGER trg_auto_notificacao_usuarios');
        
        const resUserUpdate = await c.query(`
            UPDATE public.usuarios 
            SET nome = 'Ranniere', sobrenome = 'Campos' 
            WHERE email = 'rannierecampos1@gmail.com'
            RETURNING id, email, nome, sobrenome
        `);
        console.log('Usuário atualizado:', resUserUpdate.rows);
        
        await c.query('ALTER TABLE public.usuarios ENABLE TRIGGER trg_auto_notificacao_usuarios');

        console.log('\nAtualizando o Cadastro da Empresa da Org 12...');
        const resEmpUpdate = await c.query(`
            UPDATE public.cadastro_empresa 
            SET nome_fantasia = 'Ranniere Campos Mendes Arquiteto', razao_social = 'Ranniere Campos Mendes Arquiteto'
            WHERE organizacao_id = '12'
            RETURNING id, nome_fantasia, razao_social
        `);
        console.log('Cadastro da empresa da Org 12 atualizado:', resEmpUpdate.rows);

        // 3. Ajustar a chave do MCP para apontar para a Org 12 (em vez da Org 1)
        console.log('\nAjustando chave do MCP para apontar para a Org 12...');
        const keyHash = '5dbd7af8020dafebc2ba78088b41b836d9e3381bac14004f2d2e2134fa4b512c'; // SHA-256 do token
        
        const resKey = await c.query(`
            UPDATE public.user_api_keys 
            SET organizacao_id = 12
            WHERE key_hash = $1
            RETURNING id, usuario_id, organizacao_id
        `, [keyHash]);
        console.log('Chave do MCP atualizada no banco:', resKey.rows);

        // 4. Atualizar os metadados na auth.users para o usuário rannierecampos1@gmail.com
        console.log('\nSincronizando metadados de login da auth.users para a Org 12...');
        await c.query(`
            UPDATE auth.users 
            SET raw_user_meta_data = jsonb_set(
                COALESCE(raw_user_meta_data, '{}'::jsonb), 
                '{organizacao_id}', 
                '"12"'::jsonb
            )
            WHERE email = 'rannierecampos1@gmail.com'
        `);
        console.log('✅ Metadados de Auth atualizados com sucesso!');

        console.log('\n=== OPERAÇÃO NO BANCO V FINALIZADA COM SUCESSO! ===');

    } catch (e) {
        console.error('\n❌ ERRO NA ATUALIZAÇÃO DO BANCO V:', e.message);
        try {
            await c.query('ALTER TABLE public.usuarios ENABLE TRIGGER trg_auto_notificacao_usuarios');
            console.log('Trigger reabilitado.');
        } catch (eTrig) {
            console.error('Erro ao reabilitar trigger:', eTrig.message);
        }
    } finally {
        await c.end();
    }
}

run();
