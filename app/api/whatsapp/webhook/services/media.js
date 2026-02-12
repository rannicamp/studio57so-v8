// app/api/whatsapp/webhook/services/media.js
import { logWebhook } from './helpers';

export async function processIncomingMedia(supabaseAdmin, message, config, contatoId) {
    try {
        const type = message.type;
        if (type === 'reaction') return null;

        const mediaId = message[type]?.id;
        const mimeType = message[type]?.mime_type;
        let fileName = message[type]?.filename;

        if (!mediaId) return null;

        if (!fileName) {
            const ext = mimeType ? mimeType.split('/')[1].split(';')[0] : 'bin';
            fileName = `${type}_${mediaId}_${Date.now()}.${ext}`;
        }

        // Limpeza do nome
        const cleanName = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const folderPath = contatoId ? `received/${contatoId}/${year}/${month}` : `received/unassigned/${year}/${month}`;
        const filePath = `${folderPath}/${cleanName}`;

        console.log(`[MediaService] Baixando mídia ${mediaId}...`);

        // 1. Pega URL de download
        const urlResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }
        });
        
        if (!urlResponse.ok) throw new Error(`Erro URL Meta: ${urlResponse.statusText}`);
        const urlData = await urlResponse.json();
        if (!urlData.url) throw new Error('URL não retornada pela Meta');

        // 2. Baixa o arquivo binário
        const fileResponse = await fetch(urlData.url, {
            headers: { 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }
        });
        
        if (!fileResponse.ok) throw new Error(`Erro Download Binário: ${fileResponse.statusText}`);
        const fileBlob = await fileResponse.arrayBuffer();

        // 3. Upload Supabase
        const { error: uploadError } = await supabaseAdmin.storage
            .from('whatsapp-media')
            .upload(filePath, fileBlob, { contentType: mimeType, upsert: true });

        if (uploadError) {
            console.error('[MediaService] Erro upload Supabase:', uploadError);
            await logWebhook(supabaseAdmin, 'ERROR', 'Erro upload Supabase', uploadError);
            return null;
        }

        const { data: publicUrlData } = supabaseAdmin.storage
            .from('whatsapp-media')
            .getPublicUrl(filePath);

        return {
            publicUrl: publicUrlData.publicUrl,
            storagePath: filePath,
            fileName: cleanName,
            fileSize: fileBlob.byteLength,
            mimeType: mimeType
        };

    } catch (error) {
        console.error('[MediaService] Erro processando mídia:', error);
        await logWebhook(supabaseAdmin, 'ERROR', 'Erro processando mídia', { error: error.message });
        return null;
    }
}