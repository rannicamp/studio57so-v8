require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const tus = require('tus-js-client');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FILE_PATH = `C:\\Users\\Ranniere\\OneDrive\\S57 ARQUITETURA\\MODELO CENTRAL\\2024_000_RESIDENCIAL ALFA\\SISTEMA\\2021_015_LINK 02_ARQUITETURA LAYOUT.rvt`;
const BUCKET = 'bim-arquivos';

async function uploadTus() {
    console.log(`🚀 Iniciando Desafio: Upload Chunked (TUS) para driblar o limite do API Gateway...`);
    console.log(`📁 Arquivo: ${FILE_PATH}`);

    if (!fs.existsSync(FILE_PATH)) {
        console.error('❌ Arquivo não encontrado no OneDrive!');
        return;
    }

    const file = fs.createReadStream(FILE_PATH);
    const size = fs.statSync(FILE_PATH).size;
    const fileName = `teste_tus_${Date.now()}.rvt`;

    console.log(`📊 Tamanho do Arquivo: ${(size / (1024*1024)).toFixed(2)} MB`);
    console.log(`🧩 Quebrando o arquivo em fatias e enviando para o Supabase...`);

    const options = {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
            Authorization: `Bearer ${SUPABASE_KEY}`,
            apikey: SUPABASE_KEY,
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
            bucketName: BUCKET,
            objectName: fileName,
            contentType: 'application/octet-stream',
            cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024, // 6MB chunks para driblar API Gateway Limit
        onError: function (error) {
            console.error('\n❌ ERRO NO TUS UPLOAD:', error);
        },
        onProgress: function (bytesUploaded, bytesTotal) {
            const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
            process.stdout.write(`\r[${percentage}%] Enviado: ${(bytesUploaded/1024/1024).toFixed(1)}MB de ${(bytesTotal/1024/1024).toFixed(1)}MB`);
        },
        onSuccess: function () {
            console.log(`\n\n✅ SUCESSO ABSOLUTO! O arquivo foi montado lá dentro pela API TUS.`);
            console.log(`🎉 Desafio Bypassed sem alterar o Painel de Controle, a barreira do Gateway foi quebrada.`);
            console.log(`📂 Caminho no banco: ${BUCKET}/${fileName}`);
        },
    };

    var upload = new tus.Upload(file, options);
    upload.start();
}

uploadTus();
