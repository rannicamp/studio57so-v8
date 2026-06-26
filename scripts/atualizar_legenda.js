const fs = require('fs');
const path = require('path');

// Função para localizar o diretório de vídeos
function locateVideoDir() {
  const baseDir = "C:\\Users\\ranni\\OneDrive";
  const items = fs.readdirSync(baseDir);
  for (const item of items) {
    const fullPath = path.join(baseDir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && item.startsWith("S57 INCORPORA")) {
      const candidatePath = path.join(fullPath, "MARKETING", "VIDEOS RANNIERE");
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }
  throw new Error("Diretório de vídeos não encontrado.");
}

const content = `=== TRANSCRIÇÃO DO ÁUDIO ===
Quando você investe no Studio 57, você não está investindo apenas num imóvel, mas num ativo imobiliário. Com a segurança de que registramos cada empreendimento antes do início das obras, o que torna o ativo muito mais dinâmico, pois você pode dar como garantia num empréstimo, trocar ou até vender antes do final da obra. Então, o nosso ativo, ele não é completamente imobilizado. Além disso, diferente do mercado de ações, o setor imobiliário, ele é muito mais seguro. No mercado de ações, qualquer boato pode fazer com que as ações oscilem, fazendo com que você perca rentabilidade no período, justamente no período onde você precisa do dinheiro. Com imóveis, não. A crescente, ela é constante durante o período de obra. Por isso, investir no setor imobiliário é melhor do que investir no mercado de ações para quem busca segurança.

=== LEGENDA PROPOSTA PARA O INSTAGRAM ===
✨ Além de um Imóvel: Invista em um Ativo Imobiliário Dinâmico com a Studio 57 ✨

Na Studio 57, sua visão de futuro encontra solidez. Quando você escolhe nossos empreendimentos, não está adquirindo apenas um imóvel, mas um verdadeiro ativo imobiliário, estrategicamente planejado para sua liberdade e segurança financeira. 💎

Nossa inteligência em gestão e incorporação garante que cada empreendimento seja registrado *antes* do início das obras. Essa é a chave para o dinamismo do seu investimento: um ativo que pode ser dado como garantia, trocado ou até vendido antes mesmo da conclusão do projeto, sem estar completamente imobilizado. 🏗️💡

Diferente da volatilidade do mercado de ações, onde boatos podem oscilar seus ganhos justamente quando você mais precisa, o setor imobiliário da Studio 57 oferece uma estabilidade incomparável. Aqui, o valor crescente do seu patrimônio é constante e previsível durante todo o período da obra. 📈🔒

Invista em segurança, design e um futuro construído com inteligência. Investir no setor imobiliário com a Studio 57 é a escolha mais sólida para quem busca proteção e valorização.

Quer elevar seu patrimônio com a segurança e o luxo inteligente que só a Studio 57 pode oferecer?
👉 Curta, salve este post e envie um Direct para descobrir as oportunidades que esperam por você! 💬

#Studio57 #AtivoImobiliario #InvestimentoInteligente #LuxoImobiliario #MercadoImobiliario
`;

try {
  const videoDir = locateVideoDir();
  const outputPath = path.join(videoDir, "legenda_instagram_2506.txt");
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`Legenda atualizada com sucesso em: ${outputPath}`);
} catch (err) {
  console.error("Erro ao atualizar a legenda:", err.message);
}
