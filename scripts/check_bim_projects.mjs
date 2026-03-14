import fs from 'fs';
import path from 'path';

// Leitura manual do .env.local para não precisar de dotenv
const envPath = path.resolve('c:/projetos/studio57so-v8-main/.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim();
    }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APS_CLIENT_ID = env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = env.APS_CLIENT_SECRET;
const BUCKET_KEY = (env.APS_BUCKET_KEY || ('studio57_bim_bucket_' + APS_CLIENT_ID)).toLowerCase().replace(/[^a-z0-9_-]/g, '');

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

async function checkProjects() {
    console.log("=== AUDITORIA DE PROJETOS BIM ===");
    console.log(`Bucket Autodesk: ${BUCKET_KEY}`);

    // 1. Obter token da Autodesk
    let accessToken = null;
    try {
        const credentials = Buffer.from(`${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`).toString('base64');
        const tokenRes = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                scope: 'bucket:read data:read',
            }),
        });

        if (!tokenRes.ok) {
            console.error("Falha ao obter token da Autodesk.", await tokenRes.text());
            return;
        }

        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token;
        console.log("✅ Token da Autodesk obtido com sucesso.");
    } catch (error) {
        console.error("Erro na autenticação Autodesk:", error);
        return;
    }

    // 2. Obter projetos do Supabase via REST API
    let projetos = [];
    try {
        const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/projetos_bim?select=id,nome_arquivo,tamanho_bytes,status,urn_autodesk&order=id.desc`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!supaRes.ok) {
            console.error("Erro Supabase:", await supaRes.text());
            return;
        }
        projetos = await supaRes.json();
        console.log(`\nEncontrados ${projetos.length} projetos na tabela projetos_bim no Supabase.`);
    } catch (err) {
        console.error("Falha REST Supabase:", err);
        return;
    }

    // 3. Listar objetos no bucket da Autodesk
    let autodeskObjects = [];
    try {
        const objectsRes = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        });

        if (objectsRes.ok) {
            const objectsData = await objectsRes.json();
            autodeskObjects = objectsData.items;
            console.log(`✅ ${autodeskObjects.length} arquivos fisicamente retidos no bucket Autodesk.`);
        } else if (objectsRes.status === 404) {
            console.log(`⚠️ Bucket ${BUCKET_KEY} não existe na Autodesk (ou expirou)!`);
        } else {
            console.error(`Status inesperado ao listar bucket: ${objectsRes.statusText}`);
        }
        
    } catch (error) {
        console.error("Erro ao listar objetos Autodesk:", error);
    }

    // 4. Analisar cruzamento de dados
    console.log("\n--- ANÁLISE DETALHADA ---");
    
    for (const proj of projetos) {
        console.log(`\n===========================================`);
        console.log(`Projeto: ${proj.nome_arquivo} (ID: ${proj.id})`);
        console.log(`Tamanho: ${formatBytes(proj.tamanho_bytes || 0)}`);
        console.log(`Status Banco: ${proj.status}`);
        
        if (!proj.urn_autodesk) {
            console.log(`❌ URN Autodesk: Faltando (nunca subiu ou falhou no meio do upload)`);
        } else {
            console.log(`URN Supabase -> Autodesk: ${proj.urn_autodesk}`);
            
            // Decodifica a URN para achar o objectId da Autodesk
            let objectIdAssumido = '';
            try {
                const clearUrn = proj.urn_autodesk.startsWith('urn:') ? proj.urn_autodesk.replace('urn:', '') : proj.urn_autodesk;
                objectIdAssumido = Buffer.from(clearUrn, 'base64').toString('utf8');
                console.log(`URN Local Decodificada: ${objectIdAssumido}`);
            } catch (e) {
                console.log(`⚠️ URN formato inválido.`);
            }

            // Verifica arquivo
            const fileExists = autodeskObjects.some(obj => obj.objectId === objectIdAssumido);
            
            if (fileExists) {
                console.log(`✅ DISPONIBILIDADE NO DISCO: PRESENTE na Autodesk.`);
            } else {
                console.log(`❌ DISPONIBILIDADE NO DISCO: AUSENTE (Apagado ou Expirou da Nuvem).`);
            }
            
            // Verifica status da tradução no Forge (SVF Viewer)
            try {
                const clearUrn = proj.urn_autodesk.startsWith('urn:') ? proj.urn_autodesk.replace('urn:', '') : proj.urn_autodesk;
                const manifestUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${clearUrn}/manifest`;
                const manifestRes = await fetch(manifestUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (manifestRes.ok) {
                    const manifest = await manifestRes.json();
                    console.log(`Motor 3D Viewer (Tradução): ${manifest.status.toUpperCase()} (${manifest.progress})`);
                    
                    if (manifest.status === 'failed') {
                         console.log(`🚨 MOTIVO FALHA: ${JSON.stringify(manifest.messages || manifest.derivatives?.[0]?.messages || 'Desconhecido')}`);
                    }
                } else if (manifestRes.status === 404) {
                    console.log(`Motor 3D Viewer (Tradução): NUNCA TRADUZIDO (Erro 404 Manifest)`);
                } else if (manifestRes.status === 401) {
                    console.log(`Motor 3D Viewer (Tradução): Erro 401 (Permissão de Acesso SVF)`);
                } else if (manifestRes.status === 403) {
                    console.log(`Motor 3D Viewer (Tradução): Erro 403 (Possível falta de Flex Tokens / Cloud Credits na Conta Autodesk)`);
                } else {
                    console.log(`Motor 3D Viewer (Tradução): Falha API Autodesk Status ${manifestRes.status}`);
                }
            } catch (e) {
                console.log(`⚠️ Falha grave ao contatar Motor 3D.`);
            }
        }
    }
}

checkProjects();
