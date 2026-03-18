import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;

async function checkUrn() {
    let log = "";
    try {
        log += "Autenticando...\n";
        const authRes = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(APS_CLIENT_ID + ':' + APS_CLIENT_SECRET).toString('base64')
            },
            body: 'grant_type=client_credentials&scope=data:read data:write data:create'
        });
        const authData = await authRes.json();
        
        if (!authRes.ok) {
           log += `ERRO AUTH: ${JSON.stringify(authData)}\n`;
           throw new Error("Falha na autenticacao");
        }

        const token = authData.access_token;
        log += "Token obtido com sucesso\n";

        const urn = "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6c3R1ZGlvNTdfYmltX2J1Y2tldF9wX2phdXQ5d3MwOHJqemRvbnpld2FuanVnN2JrZHYzMnl0MHVuZGRhNjl5MnZlc2ViYy8yMDIxXzAxNV9MSU5LJTIwMDJfQVJRVUlURVRVUkElMjBGT1JSTy5ydnQ";

        log += "Verificando manifesto...\n";
        const manifestRes = await fetch(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        log += `Status Manifesto: ${manifestRes.status}\n`;
        const manifestData = await manifestRes.text();
        log += `Resposta Manifesto: ${manifestData}\n`;

        // Se manifesto falhou, vamos tentar iniciar a tradução para ver se dá erro
        if (manifestRes.status === 404 || manifestRes.status === 406 || manifestRes.status === 400 || manifestRes.status === 401) {
            log += "\nTentando forçar a tradução novamente...\n";
            const transRes = await fetch('https://developer.api.autodesk.com/modelderivative/v2/designdata/job', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'x-ads-force': 'true' },
                body: JSON.stringify({ input: { urn: urn }, output: { formats: [{ type: 'svf', views: ['2d', '3d'] }] } })
            });
            log += `Status Tradução: ${transRes.status}\n`;
            log += `Resposta Tradução: ${await transRes.text()}\n`;
        }
    } catch (e) {
        log += "ERRO: " + e.message + "\n";
    }
    fs.writeFileSync('c:\\Projetos\\studio57so-v8\\scripts\\check_urn.log', log);
    console.log("Feito!");
}

checkUrn();
