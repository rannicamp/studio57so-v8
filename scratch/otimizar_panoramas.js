const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const INPUT_DIR = 'Z:\\MODELO CENTRAL\\2025_000_BETA SUÍTES\\2025_000_MAQUETE\\RENDER\\PANORAMA';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'panoramas_beta');

async function main() {
  console.log('--- INICIANDO OTIMIZAÇÃO DE PANORAMAS COM CORTE SUPERIOR (TOP-BOTTOM) ---');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`Criando diretório de saída: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`ERRO: Diretório de entrada não encontrado: ${INPUT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(INPUT_DIR).filter(file => file.endsWith('.png'));
  console.log(`Encontrados ${files.length} arquivos PNG.`);

  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file);
    const outputName = file.replace('.png', '.jpg');
    const outputPath = path.join(OUTPUT_DIR, outputName);

    console.log(`\nProcessando: ${file}...`);
    try {
      const metadata = await sharp(inputPath).metadata();
      const origWidth = metadata.width;
      const origHeight = metadata.height;
      
      const cropWidth = origWidth;
      const cropHeight = Math.floor(origHeight / 2); // Pega apenas a metade superior (Olho esquerdo)
      
      console.log(`Dimensões originais: ${origWidth}x${origHeight}`);
      console.log(`Área de corte (metade superior): ${cropWidth}x${cropHeight}`);

      const statsOrig = fs.statSync(inputPath);
      const sizeOrigMb = (statsOrig.size / (1024 * 1024)).toFixed(2);

      // Inicia o processamento no Sharp
      let pipeline = sharp(inputPath);
      
      // 1. Extrai a metade superior (para converter estéreo top-bottom para mono 2D)
      pipeline = pipeline.extract({
        left: 0,
        top: 0,
        width: cropWidth,
        height: cropHeight
      });

      // 2. Se a largura pós-corte for maior que 4096px, redimensiona para otimizar na web
      if (cropWidth > 4096) {
        console.log(`Redimensionando de ${cropWidth}px para 4096px de largura...`);
        pipeline = pipeline.resize({ width: 4096 });
      }

      await pipeline
        .jpeg({ quality: 85, progressive: true })
        .toFile(outputPath);

      const statsOpt = fs.statSync(outputPath);
      const sizeOptMb = (statsOpt.size / (1024 * 1024)).toFixed(2);

      console.log(`Concluído! Salvo em: ${outputPath}`);
      console.log(`Tamanho: ${sizeOrigMb} MB -> ${sizeOptMb} MB`);
    } catch (err) {
      console.error(`Erro ao processar ${file}:`, err);
    }
  }

  console.log('\n--- PROCESSO CONCLUÍDO ---');
}

main();
