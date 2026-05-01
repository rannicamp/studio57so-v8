const fs = require('fs');

let content = fs.readFileSync('app/(landingpages)/betasuites/book-a5/BetaSuitesBookA5Client.js', 'utf8');

const sizeMap = {
  'text-[5px]': 'text-[7px]',
  'text-[6px]': 'text-[9px]',
  'text-[7px]': 'text-[10px]',
  'text-[8px]': 'text-[12px]',
  'text-[9px]': 'text-sm',
  'text-[10px]': 'text-base',
  'text-[12px]': 'text-lg',
  'text-xs': 'text-sm',
  'text-sm': 'text-base',
  'text-2xl': 'text-3xl',
  'text-4xl': 'text-5xl',
  'text-5xl': 'text-6xl'
};

for (const [oldClass, newClass] of Object.entries(sizeMap)) {
  const regex = new RegExp('(?<!-)\\\\b' + oldClass.replace('[', '\\\\[').replace(']', '\\\\]') + '\\\\b', 'g');
  content = content.replace(regex, newClass);
}

fs.writeFileSync('app/(landingpages)/betasuites/book-a5/BetaSuitesBookA5Client.js', content);
console.log('Fontes redimensionadas com sucesso!');
