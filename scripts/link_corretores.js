const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function linkOrphanedBrokers() {
    console.log('--- INICIANDO MATCH DE CORRETORES ---');
    
    // Pegar usuários
    const { data: usuarios, error: uErr } = await supabaseAdmin.from('usuarios')
        .select('id, nome, email').eq('funcao_id', 20);
        
    // Pegar contatos (SEM email, pois na acao de criar nao passamos o email para contatos)
    const { data: contatos, error: cErr } = await supabaseAdmin.from('contatos')
        .select('id, nome, telefone, celular, criado_por_usuario_id, creci')
        .eq('tipo_contato', 'Corretor');
    
    if (uErr || cErr) {
        console.log('Erro Supabase:', uErr?.message || cErr?.message);
        return;
    }

    if (!usuarios || !contatos) {
        console.log('Sem dados.');
        return;
    }

    let vinculadosNesteRun = 0;
    let jaEstavamVinculados = 0;
    let naoEncontrados = 0;
    
    let report = '';

    for (const u of usuarios) {
        const nomeU = (u.nome || '').toLowerCase().trim();

        // Tentar achar um contato com nome parecido (ja que e a unica chave confiavel em comum agora)
        const contactMatch = contatos.find(c => {
            const nomeC = (c.nome || '').toLowerCase().trim();
            if (!nomeC || !nomeU) return false;
            
            return (nomeC === nomeU || nomeC.includes(nomeU) || nomeU.includes(nomeC));
        });

        if (contactMatch) {
            if (contactMatch.criado_por_usuario_id !== u.id) {
                report += `[✔ ATUALIZADO NO BANCO] Login de '${u.nome}' bateu com Contato da base '${contactMatch.nome}'. Creci: ${contactMatch.creci || 'Vazio'} Tel: ${contactMatch.telefone || 'Vazio'}\n`;
                await supabaseAdmin.from('contatos').update({ criado_por_usuario_id: u.id }).eq('id', contactMatch.id);
                vinculadosNesteRun++;
            } else {
                report += `[= IGNORADO] Login '${u.nome}' já estava ligado perfeitamente ao Contato '${contactMatch.nome}'.\n`;
                jaEstavamVinculados++;
            }
        } else {
            report += `[❌ NÃO AXADO] Conta '${u.nome}' (${u.email}) continuará solteira sem ficha na tabela Contatos Corretor.\n`;
            naoEncontrados++;
        }
    }
    
    report += `\n================================\n`;
    report += `🚀 RESUMO DO MUTIRÃO:\n`;
    report += `- Corrigidos (Vinculados Agora): ${vinculadosNesteRun}\n`;
    report += `- Já estavam certos: ${jaEstavamVinculados}\n`;
    report += `- Fichas INEXISTENTES: ${naoEncontrados}\n`;
    report += `================================\n`;
    
    console.log(report);
}

linkOrphanedBrokers();
