const fs = require('fs');

const filePath = 'c:\\Projetos\\studio57so-v8\\app\\(landingpages)\\betasuites\\BetaSuitesClient.js';
let content = fs.readFileSync(filePath, 'utf8');

// The exact string in the file (using index of)
const startMarker = '{/* --- SEGUNDA DOBRA: PRÉ-LANÇAMENTO (Efeito Vidro) --- */}';
const endMarker = '{/* --- CARACTERÍSTICAS (Efeito Vidro) --- */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const oldContent = content.substring(startIndex, endIndex);

  const teseInvestimento = `{/* --- TESE DE INVESTIMENTO (Split-Screen) --- */}
 <section className="flex flex-col lg:flex-row min-h-[80vh] bg-black relative">
 <div className="w-full lg:w-1/2 p-8 md:p-16 flex flex-col justify-center relative z-10">
 <div className="inline-block bg-blue-600/10 text-blue-500 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-widest mb-6 border border-blue-600/20 self-start">
 Oportunidade Única
 </div>
 <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
 Tese de Investimento
 </h2>
 <p className="text-gray-300 text-lg mb-6 leading-relaxed">
 O Beta Suítes é o ativo imobiliário mais inteligente do Alto Esplanada. Projetado milimetricamente para o público estudantil de alta renda e profissionais de saúde.
 </p>
 <div className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm mb-8">
 <h3 className="text-xl font-bold text-white mb-2">Rentabilidade Projetada</h3>
 <p className="text-gray-400">
 Baseado no estudo de viabilidade, uma unidade pode render no mínimo <strong className="text-blue-400 text-2xl">R$ 4.200,00</strong> por mês, considerando um cenário conservador de apenas <strong className="text-white">70% de ocupação</strong>.
 </p>
 </div>
 <button
 onClick={openLeadModal}
 className="inline-block w-full sm:w-auto text-center bg-blue-600 text-white font-bold py-4 px-10 rounded-lg hover:bg-blue-500 transition-colors duration-300 shadow-lg shadow-blue-500/20 uppercase tracking-wide"
 >
 Quero Aproveitar a Oportunidade
 </button>
 </div>
 <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto relative">
 <Image
 src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/A_photorealistic_cinematic_202604241009.jpeg"
 alt="Beta Suítes Pôr do Sol"
 fill
 className="object-cover object-right-bottom"
 sizes="(max-width: 1024px) 100vw, 50vw"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent lg:bg-gradient-to-r lg:from-black lg:via-black/20 lg:to-transparent"></div>
 </div>
 </section>\n `;

  content = content.replace(oldContent, teseInvestimento);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Tese de Investimento replaced successfully!');
} else {
  console.log('Markers not found!');
}
