const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const folderPath = 'C:\\Projetos\\BetaSuites-Meta-Ads\\Videos Finais';
const empreendimentoId = 5;
const tipoDocumentoId = 24; // VID (Vídeo)
const orgId = 2; // Studio 57

async function run() {
    try {
        const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.mp4'));
        
        console.log(`Encontrados ${files.length} vídeos para upload.`);

        for (const file of files) {
            console.log(`Iniciando upload de: ${file}`);
            const filePath = path.join(folderPath, file);
            const fileBuffer = fs.readFileSync(filePath);
            
            // 1. Upload para o Storage (bucket: empreendimento-anexos)
            const storagePath = `${empreendimentoId}/${Date.now()}_${file}`;
            
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('empreendimento-anexos')
                .upload(storagePath, fileBuffer, {
                    contentType: 'video/mp4',
                    upsert: false
                });

            if (uploadError) {
                console.error(`Erro no upload de ${file}:`, uploadError);
                continue;
            }
            console.log(`Upload concluído no Storage: ${storagePath}`);

            // 2. Inserir no banco de dados (tabela: empreendimento_anexos)
            const insertData = {
                empreendimento_id: empreendimentoId,
                tipo_documento_id: tipoDocumentoId,
                caminho_arquivo: storagePath,
                nome_arquivo: `[VID] - ${file}`,
                descricao: `Anúncio gerado e otimizado automaticamente pela IA (Meta Ads)`,
                categoria_aba: 'marketing',
                disponivel_corretor: true,
                status: 'Aprovado',
                organizacao_id: orgId
            };

            const { data: dbData, error: dbError } = await supabase
                .from('empreendimento_anexos')
                .insert([insertData]);

            if (dbError) {
                console.error(`Erro ao inserir no banco para ${file}:`, dbError);
            } else {
                console.log(`Registro salvo no banco para ${file} com sucesso!`);
            }
        }
        
        console.log("Processo finalizado com sucesso!");
    } catch (err) {
        console.error("Erro geral:", err);
    }
}

run();
