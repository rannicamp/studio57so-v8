require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkfiles() {
    const { data } = await supabase
        .from('empresa_anexos')
        .select('*')
        .eq('empresa_id', 4);
        
    for (const anexo of data) {
        const fullName = anexo.caminho_arquivo || anexo.nome_arquivo || '';
        const ext = fullName.split('.').pop().toLowerCase();
        let fType = 'image';
        if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) fType = 'video';
        if (ext === 'pdf') fType = 'pdf';
        console.log(`File: ${anexo.nome_arquivo.substring(0, 30)}... | Ext: ${ext} | fType: ${fType}`);
    }
}

checkfiles();
