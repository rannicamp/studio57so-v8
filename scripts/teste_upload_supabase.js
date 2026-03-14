const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// O caminho do arquivo de 51MB que estourou a memória
const FILE_PATH = `C:\\Users\\Ranniere\\OneDrive\\S57 ARQUITETURA\\MODELO CENTRAL\\2024_000_RESIDENCIAL ALFA\\SISTEMA\\2021_015_LINK 02_ARQUITETURA LAYOUT.rvt`;

async function main() {
    console.log(`🚀 Iniciando Teste de Upload Direto para o Supabase Storage...`);
    console.log(`📁 Arquivo: ${FILE_PATH}`);

    if (!fs.existsSync(FILE_PATH)) {
        console.error('❌ Arquivo não encontrado no OneDrive!');
        return;
    }

    const stats = fs.statSync(FILE_PATH);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Tamanho do Arquivo: ${sizeMB} MB`);

    const fileExt = FILE_PATH.split('.').pop();
    const fileName = `teste_upload_${Date.now()}.${fileExt}`;

    try {
        console.log(`⏳ Enviando arquivo de ${sizeMB}MB para o bucket 'bim-arquivos' do Supabase...`);
        
        // Vamos ler o stream do arquivo para não estourar a memória local
        const fileStream = fs.createReadStream(FILE_PATH);
        
        // Upload method para Node.js (duplex stream format)
        const { data, error } = await supabase.storage
            .from('bim-arquivos')
            .upload(fileName, fileStream, {
                contentType: 'application/octet-stream',
                duplex: 'half' // Necessário no Node.js v18+ para fetch com stream
            });

        if (error) {
            console.error('\n❌ ERRO DO SUPABASE STORAGE:');
            console.error(error);
            console.log('\n🔍 DIAGNÓSTICO: O Supabase está bloqueando. Isso significa que o limite de upload está travado no Painel do Supabase (Project Settings > Storage) e não apenas na tabela do banco.');
        } else {
            console.log(`\n✅ SUCESSO! O arquivo foi salvo no Supabase em: ${data.path}`);
            console.log(`🎉 O problema estava no Front-End!`);
        }
    } catch (e) {
        console.error('❌ ERRO CATASTRÓFICO DURANTE UPLOAD:', e);
    }
}

main();
