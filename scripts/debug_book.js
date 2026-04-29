/**
 * 🔍 DEBUG: Tira screenshot da página do Book para investigar o que o Chrome headless vê
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const os = require('os');

const desktopPath = path.join(os.homedir(), 'OneDrive', 'Área de Trabalho');
const BOOK_URL = 'http://localhost:3000/betasuites/book';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('🔍 Tirando screenshot de debug...');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-web-security']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1122, height: 794 });

    console.log('📄 Carregando página...');
    await page.goto(BOOK_URL, { waitUntil: 'networkidle0', timeout: 120000 });
    
    // Espera imagens
    await page.evaluate(async () => {
      const images = document.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete && img.naturalHeight > 0) return;
        return new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 10000); });
      }));
    });

    await new Promise(r => setTimeout(r, 3000));

    // Screenshot da página inteira (fullPage: true para capturar tudo)
    const screenshotPath = path.join(desktopPath, 'book_debug_screenshot.png');
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true 
    });
    console.log(`📸 Screenshot salvo: ${screenshotPath}`);

    // Debug: quantos elementos folha-page-wrapper existem
    const pageCount = await page.evaluate(() => {
      return document.querySelectorAll('.folha-page-wrapper').length;
    });
    console.log(`📑 Número de páginas encontradas: ${pageCount}`);

    // Debug: dimensões do container
    const dims = await page.evaluate(() => {
      const container = document.getElementById('pdf-book-container');
      if (!container) return { error: 'Container não encontrado' };
      const rect = container.getBoundingClientRect();
      return { 
        width: rect.width, 
        height: rect.height,
        scrollHeight: container.scrollHeight,
        childrenCount: container.children.length
      };
    });
    console.log('📐 Dimensões do container:', JSON.stringify(dims, null, 2));

    // Debug: verificar se as imagens carregaram
    const imgStatus = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      return Array.from(images).slice(0, 5).map(img => ({
        src: img.src.substring(0, 80),
        loaded: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      }));
    });
    console.log('🖼️  Status das primeiras 5 imagens:', JSON.stringify(imgStatus, null, 2));

  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    if (browser) await browser.close();
  }
})();
