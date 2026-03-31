require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixBuckets() {
    const { data: files } = await supabase.storage.from('empresas').list('4/', { limit: 100 });
    
    if(!files || files.length === 0) {
        console.log("Nenhum arquivo.");
        return;
    }

    for (const file of files) {
        if(file.name === '.emptyFolderPlaceholder') continue;
        const oldPath = `4/${file.name}`;
        console.log(`Copying ${oldPath} to empresa-anexos...`);
        
        const { data: signedUrlData } = await supabase.storage.from('empresas').createSignedUrl(oldPath, 60);
        if (signedUrlData && signedUrlData.signedUrl) {
            const res = await fetch(signedUrlData.signedUrl);
            const blob = await res.arrayBuffer();
            
            const { error: uploadErr } = await supabase.storage.from('empresa-anexos').upload(oldPath, Buffer.from(blob), {
                upsert: true,
                contentType: res.headers.get('content-type') || 'application/pdf'
            });
            
            if (uploadErr) {
                console.error(`Erro ao subir ${oldPath}:`, uploadErr);
            } else {
                console.log(`Sucesso!`);
                await supabase.storage.from('empresas').remove([oldPath]);
            }
        }
    }
}

fixBuckets();
