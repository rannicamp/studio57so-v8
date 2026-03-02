import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERRO: Variáveis de ambiente faltando.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function safeMigrate() {
    console.log('🚀 Iniciando Migração Segura de Funis Locais (Foco: Org 2)...');

    try {
        // Passo 1: Adicionar a coluna tipo_coluna (ignora erro se já existir)
        console.log('\n[1/4] Tentando adicionar "tipo_coluna" na tabela colunas_funil...');
        // Tentamos via RPC (caso não se tenha acesso direto de alter table via client JS,
        // o Supabase JS tem limitações para ALTER TABLE)
        // Solução de contorno: Se o ALTER TABLE não for possível via API, informaremos o usuário
        // que precisará rodar um SQL simples no painel. Assumo que podemos tentar atualizar um registro
        // fictício para ver se a coluna existe.

        const { error: checkColError } = await supabase.from('colunas_funil').select('tipo_coluna').limit(1);
        if (checkColError && checkColError.message.includes('column "tipo_coluna" does not exist')) {
            console.log('\n⚠️ ATENÇÃO: A coluna "tipo_coluna" NÃO existe no banco de dados!');
            console.log('Por favor, acesse o painel do Supabase -> SQL Editor e rode o seguinte comando:');
            console.log('ALTER TABLE colunas_funil ADD COLUMN tipo_coluna TEXT;');
            console.log('Após rodar o comando, execute este script novamente.');
            return;
        } else {
            console.log('✅ Coluna "tipo_coluna" identificada no banco de dados.');
        }

        // Definições de segurança
        const TARGET_ORG_ID = 2; // Foco inicial e mais crítico

        // Passo 2: Achar o Funil da Org 2
        let { data: funilOrg2, error: funilError } = await supabase
            .from('funis')
            .select('id')
            .eq('organizacao_id', TARGET_ORG_ID)
            .eq('nome', 'Funil de Vendas')
            .maybeSingle();

        if (!funilOrg2) {
            console.log('⚠️ Org 2 não tem um "Funil de Vendas" criado! Criando um para evitar perda de dados...');
            const { data: newFunil, error: insertFunilError } = await supabase
                .from('funis')
                .insert({ nome: 'Funil de Vendas', organizacao_id: TARGET_ORG_ID })
                .select('id').single();

            if (insertFunilError) throw insertFunilError;
            funilOrg2 = newFunil;
        }
        console.log(`✅ Funil da Org 2 identificado (ID: ${funilOrg2.id})`);

        // Passo 3: Garantir as 3 Colunas Mestre da Org 2
        console.log('\n[2/4] Verificando as colunas âncora da Org 2...');
        const padroes = [
            { nome: 'ENTRADA', tipo: 'entrada', ordem: 0 },
            { nome: 'VENDIDO', tipo: 'ganho', ordem: 98 },
            { nome: 'PERDIDO', tipo: 'perdido', ordem: 99 }
        ];

        let mapasColunas = {}; // Guardar IDs gerados/existentes

        for (const padrao of padroes) {
            // Verifica se a Org 2 já tem essa coluna
            const { data: existingCol } = await supabase
                .from('colunas_funil')
                .select('id')
                .eq('organizacao_id', TARGET_ORG_ID)
                .eq('funil_id', funilOrg2.id)
                .eq('nome', padrao.nome)
                .maybeSingle();

            if (existingCol) {
                // Atualiza o tipo_coluna se já existia, mas não tinha a flag
                await supabase.from('colunas_funil').update({ tipo_coluna: padrao.tipo }).eq('id', existingCol.id);
                console.log(`✅ Coluna '${padrao.nome}' já existe. Atualizada com flag '${padrao.tipo}'.`);
                mapasColunas[padrao.tipo] = existingCol.id;
            } else {
                // Cria a coluna ineditamente
                const { data: insertedCol, error: colError } = await supabase
                    .from('colunas_funil')
                    .insert({
                        nome: padrao.nome,
                        ordem: padrao.ordem,
                        funil_id: funilOrg2.id,
                        organizacao_id: TARGET_ORG_ID,
                        tipo_coluna: padrao.tipo
                    }).select('id').single();

                if (colError) throw colError;
                console.log(`✨ Nova coluna '${padrao.nome}' criada para a Org 2.`);
                mapasColunas[padrao.tipo] = insertedCol.id;
            }
        }

        // Passo 4: Migração Segura de Leads
        console.log('\n[3/4] Procurando Leads da Org 2 perdidos na Org 1...');

        // ID da coluna ENTRADA da Org 1 (Sistema)
        const { data: colEntradaSistema } = await supabase
            .from('colunas_funil')
            .select('id')
            .eq('organizacao_id', 1)
            .eq('nome', 'ENTRADA')
            .maybeSingle();

        if (!colEntradaSistema) {
            console.log('ℹ️ Coluna ENTRADA do sistema (Org 1) não encontrada, pulando etapa de migração.');
        } else {
            // Acha os contatos no funil que pertencem à Org 2, MAS estão apontando pra coluna do Sistema
            const { data: leadsExtraviados, error: leadsError } = await supabase
                .from('contatos_no_funil')
                .select('id')
                .eq('organizacao_id', TARGET_ORG_ID)
                .eq('coluna_id', colEntradaSistema.id);

            if (leadsError) throw leadsError;

            if (leadsExtraviados && leadsExtraviados.length > 0) {
                console.log(`⚠️ Encontrados ${leadsExtraviados.length} leads da Org 2 na coluna do Sistema.`);

                // Realocando-os com carinho para o novo lar definitivo
                const { error: updateError } = await supabase
                    .from('contatos_no_funil')
                    .update({ coluna_id: mapasColunas['entrada'] })
                    .eq('organizacao_id', TARGET_ORG_ID)
                    .eq('coluna_id', colEntradaSistema.id);

                if (updateError) throw updateError;
                console.log(`✅ Todos os ${leadsExtraviados.length} leads foram migrados para a ENTRADA nativa da Org 2! Nenhum dado perdido.`);
            } else {
                console.log('✅ Nenhum lead da Org 2 pendente de migração na coluna do sistema.');
            }
        }

        console.log('\n🎉 MUNDANÇA COMPLETA E SEGURA! Org 2 está operando com Funil Independente.');

    } catch (e) {
        console.error('💥 FALHA NO SCRIPT DE MIGRAÇÃO:', e);
    }
}

safeMigrate();
