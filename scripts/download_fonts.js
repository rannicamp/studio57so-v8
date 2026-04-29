const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'public', 'fonts');
if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });

// URLs diretas do Google Fonts CDN (User-Agent de browser para pegar TTF)
function getGoogleFontUrl(family, weight) {
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
        } else if (res.statusCode === 200) {
          const file = fs.createWriteStream(dest);
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        } else {
          reject(new Error(`HTTP ${res.statusCode} para ${u}`));
        }
      }).on('error', reject);
    };
    follow(url);
  });
}

async function extractTTFUrl(family, weight) {
  return new Promise((resolve, reject) => {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extrai URL do TTF do CSS
        const match = data.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
        if (match) resolve(match[1]);
        else reject(new Error(`Não encontrou TTF para ${family} ${weight}. CSS: ${data.substring(0, 200)}`));
      });
    }).on('error', reject);
  });
}

const fonts = [
  { family: 'Montserrat', weight: 300, file: 'Montserrat-Light.ttf' },
  { family: 'Montserrat', weight: 400, file: 'Montserrat-Regular.ttf' },
  { family: 'Montserrat', weight: 500, file: 'Montserrat-Medium.ttf' },
  { family: 'Montserrat', weight: 700, file: 'Montserrat-Bold.ttf' },
  { family: 'Montserrat', weight: 900, file: 'Montserrat-Black.ttf' },
  { family: 'Roboto', weight: 300, file: 'Roboto-Light.ttf' },
  { family: 'Roboto', weight: 400, file: 'Roboto-Regular.ttf' },
  { family: 'Roboto', weight: 700, file: 'Roboto-Bold.ttf' },
];

(async () => {
  for (const f of fonts) {
    try {
      console.log(`📥 Baixando ${f.file}...`);
      const ttfUrl = await extractTTFUrl(f.family, f.weight);
      await downloadFile(ttfUrl, path.join(fontsDir, f.file));
      
      // Verifica se é TTF real
      const buf = fs.readFileSync(path.join(fontsDir, f.file));
      const header = buf.slice(0, 4).toString('hex');
      console.log(`   ✅ ${f.file} (${buf.length} bytes, header: ${header})`);
    } catch (err) {
      console.error(`   ❌ ${f.file}: ${err.message}`);
    }
  }
  console.log('\n🎉 DONE!');
})();
