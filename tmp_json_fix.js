const fs = require('fs');

let file = fs.readFileSync('app/(main)/atividades/actions-ai.js', 'utf8');

const search = `tools: [{ functionDeclarations: [buscarAtividadesTool] }],`;
const replace = `tools: [{ functionDeclarations: [buscarAtividadesTool] }],
    generationConfig: {
      responseMimeType: 'application/json',
    },`;
file = file.replace(search, replace);

const promptSearch = `NÃO USE MARCADORES MARKDOWN COMO \`\`\`json. APENAS O OBJETO JSON PURO SEGUINDO A ESTRUTURA ABAIXO:
  Schema Obrigatório: ${"${JSON.stringify(schema)}"}`;
const promptReplace = `NÃO USE MARCADORES MARKDOWN. NUNCA REPITA O SCHEMA DE VOLTA, APENAS PREENCHA O RESULTADO NO SEU JSON.
  Estrutura Obrigatória da Resposta: ${"${JSON.stringify(schema)}"}`;
file = file.replace(promptSearch, promptReplace);

const jsonParseSearch = `  let result;
  try {
    result = JSON.parse(rawText);
  } catch (parseError) {`;
const jsonParseReplace = `  let result;
  try {
    // Se o modelo cuspir 2 JSONs seguidos (ex: repetiu o schema), vamos arrancar o primeiro
    let cleanText = rawText;
    const splitMatch = rawText.match(/}\\s*{/);
    if (splitMatch) {
      cleanText = rawText.substring(splitMatch.index + 1).trim();
    }
    result = JSON.parse(cleanText);
  } catch (parseError) {`;
file = file.replace(jsonParseSearch, jsonParseReplace);

fs.writeFileSync('app/(main)/atividades/actions-ai.js', file);
