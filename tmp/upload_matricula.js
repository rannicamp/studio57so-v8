require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function uploadMatricula() {
    const filePath = 'I:\\\\2025_002_PERO VAZ\\\\MATRÍCULA ATUALIZADA\\\\MATRICULA PERO VAZ ONUS REAIS.pdf';
    const timestamp = Date.now() + Math.floor(Math.random() * 1000);
    const storagePath = `10/DOC_${timestamp}.pdf`;
    const displayName = '[CT] - MATRICULA PERO VAZ ONUS REAIS.pdf';

    console.log('Uploading matricula...');
    const fileBuffer = fs.readFileSync(filePath);
    const { error: uploadError } = await supabase.storage.from('empreendimento-anexos').upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: false });
    
    if (uploadError) {
        console.error('Upload error:', uploadError);
        return;
    }

    const { error: dbError } = await supabase.from('empreendimento_anexos').insert({
        empreendimento_id: 10,
        caminho_arquivo: storagePath,
        nome_arquivo: displayName,
        categoria_aba: 'juridico',
        disponivel_corretor: true,
        status: 'Ativo',
        organizacao_id: 2
    });

    if (dbError) {
        console.error('DB error:', dbError);
    } else {
        console.log('Matricula uploaded and DB updated successfully!');
    }
}
uploadMatricula();
