require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkfiles() {
    const { data } = await supabase
        .from('empresa_anexos')
        .select('*')
        .eq('empresa_id', 4);
        
    const result = data.map(anexo => {
        const fullName = anexo.caminho_arquivo || anexo.nome_arquivo || '';
        const ext = fullName.split('.').pop().toLowerCase();
        let fType = 'image';
        if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) fType = 'video';
        if (ext === 'pdf') fType = 'pdf';
        
        return {
           id: anexo.id,
           nome_arquivo: anexo.nome_arquivo,
           caminho_arquivo: anexo.caminho_arquivo,
           extensoes: ext,
           resultadoFType: fType
        };
    });
    fs.writeFileSync('tmp_json.json', JSON.stringify(result, null, 2), 'utf-8');
}

checkfiles();
