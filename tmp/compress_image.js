const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputPath = 'C:\\Users\\ranni\\OneDrive\\S57 INCORPORAÇÕES\\EMPREENDIMENTOS\\REFÚGIO BRAÚNAS\\MARKETING\\DRONE\\DJI_20260511120857_0020_D.png';
const outputPath = inputPath.replace('.png', '_comprimido.png');

async function processImage() {
  try {
    console.log('Lendo a imagem original...');
    
    // Verifica se o arquivo existe
    if (!fs.existsSync(inputPath)) {
      console.error(`Erro: Arquivo não encontrado no caminho:\n${inputPath}`);
      return;
    }

    const metadata = await sharp(inputPath).metadata();
    console.log(`Tamanho original: ${metadata.width}x${metadata.height}, formato: ${metadata.format}`);

    console.log('Compactando e convertendo para PNG...');
    await sharp(inputPath)
      .resize({
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({
        quality: 80,
        compressionLevel: 9, // compressão máxima do PNG
        palette: true        // quantização de cores para reduzir MUITO o tamanho
      })
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    console.log(`Sucesso! Imagem compactada salva em:\n${outputPath}`);
    console.log(`Novo tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  } catch (err) {
    console.error('Erro ao processar imagem:', err);
  }
}

processImage();
