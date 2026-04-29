/**
 * 🔥 GERADOR DE PDF HÍBRIDO v5 - BETA SUÍTES
 * 
 * ESTRATÉGIA FINAL:
 * 1. Screenshot de cada página COM texto em alta resolução (4x = ~384 DPI)
 * 2. Texto INVISÍVEL por cima para seleção/busca (técnica de PDF escaneado)
 * 
 * Resultado: Visual PERFEITO + texto selecionável/pesquisável!
 * 
 * USO: node scripts/gerar_book_pdf.js
 */

const puppeteer = require('puppeteer-core');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs');
const path = require('path');
const os = require('os');

const desktopPath = path.join(os.homedir(), 'OneDrive', 'Área de Trabalho');
const outputPath = path.join(desktopPath, 'Book_Beta_Suites_V6.pdf');
const BOOK_URL = 'http://localhost:3000/betasuites/book';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const PDF_W = 841.89;
const PDF_H = 595.28;
const VP_W = 1122;
const VP_H = 794;
const SCALE = 4; // 4x = ~384 DPI (qualidade de impressão profissional)
const PX_TO_PT = PDF_W / VP_W;

(async () => {
  console.log('🚀 Gerador PDF v5 — Screenshot HD + Texto Invisível');
  console.log(`📂 Destino: ${outputPath}\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: VP_W, height: VP_H, deviceScaleFactor: SCALE });

    console.log('📄 Carregando página...');
    await page.goto(BOOK_URL, { waitUntil: 'networkidle0', timeout: 120000 });

    // Espera imagens + fontes
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.querySelectorAll('img')).map(img => {
        if (img.complete && img.naturalHeight > 0) return;
        return new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 10000); });
      }));
      await document.fonts.ready;
    });
    await new Promise(r => setTimeout(r, 2000));

    // Esconde botão
    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(b => b.style.display = 'none');
    });

    const pageRects = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.folha-page-wrapper')).map(w => {
        const r = w.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
    });

    console.log(`📑 ${pageRects.length} páginas\n`);

    const pagesData = [];
    for (let i = 0; i < pageRects.length; i++) {
      const rect = pageRects[i];
      process.stdout.write(`   📸 Página ${i + 1}/${pageRects.length}...`);

      // Extrai textos COM posição (para camada invisível)
      const texts = await page.evaluate((idx) => {
        const wrapper = document.querySelectorAll('.folha-page-wrapper')[idx];
        const wr = wrapper.getBoundingClientRect();
        const results = [];
        const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT, null);
        let node;
        while (node = walker.nextNode()) {
          const text = node.textContent.trim();
          if (!text) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const r = range.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const style = window.getComputedStyle(node.parentElement);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          results.push({
            text,
            x: r.x - wr.x,
            y: r.y - wr.y,
            w: r.width,
            h: r.height,
            fontSize: parseFloat(style.fontSize),
          });
        }
        return results;
      }, i);

      // Screenshot COM texto (visual completo!)
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 95,
        clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });

      pagesData.push({ screenshot, texts });
      console.log(` ✅ (${texts.length} textos)`);
    }

    // Monta o PDF
    console.log('\n📝 Montando PDF...');
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Fonte para camada invisível (qualquer uma serve, é transparente)
    const fontsDir = path.join(__dirname, '..', 'public', 'fonts');
    const font = await pdfDoc.embedFont(fs.readFileSync(path.join(fontsDir, 'Montserrat-Regular.ttf')));

    for (let i = 0; i < pagesData.length; i++) {
      const { screenshot, texts } = pagesData[i];
      const pdfPage = pdfDoc.addPage([PDF_W, PDF_H]);

      // Fundo: screenshot em alta resolução
      const bgImage = await pdfDoc.embedJpg(screenshot);
      pdfPage.drawImage(bgImage, { x: 0, y: 0, width: PDF_W, height: PDF_H });

      // Camada de texto invisível (para seleção/busca)
      for (const t of texts) {
        try {
          const fontSize = Math.max(3, t.fontSize * PX_TO_PT * 0.85);
          const pdfX = t.x * PX_TO_PT;
          const pdfY = PDF_H - (t.y * PX_TO_PT) - fontSize;

          // Texto 100% transparente — invisível mas selecionável
          pdfPage.drawText(t.text, {
            x: pdfX,
            y: pdfY,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: 0,
          });
        } catch (e) { /* ignora caracteres não suportados */ }
      }
    }

    console.log('💾 Salvando localmente...');
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);

    // Upload para o Supabase Storage
    console.log('☁️  Enviando para o Supabase...');
    const dotenvPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(dotenvPath, 'utf-8');
    const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
    const serviceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

    if (supabaseUrl && serviceKey) {
      const uploadUrl = `${supabaseUrl}/storage/v1/object/empreendimento-anexos/5/book/Book_Investidor_Beta_Suites.pdf`;
      const fetch = (await import('node-fetch')).default;
      
      // Deleta versão anterior (se existir)
      await fetch(uploadUrl, { method: 'DELETE', headers: { 'Authorization': `Bearer ${serviceKey}` } }).catch(() => {});

      // Upload novo
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/pdf',
          'x-upsert': 'true',
        },
        body: pdfBytes,
      });

      if (res.ok) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/empreendimento-anexos/5/book/Book_Investidor_Beta_Suites.pdf`;
        console.log(`✅ Upload OK: ${publicUrl}`);
      } else {
        console.error('⚠️  Erro no upload:', await res.text());
      }
    } else {
      console.warn('⚠️  Credenciais Supabase não encontradas, PDF salvo apenas localmente.');
    }

    console.log('\n✅ ========================================');
    console.log('✅  PDF GERADO COM SUCESSO!');
    console.log(`✅  ${outputPath}`);
    console.log(`✅  ${pagesData.length} páginas • 384 DPI • Texto selecionável`);
    console.log('✅ ========================================');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  } finally {
    if (browser) await browser.close();
  }
})();
