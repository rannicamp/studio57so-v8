const fs = require('fs');
let lines = fs.readFileSync('components/SimuladorPrintView.js', 'utf8').split('\n');

const newHeader = [
  '      <header className="flex justify-between items-center border-b-2 border-gray-200 pb-4 mb-4">',
  '        <div className="w-1/3 flex flex-col justify-start items-start">',
  '          {empreendimento?.proprietaria?.logo_url ? (',
  '            <img',
  '              src={empreendimento.proprietaria.logo_url}',
  '              alt="Logo da Empresa Proprietária"',
  '              className="h-10 object-contain block mb-2"',
  '              crossOrigin="anonymous"',
  '            />',
  '          ) : (',
  '            <img',
  '              src="/marca/logo-elo57-horizontal.svg"',
  '              alt="Logo Elo 57"',
  '              className="h-10 object-contain block mb-2"',
  '            />',
  '          )}',
  '          <p className="text-[10px] text-gray-500">Data: {format(new Date(), \'dd/MM/yyyy\', { locale: ptBR })}</p>',
  '          <p className="text-[10px] text-gray-500">Proposta Nº: {simulacao.id}</p>',
  '        </div>',
  '',
  '        <div className="w-1/3 flex justify-center items-center">',
  '          <h1 className="text-xl font-bold text-gray-800 uppercase text-center">Proposta Comercial</h1>',
  '        </div>',
  '',
  '        <div className="w-1/3 flex justify-end">',
  '          {empreendimento?.logo_url ? (',
  '            <img',
  '              src={empreendimento.logo_url}',
  '              alt={`Logo ${empreendimento.nome || \'Empreendimento\'}`}',
  '              className="h-12 w-auto object-contain block"',
  '              crossOrigin="anonymous"',
  '            />',
  '          ) : (',
  '            <div className="flex flex-col items-end justify-center h-8">',
  '              <span className="text-lg font-bold text-gray-800 uppercase">{empreendimento?.nome}</span>',
  '            </div>',
  '          )}',
  '        </div>',
  '      </header>'
];

let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const logoUrl = empreendimento?.logo_url')) {
    lines[i] = ''; 
  }
  if (lines[i].includes('<header className="flex justify-between items-center border-b-2')) {
    startIdx = i;
  }
  if (startIdx !== -1 && lines[i].includes('</header>')) {
    endIdx = i;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  lines.splice(startIdx, endIdx - startIdx + 1, ...newHeader);
  fs.writeFileSync('components/SimuladorPrintView.js', lines.join('\n'));
  console.log('Successfully updated the header!');
} else {
  console.log('Error: Could not find header boundaries.');
}

