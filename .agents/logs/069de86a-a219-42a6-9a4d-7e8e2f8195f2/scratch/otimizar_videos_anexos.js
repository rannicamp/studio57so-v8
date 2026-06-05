const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');
const { createClient } = require('c:/Projetos/studio57so-v8/node_modules/@supabase/supabase-js');

// Carrega as variáveis de ambiente locais do Next.js
require('c:/Projetos/studio57so-v8/node_modules/dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const ffmpegPath = "C:\\Users\\ranni\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe";
const ffprobePath = "C:\\Users\\ranni\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';

  if (!supabaseUrl || !supabaseKey) {
    console.error('Erro: Chaves do Supabase não encontradas no .env.local!');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const pgClient = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  console.log('Buscando arquivos de vídeo cadastrados em empreendimento_anexos...');
  const res = await pgClient.query(`
    SELECT id, nome_arquivo, caminho_arquivo, disponivel_corretor, empreendimento_id
    FROM empreendimento_anexos
    WHERE caminho_arquivo LIKE '%.mp4' 
       OR caminho_arquivo LIKE '%.mov' 
       OR caminho_arquivo LIKE '%.avi';
  `);

  console.log(`Encontrados ${res.rows.length} vídeos no banco de dados.`);

  // Cria pasta temporária para processamento se não existir
  const tmpDir = 'c:\\Projetos\\studio57so-v8\\tmp';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  for (const row of res.rows) {
    console.log(`\n==================================================`);
    console.log(`Processando vídeo: "${row.nome_arquivo}" (ID: ${row.id})`);
    
    const { data: urlData } = supabase.storage
      .from('empreendimento-anexos')
      .getPublicUrl(row.caminho_arquivo);

    const publicUrl = urlData.publicUrl;
    console.log(`URL Pública: ${publicUrl}`);

    // 1. Checa o tamanho atual do arquivo via requisição HEAD nativa
    let sizeBytes = 0;
    try {
      const headRes = await fetch(publicUrl, { method: 'HEAD' });
      const contentLength = headRes.headers.get('content-length');
      sizeBytes = contentLength ? parseInt(contentLength, 10) : 0;
    } catch (e) {
      console.warn(`[HEAD Warning] Não foi possível verificar tamanho via HEAD, tentando baixar direto...`);
    }

    const sizeMb = sizeBytes / (1024 * 1024);
    console.log(`Tamanho atual: ${sizeMb.toFixed(2)} MB`);

    if (sizeMb <= 10 && sizeBytes > 0) {
      console.log(`Vídeo já está abaixo de 10MB (${sizeMb.toFixed(2)}MB). Pulando otimização.`);
      continue;
    }

    console.log(`Vídeo excede 10MB ou tamanho não pôde ser verificado. Iniciando compressão...`);

    // Define caminhos dos arquivos temporários
    const ext = path.extname(row.caminho_arquivo).toLowerCase();
    const tempInput = path.join(tmpDir, `input_${row.id}${ext}`);
    const tempOutput = path.join(tmpDir, `output_${row.id}.mp4`); // Converte sempre para MP4 otimizado

    // 2. Faz o download do arquivo de vídeo original com fetch nativo
    console.log(`Baixando vídeo original...`);
    try {
      const downloadRes = await fetch(publicUrl);
      if (!downloadRes.ok) throw new Error(`Falha no download: ${downloadRes.statusText}`);
      
      const arrayBuffer = await downloadRes.arrayBuffer();
      fs.writeFileSync(tempInput, Buffer.from(arrayBuffer));
      console.log('Download concluído.');
    } catch (err) {
      console.error(`Erro ao baixar o vídeo original:`, err);
      cleanup([tempInput, tempOutput]);
      continue;
    }

    // 3. Lê a duração do vídeo com ffprobe para calcular o bitrate ideal
    let duration = 0;
    try {
      const durationStr = execSync(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempInput}"`).toString().trim();
      duration = parseFloat(durationStr);
      console.log(`Duração do vídeo: ${duration.toFixed(2)} segundos`);
    } catch (err) {
      console.error(`Erro ao ler duração com ffprobe. Usando duração padrão de 60 segundos de fallback.`);
      duration = 60;
    }

    if (isNaN(duration) || duration <= 0) {
      duration = 60;
    }

    // 4. Calcula o bitrate ideal em bps para ter no máximo 9.5MB (margem de segurança)
    const targetSizeBits = 9.5 * 1024 * 1024 * 8; // 9.5MB em bits
    const audioBitrateBps = 96 * 1024; // 96kbps (suficiente para voz/música no WhatsApp)
    let videoBitrateBps = Math.floor(targetSizeBits / duration) - audioBitrateBps;

    // Limites de segurança de bitrate
    if (videoBitrateBps < 200 * 1024) {
      videoBitrateBps = 200 * 1024; // Mínimo absoluto (evita ficar pixelado demais)
    } else if (videoBitrateBps > 3000 * 1024) {
      videoBitrateBps = 3000 * 1024; // Máximo para 720p web
    }

    const videoBitrateKbps = Math.floor(videoBitrateBps / 1024);
    const audioBitrateKbps = Math.floor(audioBitrateBps / 1024);
    console.log(`Calculado Bitrate de Vídeo: ${videoBitrateKbps} kbps | Áudio: ${audioBitrateKbps} kbps`);

    // 5. Executa a compressão via FFmpeg
    console.log(`Comprimindo vídeo via FFmpeg (Preset fast, 720p)...`);
    try {
      // ffmpeg comando
      // -vf scale=-2:720 redimensiona para altura 720 mantendo o aspect ratio (largura divisível por 2)
      const command = `"${ffmpegPath}" -y -i "${tempInput}" -vcodec libx264 -b:v ${videoBitrateKbps}k -maxrate ${videoBitrateKbps}k -bufsize ${videoBitrateKbps * 2}k -preset fast -vf scale=-2:720 -acodec aac -b:a ${audioBitrateKbps}k "${tempOutput}"`;
      
      execSync(command, { stdio: 'inherit' });
      console.log('Compressão concluída.');

      const finalSizeMb = fs.statSync(tempOutput).size / (1024 * 1024);
      console.log(`Tamanho final do vídeo comprimido: ${finalSizeMb.toFixed(2)} MB`);

      if (finalSizeMb > 10) {
        console.warn(`[Alerta] O vídeo comprimido ficou com ${finalSizeMb.toFixed(2)}MB, que é maior que 10MB! Tentando compressão extrema de emergência...`);
        const extremeBitrate = Math.floor(videoBitrateKbps * 0.7);
        const commandExtreme = `"${ffmpegPath}" -y -i "${tempInput}" -vcodec libx264 -b:v ${extremeBitrate}k -maxrate ${extremeBitrate}k -bufsize ${extremeBitrate * 2}k -preset fast -vf scale=-2:480 -acodec aac -b:a 64k "${tempOutput}"`;
        execSync(commandExtreme, { stdio: 'inherit' });
        const extremeSizeMb = fs.statSync(tempOutput).size / (1024 * 1024);
        console.log(`Tamanho final extremo: ${extremeSizeMb.toFixed(2)} MB`);
      }
    } catch (err) {
      console.error(`Erro ao executar conversão no FFmpeg:`, err);
      cleanup([tempInput, tempOutput]);
      continue;
    }

    // 6. Faz o upload do vídeo comprimido sobrescrevendo o original no bucket
    console.log(`Fazendo upload do vídeo otimizado para o Supabase Storage (sobrescrevendo)...`);
    try {
      const fileBuffer = fs.readFileSync(tempOutput);
      const { data, error: uploadError } = await supabase.storage
        .from('empreendimento-anexos')
        .upload(row.caminho_arquivo, fileBuffer, {
          contentType: 'video/mp4',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;
      console.log(`Upload concluído com sucesso para o caminho: ${row.caminho_arquivo}`);
    } catch (uploadErr) {
      console.error(`Erro ao fazer upload do arquivo otimizado:`, uploadErr);
    }

    // Limpa arquivos temporários do ciclo
    cleanup([tempInput, tempOutput]);
  }

  await pgClient.end();
  console.log('\nProcessamento de todos os vídeos finalizado com sucesso!');
}

function cleanup(files) {
  files.forEach(f => {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) {}
    }
  });
}

main();
