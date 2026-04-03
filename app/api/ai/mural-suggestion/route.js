import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req) {
 try {
 const { text, assuntoAtual } = await req.json();

 if (!text) {
 return NextResponse.json({ error: 'O conteúdo principal do texto é obrigatório para ser corrigido.' }, { status: 400 });
 }

 const apiKey = process.env.GEMINI_API_KEY;
 if (!apiKey) {
 return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
 }

 const genAI = new GoogleGenerativeAI(apiKey);
 const generationConfig = {
 responseMimeType: "application/json",
 responseSchema: {
 type: SchemaType.OBJECT,
 properties: {
 assunto: { type: SchemaType.STRING, description: "Novo assunto sugerido" },
 conteudo: { type: SchemaType.STRING, description: "Texto corrigido e formatado" },
 },
 required: ["assunto", "conteudo"],
 },
 };

 const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig });

 const prompt = `
Você é o assistente "Devonildo" operando nos bastidores de um Mural de Recados Corporativo.
Sua única tarefa é atuar como um REVISOR ORTOGRÁFICO E GRAMATICAL LEVE. O texto final deve permanecer extremamente fiel à versão original escrita pelo usuário.

**Regras estritas e inquebráveis:**
1. CORREÇÃO CIRÚRGICA: Corrija apenas erros óbvios de português (ortografia, pontuação e concordância básica).
2. NÃO REESCREVA O TEXTO: Mantenha o vocabulário, o tom, a formatação de parágrafos e o "jeito de falar" da pessoa. NÃO invente palavras chiques, sinônimos desnecessários ou frases novas. Apenas aprimore o que está escrito.
3. PRESERVE O SENTIDO: É absolutamente proibido alterar a ideia original, mudar o sentido, ou estender a explicação. Conserve a essência da mensagem.
4. ASSUNTO: Se o "Assunto Atual" estiver completamente vazio, crie um resumo curto (máximo 60 caracteres) refletindo o texto. Se já existir, corrija apenas a ortografia dele e nada mais.
5. Retorne os dados ESTRITAMENTE num objeto JSON contendo as propriedades JSON "assunto" e "conteudo".

**Rascunho atual:**
Assunto Atual: "${assuntoAtual || ''}"
Conteúdo: "${text}"
`;

 const result = await model.generateContent(prompt);
 const response = await result.response;
 let parsedJson;
 try {
 parsedJson = JSON.parse(response.text());
 } catch(e) {
 console.error("Falha ao parsear output da IA:", response.text());
 return NextResponse.json({ error: "Resposta inválida da Inteligência Artificial." }, { status: 500 });
 }

 return NextResponse.json({
 assunto: parsedJson.assunto || assuntoAtual,
 conteudo: parsedJson.conteudo || text
 });

 } catch (error) {
 console.error("Erro na chamada de IA no Mural:", error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
