require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function run() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Olá, responda apenas: 'API 100% ativa'");
    console.log("SUCESSO:", result.response.text());
  } catch (err) {
    console.error("FALHA QUOTA:", err.message);
  }
}

run();
