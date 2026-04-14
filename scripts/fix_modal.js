const fs = require('fs');
let contents = fs.readFileSync('components/shared/FilePreviewModal.js', 'utf8');

if (!contents.includes('getSafeUrl')) {
  contents = contents.replace(
    `export default function FilePreviewModal({ anexo, onClose }) {`,
    `// Helper robusto para a URL pública (evita double-encoding)
const getSafeUrl = (url) => {
  if (!url) return '';
  try {
    return encodeURI(decodeURI(url));
  } catch(e) {
    return url;
  }
}

export default function FilePreviewModal({ anexo, onClose }) {`
  );

  contents = contents.replace(
    `{isPdf ? (
  <iframe src={\`\${anexo.public_url}#toolbar=0\`} className="w-full h-full border-none bg-white" title="PDF Preview" onLoad={() => setIsLoading(false)}
  />`,
    `{isPdf ? (
  <iframe src={\`\${getSafeUrl(anexo.public_url)}#toolbar=0\`} className="w-full h-full border-none bg-white" title="PDF Preview" onLoad={() => setIsLoading(false)}
  />`
  );
  
  fs.writeFileSync('components/shared/FilePreviewModal.js', contents);
  console.log("Updated FilePreviewModal.js");
} else {
  console.log("Already updated");
}
