require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMPREENDIMENTO_ID = 10;
const ORG_ID = 2; // Organizacao da venda do Pero Vaz que usamos

function getContentType(ext) {
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.pdf') return 'application/pdf';
    return 'application/octet-stream';
}

function getPrefixAndCategory(ext, fileName) {
    if (ext === '.pdf') return { prefix: 'DOC', category: 'Documentos' };
    if (fileName.includes('planta')) return { prefix: 'PLAN', category: 'Galeria' };
    return { prefix: 'IMG', category: 'Galeria' };
}

async function uploadFile(filePath, isFromI) {
    const ext = path.extname(filePath).toLowerCase();
    const originalName = path.basename(filePath, ext);
    
    // Filtro apenas imagens e pdfs do drive I: e pastas locais
    if (!['.jpg', '.jpeg', '.png', '.pdf'].includes(ext)) return null;

    const { prefix, category } = getPrefixAndCategory(ext, originalName.toLowerCase());
    
    // Physical name (e.g., IMG_1712312312.jpg)
    const timestamp = Date.now() + Math.floor(Math.random() * 1000);
    const physicalName = `${prefix}_${timestamp}${ext}`;
    const storagePath = `${EMPREENDIMENTO_ID}/${physicalName}`;

    // Display Name (e.g., [IMG] - FACHADA E FOTO DE CAPA PERO VAZ.jpg)
    let baseDisplayName = originalName.replace(/-/g, ' ').toUpperCase();
    const displayName = `[${prefix}] - ${baseDisplayName} PERO VAZ${ext}`;

    console.log(`Uploading ${displayName}...`);

    const fileBuffer = fs.readFileSync(filePath);
    const { error: uploadError } = await supabase.storage
        .from('empreendimento-anexos')
        .upload(storagePath, fileBuffer, {
            contentType: getContentType(ext),
            upsert: false
        });

    if (uploadError) {
        console.error(`Erro ao subir ${storagePath}:`, uploadError.message);
        return null;
    }

    // Gerar link publico
    const { data: publicUrlData } = supabase.storage
        .from('empreendimento-anexos')
        .getPublicUrl(storagePath);
        
    const publicUrl = publicUrlData.publicUrl;

    // Inserir no BD
    const { error: dbError } = await supabase
        .from('empreendimento_anexos')
        .insert({
            empreendimento_id: EMPREENDIMENTO_ID,
            caminho_arquivo: storagePath,
            nome_arquivo: displayName,
            categoria_aba: category,
            disponivel_corretor: true,
            status: 'Ativo',
            organizacao_id: ORG_ID
        });

    if (dbError) {
        console.error(`Erro no BD para ${displayName}:`, dbError.message);
    }

    return { originalName, publicUrl };
}

async function run() {
    const urls = {};
    const localGallery = path.join(__dirname, '../public/images/pero-vaz/galeria');
    const localPlan = path.join(__dirname, '../public/images/pero-vaz/planta-humanizada.png');
    const driveDir = 'I:\\2025_002_PERO VAZ';

    const filesToUpload = [];

    // Lendo galeria local
    if (fs.existsSync(localGallery)) {
        const galFiles = fs.readdirSync(localGallery);
        galFiles.forEach(f => filesToUpload.push(path.join(localGallery, f)));
    }
    
    // Planta
    if (fs.existsSync(localPlan)) filesToUpload.push(localPlan);

    // Lendo drive I:
    if (fs.existsSync(driveDir)) {
        const driveFiles = fs.readdirSync(driveDir);
        driveFiles.forEach(f => {
            const fPath = path.join(driveDir, f);
            if (fs.statSync(fPath).isFile()) filesToUpload.push(fPath);
        });
    }

    for (let f of filesToUpload) {
        const res = await uploadFile(f);
        if (res) urls[res.originalName] = res.publicUrl;
    }

    fs.writeFileSync(path.join(__dirname, 'urls_pero_vaz.json'), JSON.stringify(urls, null, 2));
    console.log("SUCESSO! URLs salvas em tmp/urls_pero_vaz.json");
}

run();
