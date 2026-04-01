require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            tem_resumo_materiais: { type: SchemaType.BOOLEAN, description: "True apenas se a folha/imagem contém uma tabela de Resumo de Materiais, Relação de Aço ou Quantitativos." },
            concreto_m3: { type: SchemaType.NUMBER, description: "Volume de concreto total (em m3) listado na tabela de resumo desta folha." },
            forma_m2: { type: SchemaType.NUMBER, description: "Área de forma total (em m2) listada na tabela de resumo desta folha." },
            aco_kg: { type: SchemaType.NUMBER, description: "Total de aço (em kg) listado no resumo geral desta folha." },
            aco_detalhado: {
                type: SchemaType.ARRAY,
                description: "Array com o peso ou comprimento total de cada bitola extraída do resumo da folha.",
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        bitola: { type: SchemaType.STRING, description: "Bitola do aço, ex: '5.0', '10.0', '12.5', '6.3'" },
                        peso_kg: { type: SchemaType.NUMBER, description: "Peso total em kg para esta bitola nesta folha. Deixe nulo se não houver." },
                        total_linear_m: { type: SchemaType.NUMBER, description: "Metragem linear total (m) para esta bitola nesta folha. Deixe nulo se não houver." }
                    },
                    required: ["bitola"]
                }
            },
            detalhes: { type: SchemaType.STRING, description: "Breve explicação sobre os dados lidos (ex: 'Resumo de Vigas V1-V20', 'Tabela de Pilares')." }
        },
        required: ["tem_resumo_materiais"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig });

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processarImagens(pastaPath) {
    const arquivos = fs.readdirSync(pastaPath).filter(f => f.endsWith('.png') || f.endsWith('.jpg')).sort();
    console.log(`\n🏗️ Iniciando leitura de ${arquivos.length} imagens...`);
    
    let totalConcreto = 0;
    let totalForma = 0;
    let totalAcoKg = 0;
    const consolidadoAco = {};

    for (let i = 0; i < arquivos.length; i++) {
        const arquivo = arquivos[i];
        const caminhoCompleto = path.join(pastaPath, arquivo);
        
        console.log(`[${i+1}/${arquivos.length}] Analisando ${arquivo}...`);
        
        try {
            // Upload
            const uploadResponse = await fileManager.uploadFile(caminhoCompleto, {
                mimeType: "image/png",
                displayName: arquivo,
            });
            
            // Prompt
            const prompt = "Analise esta imagem (prancha de projeto estrutural). Verifique se nela existe um Quadro ou Tabela de Resumo de Materiais (ou Relação de Aço/Resumo Geral). Se houver, extraia o Volume de Concreto (m³), Área de Forma (m²), e as quantidades de aço divididas por bitola (ex: ø5.0, ø10.0mm). Só responda com dados se a tabela existir! Se a página não tiver nenhuma tabela de resumo, retorne com tem_resumo_materiais=false. Ignore as peças individuais, quero apenas a tabela geral da página.";

            // Request
            const result = await model.generateContent([
                { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
                { text: prompt }
            ]);
            
            const txtOutput = result.response.text();
            let dados = {};
            try {
                dados = JSON.parse(txtOutput);
            } catch (e) {
                // remove markdown ticks
                dados = JSON.parse(txtOutput.replace(/```json/g,'').replace(/```/g,''));
            }
            
            if (dados.tem_resumo_materiais) {
                console.log(`   ✔️ Encontrado resumo: ${dados.detalhes}`);
                
                if (dados.concreto_m3) totalConcreto += dados.concreto_m3;
                if (dados.forma_m2) totalForma += dados.forma_m2;
                if (dados.aco_kg) totalAcoKg += dados.aco_kg;
                
                if (dados.aco_detalhado) {
                    for (const aco of dados.aco_detalhado) {
                        const b = String(aco.bitola).replace('ø', '').trim();
                        if (!consolidadoAco[b]) consolidadoAco[b] = { peso_kg: 0, linear_m: 0 };
                        if (aco.peso_kg) consolidadoAco[b].peso_kg += aco.peso_kg;
                        if (aco.total_linear_m) consolidadoAco[b].linear_m += aco.total_linear_m;
                    }
                }
            } else {
                console.log(`   ❌ Nenhum resumo encontrado nesta prancha.`);
            }
            
        } catch (e) {
            console.error(`   ⚠️ Erro na prancha ${arquivo}: ${e.message}`);
        }
        
        // Rate limit do Gemini API
        await delay(5000);
    }
    
    console.log("\n========================================================");
    console.log("🏆 CONSOLIDAÇÃO FINAL DO PROJETO ESTRUTURAL (ALFA)");
    console.log("========================================================");
    console.log(`🪵 Volume de Concreto Total: ${totalConcreto.toFixed(2)} m³`);
    console.log(`🪵 Área de Forma Total: ${totalForma.toFixed(2)} m²`);
    console.log(`\n🔩 Resumo Geral de Ferragens (Soma das tabelas):`);
    for (const bitola in consolidadoAco) {
        console.log(`  - Bitola ø${bitola}mm: ${consolidadoAco[bitola].peso_kg.toFixed(2)} Kg | ${consolidadoAco[bitola].linear_m.toFixed(2)} metros lineares`);
    }
    console.log("\nFeito! O Devonildo processou imagens como um campeão.");
}

const pastaImagens = path.join(__dirname, 'alfa_images');
processarImagens(pastaImagens);
