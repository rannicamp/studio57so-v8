const fs = require('fs');

const filePath = 'c:\\Projetos\\studio57so-v8\\app\\(landingpages)\\betasuites\\BetaSuitesClient.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Tese de Investimento (Substituindo Pré-Lançamento)
const oldPreLancamento = /\{\/\* --- SEGUNDA DOBRA: PRÉ-LANÇAMENTO \(Efeito Vidro\) ---\*\/\}[\s\S]*?\{\/\* --- CARACTERÍSTICAS \(Efeito Vidro\) ---\*\/\}/;

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
 </section>
 {/* --- CARACTERÍSTICAS (Efeito Vidro) --- */}`;

content = content.replace(oldPreLancamento, teseInvestimento);

// 2. Localização Estratégica (Split-Screen)
const oldLocalizacao = /\{\/\* --- LOCALIZAÇÃO \(Efeito Vidro\) ---\*\/\}[\s\S]*?\{\/\* --- MAPA ---\*\/\}/;

const localizacaoSplit = `{/* --- LOCALIZAÇÃO (Split-Screen) --- */}
 <section className="flex flex-col lg:flex-row-reverse min-h-[80vh] bg-black border-t border-white/10 relative">
 <div className="w-full lg:w-1/2 p-8 md:p-16 flex flex-col justify-center">
 <h3 className="text-2xl md:text-4xl font-bold text-white mb-12">
 Localização Estratégica
 </h3>
 <div className="relative max-w-md">
 <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-white/20"></div>
 {locationPoints.map((point, index) => (
 <div key={index} className={\`relative pl-10 \${index === locationPoints.length - 1 ? '' : 'pb-8'}\`}>
 <div className={\`absolute left-0 top-1 w-5 h-5 rounded-full border-4 border-black shadow-sm \${
 point.highlight ? 'bg-white' : 'bg-white/20'
 }\`}
 ></div>
 <div className="flex items-center">
 <FontAwesomeIcon icon={point.icon} className={\`text-2xl mr-4 \${point.highlight ? 'text-white' : 'text-gray-500'}\`} />
 <div>
 <p className={\`font-bold \${point.highlight ? 'text-white text-lg' : 'text-gray-400'}\`}>
 {point.name}
 </p>
 <p className="text-sm text-gray-500">{point.time}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto relative">
 <Image
 src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/A_photorealistic_cinematic_202604241025.jpeg"
 alt="Localização Beta Suítes"
 fill
 className="object-cover object-center"
 sizes="(max-width: 1024px) 100vw, 50vw"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent lg:bg-gradient-to-l lg:from-black lg:via-black/20 lg:to-transparent"></div>
 </div>
 </section>

 {/* --- MAPA --- */}`;

content = content.replace(oldLocalizacao, localizacaoSplit);

// 3. Mapa Full Width
const oldMapa = /\{\/\* --- MAPA ---\*\/\}[\s\S]*?\{\/\* --- PLANTAS HUMANIZADAS ---\*\/\}/;

const novoMapa = `{/* --- MAPA --- */}
 <section className="bg-black">
 <div className="w-full h-[450px] md:h-[500px]">
 <iframe
 src="https://www.google.com/maps/embed?pb=!1m36!1m12!1m3!1d1406.7668664421653!2d-41.93523043979589!3d-18.845965731907636!2m3!1f0!2f3.3625754675593953!3f0!3m2!1i1024!2i768!4f35!4m21!3e0!4m3!3m2!1d-18.8447997!2d-41.9397703!4m3!3m2!1d-18.84961!2d-41.9359756!4m5!1s0xb1a767bd784531%3A0x855bd5fb993c76a5!2sCoelho%20Diniz%20-%20S%C3%A3o%20Pedro%2C%20R.%20Israel%20Pinheiro%2C%201199%20-%20S%C3%A3o%20Pedro%2C%20Gov.%20Valadares%20-%20MG%2C%2035020-360!3m2!1d-18.8484849!2d-41.9331952!4m5!1s0xb1a7b586fbedd1%3A0xb1d26020f6e72b61!2sBigmais%20S%C3%A3o%20Pedro%2C%20R.%20Israel%20Pinheiro%2C%20963%20-%20S%C3%A3o%20Pedro%2C%20Gov.%20Valadares%20-%20MG%2C%2035020-220!3m2!1d-18.8477787!2d-41.9315056!5e1!3m2!1spt-BR!2sbr!4v1777038354271!5m2!1spt-BR!2sbr"
 width="100%"
 height="100%"
 style={{ border: 0 }}
 allowFullScreen=""
 loading="lazy"
 referrerPolicy="no-referrer-when-downgrade"
 ></iframe>
 </div>
 </section>
 {/* --- PLANTAS HUMANIZADAS --- */}`;

content = content.replace(oldMapa, novoMapa);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Restoration successful!');
