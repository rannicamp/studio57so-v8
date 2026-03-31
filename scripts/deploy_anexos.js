require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Conexão Segura
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase Keys!");

const supabase = createClient(supabaseUrl, supabaseKey);

const payloadPath = 'C:\\temp_triagem_s57\\PRONTOS_PARA_UPLOAD\\payload_banco.json';
const uploadDir = 'C:\\temp_triagem_s57\\PRONTOS_PARA_UPLOAD';

async function start() {
    console.log("🚀 Iniciando injeção no Supabase (Storage e DB)...");
    const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

    // Descobrir nome do bucket de anexos da empresa
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) throw new Error("Falha ao listar buckets: " + bucketError.message);
    
    // O sistema Elo57 usa geralmente 'empresas-anexos' ou 'empresas' ou 'arquivos' ou 'empreendimentos-anexos'.
    // Mas a tabela empresas_anexos aponta via "4/foto.png". Provavelmente é 'empresa_anexos' ou 'empresas_anexos'.
    // Vamos procurar os buckets que contém a palavra empresa
    let bucketName = "empresas-anexos"; // Default fallback
    if (buckets.find(b => b.name === 'empresas_anexos')) bucketName = "empresas_anexos";
    else if (buckets.find(b => b.name === 'empresa_anexos')) bucketName = "empresa_anexos";
    else if (buckets.find(b => b.name === 'empresas')) bucketName = "empresas";
    console.log("🪣 Bucket alvo selecionado: " + bucketName);

    let sucessoCount = 0;

    for (let doc of payload) {
        try {
            const fileName = path.basename(doc.nome_arquivo);
            const fileFullPath = path.join(uploadDir, fileName);
            
            // Tratamento de caractere especial Padrão Web Absoluto
            const safeName = fileName
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Remove acentos
                .replace(/[^a-zA-Z0-9.\-]/g, "_") // Troca não-alfanumérico por _
                .substring(0, 100);

            const filePathStorage = `${doc.empresa_id}/${Date.now()}_${safeName}`;
            
            console.log(`\n📤 Processando: ${fileName}`);
            
            // Ler arquivo
            const fileBuffer = fs.readFileSync(fileFullPath);
            
            // 2. Storage Upload
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from(bucketName)
                .upload(filePathStorage, fileBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) {
                console.error("❌ Storage Erro:", uploadError.message);
                continue; // Pula para o próximo se o storage falhar
            }

            console.log(`✅ Upload Storage Concluído: ${uploadData.path}`);

            // 3. Database Insert
            const { data: dbData, error: dbError } = await supabase
                .from('empresa_anexos')
                .insert({
                    empresa_id: doc.empresa_id,
                    organizacao_id: 2, // Elo 57 Master ID
                    caminho_arquivo: uploadData.path, // O nome do storage
                    nome_arquivo: fileName, // O padrao ouro mantido
                    descricao: (doc.descricao || "Upload por Decantação de IA").substring(0, 300),
                    tipo_documento_id: doc.tipo_documento_id,
                    categoria_aba: 'juridico_contabil' // Para aparecer na aba correta (não marketing)
                })
                .select();
                
            if (dbError) {
                console.error("❌ Database Erro:", dbError.message);
                // Se der erro no BD, o ideal seria tentar deletar do bucket, mas como é triagem não tem problema grave ficar orfao.
            } else {
                console.log(`💾 Injetado DB com sucesso! ID: ${dbData[0].id}`);
                sucessoCount++;
            }

        } catch (e) {
            console.error("🔥 Erro inesperado neste arquivo:", e.message);
        }
    }
    
    console.log(`\n🎉 Processo Finalizado! Total: ${sucessoCount} de ${payload.length} arquivos decantados no sistema.`);
}

start();
