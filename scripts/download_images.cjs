const fs = require('fs');
const path = require('path');
const axios = require('axios');

const urls = {
  153: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/feedbacks/prints/1779891495327-8atk6h-IMG_6866.png',
  154: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/feedbacks/prints/1779891594302-3s1rp-IMG_6867.png',
  155: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/feedbacks/prints/1779900740656-t0msoa-image.png',
  156: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/feedbacks/prints/1779981541964-meimnv-IMG_6886.png',
  157: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/feedbacks/prints/1779981880695-tlsdzy-IMG_6887.png'
};

const outputDir = path.join(__dirname, '..', '_temp_anexos');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function download(id, url) {
  const ext = path.extname(url).split('?')[0] || '.png';
  const filePath = path.join(outputDir, `${id}${ext}`);
  console.log(`Downloading ${url} to ${filePath}...`);
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Downloaded ${id}`);
        resolve();
      });
      writer.on('error', reject);
    });
  } catch (err) {
    console.error(`❌ Failed to download ${id}:`, err.message);
  }
}

async function main() {
  for (const [id, url] of Object.entries(urls)) {
    await download(id, url);
  }
  console.log('All downloads finished.');
}

main();
