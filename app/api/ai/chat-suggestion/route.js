import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req) {
 try {
 const { text } = await req.json();

 if (!text) {
 return NextResponse.json({ error: 'O texto é obrigatório para ser corrigido.' }, { status: 400 });
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
 conteudo: { type: SchemaType.STRING, description: "Texto corrigido e formatado" },
 },
 required: ["conteudo"],
 },
 };

 const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview', generationConfig });

 const prompt = `
Você é uma IA de correção gramatical invisível.
Sua única tarefa é atuar como um REVISOR ORTOGRÁFICO E GRAMATICAL LEVE. O texto final deve permanecer extremamente fiel à versão original escrita pelo usuário.

**Regras estritas e inquebráveis:**
1. CORREÇÃO CIRÚRGICA: Corrija apenas erros óbvios de português (ortografia, pontuação, acentuação e concordância básica).
2. NÃO REESCREVA O TEXTO: Mantenha exatamente o vocabulário, o tom, e o "jeito de falar" da pessoa (mesmo se for informal). NÃO invente palavras, NÃO troque palavras simples por complexas.
3. PRESERVE O SENTIDO: É absolutamente proibido alterar o sentido, adicionar respostas ou explicações.
4. Se o texto já estiver correto, devolva-o exatamente como está.
5. Retorne os dados num objeto JSON contendo a propriedade "conteudo".

**Texto Original:**
"${text}"
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
 conteudo: parsedJson.conteudo || text
 });

 } catch (error) {
 console.error("Erro na chamada de IA no Chat:", error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
