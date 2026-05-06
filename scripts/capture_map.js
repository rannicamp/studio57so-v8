const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MAP_URL = 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d870.2977149162376!2d-41.957825320025336!3d-18.899633922536143!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e1!3m2!1spt-BR!2sbr!4v1778094686981!5m2!1spt-BR!2sbr';

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // Tamanho grande para a foto do mapa no book
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
    
    console.log('Acessando Google Maps...');
    await page.goto(MAP_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    
    // Esconde aqueles botões de "Visualizar mapa ampliado" e labels de UI do Google Maps para ficar mais clean
    await page.evaluate(() => {
       const toHide = document.querySelectorAll('.place-card, .google-maps-link');
       toHide.forEach(el => el.style.display = 'none');
    });

    console.log('Tirando print do mapa...');
    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 90 });
    
    console.log('Upload do mapa para o Supabase...');
    const envContent = fs.readFileSync('.env.local', 'utf-8');
    const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
    const serviceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

    if (supabaseUrl && serviceKey) {
      const uploadUrl = `${supabaseUrl}/storage/v1/object/empreendimento-anexos/10/mapa_pero_vaz.jpeg`;
      const fetch = (await import('node-fetch')).default;
      
      await fetch(uploadUrl, { method: 'DELETE', headers: { 'Authorization': `Bearer ${serviceKey}` } }).catch(() => {});

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'true',
        },
        body: screenshotBuffer,
      });

      if (res.ok) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/empreendimento-anexos/10/mapa_pero_vaz.jpeg`;
        console.log(`✅ Mapa salvo: ${publicUrl}`);
      } else {
        console.error('⚠️ Erro upload:', await res.text());
      }
    }
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    if (browser) await browser.close();
  }
})();
