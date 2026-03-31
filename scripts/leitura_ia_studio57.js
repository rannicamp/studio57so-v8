require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            // Tabela cadastro_empresa globais
            razao_social: { type: SchemaType.STRING },
            cnpj: { type: SchemaType.STRING },
            capital_social: { type: SchemaType.NUMBER, description: "Somente os numeros do capital inteiro ex: 100000" },
            natureza_juridica: { type: SchemaType.STRING },
            objeto_social: { type: SchemaType.STRING, description: "Resumo descritivo da atividade" },
            data_abertura: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
            inscricao_municipal: { type: SchemaType.STRING },
            inscricao_estadual: { type: SchemaType.STRING },
            cep: { type: SchemaType.STRING },
            address_street: { type: SchemaType.STRING },
            address_number: { type: SchemaType.STRING },
            address_complement: { type: SchemaType.STRING },
            neighborhood: { type: SchemaType.STRING },
            city: { type: SchemaType.STRING },
            state: { type: SchemaType.STRING },
            email: { type: SchemaType.STRING },
            telefone: { type: SchemaType.STRING },
            
            // Dados da entidade CONTATO (Socio Adiministrador / Responsável)
            responsavel_nome: { type: SchemaType.STRING },
            responsavel_cpf: { type: SchemaType.STRING },
            responsavel_rg: { type: SchemaType.STRING },
            responsavel_estado_civil: { type: SchemaType.STRING },
            responsavel_nacionalidade: { type: SchemaType.STRING },
            responsavel_profissao: { type: SchemaType.STRING },
            
            status: { type: SchemaType.BOOLEAN },
            justificativa: { type: SchemaType.STRING }
        },
        required: ["razao_social", "responsavel_nome", "responsavel_cpf", "status"]
    }
};

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig });

async function executarExtraida() {
    console.log("🚀 Iniciando O Agente Padrão Ouro de Leitura de PDFs...");
    try {
        // 1. Download do(s) arquivo(s) direto do Bucket Seguro
        const folder = path.join(__dirname, '..', '_temp_anexos');
        if (!fs.existsSync(folder)) fs.mkdirSync(folder);
        
        // Vamos extrair do Cartão CNPJ que tem a Ficha Cadastral mais completa da base de dados RFB!
        const { data: listData } = await supabase.storage.from('empresa-anexos').list('4');
        
        let contratoFileName = null;
        for(let l of listData) {
            if(l.name.includes('CARTAO_CNPJ')) {
                contratoFileName = l.name;
                break;
            }
        }
        
        if (!contratoFileName) throw new Error("Não encontrei o PDF do Cartão CNPJ na pasta da Studio 57!");
        
        console.log(`📥 Baixando arquivo fonte: ${contratoFileName}`);
        const { data: fileData, error: downloadError } = await supabase.storage.from('empresa-anexos').download(`4/${contratoFileName}`);
        if (downloadError) throw downloadError;
        
        const localPath = path.join(folder, 'contrato_temp.pdf');
        const buffer = Buffer.from(await fileData.arrayBuffer());
        fs.writeFileSync(localPath, buffer);
        
        // 2. Acionar Gemini via GoogleAIFileManager
        console.log("🧠 Subindo PDF temporalmente para o Vison Model do Gemini 2.5 Flash...");
        const uploadResponse = await fileManager.uploadFile(localPath, {
            mimeType: "application/pdf",
            displayName: "Auditoria Studio 57",
        });
        
        console.log("🤖 Injetando Prompt Analítico e extraindo os segredos...");
        const prompt = "Analise criticamente as clausulas deste contrato social / cartão CNPJ. Extraia cirurgicamente todos os dados da empresa (Capital, Natureza, Datas) e todos os dados demográficos rigorosos do atual Sócio Administrador (Nome, CPF, RG, Profissão, Estado Civil, Nacionalidade). Preencha o JSON estritamente sem campos nulos inventados.";

        const result = await model.generateContent([
            { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
            { text: prompt }
        ]);
        
        const dados = JSON.parse(result.response.text());
        console.log("\n\n📊 DADOS EXTRAIDOS COM SUCESSO:");
        console.log(dados);

        // ============================================
        // 3. INSERÇÃO ESTRUTURADA DIRETA NA BASE DE DADOS
        // ============================================
        // Checagem prévia se o CPF já existe
        const { data: existingContato } = await supabase
            .from('contatos')
            .select('id')
            .eq('cpf', dados.responsavel_cpf)
            .limit(1);

        let contatoData, contatoError;

        if (existingContato && existingContato.length > 0) {
            console.log("\n💉 Atualizando contato existente no Banco...");
            const result = await supabase
                .from('contatos')
                .update({
                    nome: dados.responsavel_nome,
                    rg: dados.responsavel_rg,
                    estado_civil: dados.responsavel_estado_civil,
                    nacionalidade: dados.responsavel_nacionalidade,
                    cargo: dados.responsavel_profissao
                })
                .eq('id', existingContato[0].id)
                .select('id')
                .single();
            contatoData = result.data;
            contatoError = result.error;
        } else {
            console.log("\n💉 Injetando NOVO contato do Responsável na matriz...");
            const result = await supabase
                .from('contatos')
                .insert({
                    organizacao_id: 2, // Elo 57 Master ID
                    nome: dados.responsavel_nome,
                    cpf: dados.responsavel_cpf,
                    rg: dados.responsavel_rg,
                    estado_civil: dados.responsavel_estado_civil,
                    nacionalidade: dados.responsavel_nacionalidade,
                    cargo: dados.responsavel_profissao,
                    is_awaiting_name_response: false
                })
                .select('id')
                .single();
            contatoData = result.data;
            contatoError = result.error;
        }

        if (contatoError) throw contatoError;
        const responsavelId = contatoData.id;
        console.log(`✅ Contato Garantido! UUID Responsavel: ${responsavelId}`);

        console.log("🔗 Atualizando Ficha Mestra da Empresa vinculando o Responsável...");
        const { error: empresaError } = await supabase
            .from('cadastro_empresa')
            .update({
                razao_social: dados.razao_social || "STUDIO 57 INCORPORACOES LTDA", // Fallback seguro
                cnpj: dados.cnpj,
                capital_social: isNaN(dados.capital_social) ? null : Number(dados.capital_social),
                natureza_juridica: dados.natureza_juridica,
                objeto_social: dados.objeto_social,
                inscricao_municipal: dados.inscricao_municipal,
                inscricao_estadual: dados.inscricao_estadual,
                cep: dados.cep,
                address_street: dados.address_street,
                address_number: dados.address_number,
                address_complement: dados.address_complement,
                neighborhood: dados.neighborhood,
                city: dados.city,
                state: dados.state,
                email: dados.email,
                telefone: dados.telefone,
                responsavel_id: responsavelId // O Novo Link
            })
            .eq('id', 4);

        if (empresaError) throw empresaError;
        
        console.log("🎉 OPERAÇÃO FINALIZADA COM TOTAL SUCESSO PADRÃO OURO!");

    } catch(e) {
        console.error("🔥 Erro fatal na rotina:", e);
    }
}

executarExtraida();
