require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const fetch = require('node-fetch');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixBuckets() {
    // 1. Pega os PDFs inseridos em 'empresas'
    const { data: files } = await supabase.storage.from('empresas').list('4/', { limit: 100 });
    
    if(!files || files.length === 0) {
        console.log("Nenhum arquivo no bucket empresas.");
        return;
    }

    for (const file of files) {
        if (!file.name.includes('.')) continue;
        const oldPath = `4/${file.name}`;
        console.log(`Copying ${oldPath} to empresa-anexos...`);
        
        // Baixa o arquivo temporariamente ou usa a API de Cópia (não suporta cross-bucket direto na API REST padrão em algumas configs)
        // O jeito mais seguro é baixar e subir.
        const { data: signedUrlData } = await supabase.storage.from('empresas').createSignedUrl(oldPath, 60);
        if (signedUrlData && signedUrlData.signedUrl) {
            const res = await fetch(signedUrlData.signedUrl);
            const blob = await res.arrayBuffer();
            
            // Faz upload no bucket correto (empresa-anexos)
            const { error: uploadErr } = await supabase.storage.from('empresa-anexos').upload(oldPath, Buffer.from(blob), {
                upsert: true,
                contentType: res.headers.get('content-type') || 'application/pdf'
            });
            
            if (uploadErr) {
                console.error(`Erro ao subir ${oldPath}:`, uploadErr.message);
            } else {
                console.log(`Sucesso! Removendo do antigo...`);
                // Opcional: remover do bucket antigo para liberar espaço
                await supabase.storage.from('empresas').remove([oldPath]);
            }
        }
    }
    console.log("Concluído migration!");
}

fixBuckets();
