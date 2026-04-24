const fs = require('fs');

const filePath = 'c:\\Projetos\\studio57so-v8\\app\\(landingpages)\\betasuites\\BetaSuitesClient.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Substituir o array de plantas
const oldArray = `// --- DADOS DAS PLANTAS ---
const floorPlanImages = [
 { id: 1, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765556400555.png', alt: 'Planta Humanizada Opção 1' },
 { id: 2, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765556372569.png', alt: 'Planta Humanizada Opção 2' },
 { id: 3, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765556336345.png', alt: 'Planta Humanizada Opção 3' },
 { id: 4, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765556430412.png', alt: 'Planta Humanizada Opção 4' },
];`;

const newArrays = `// --- DADOS DAS PLANTAS ---
const pavimentosImages = [
 { id: 1, name: 'Planta Térreo', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_terreo.webp', alt: 'Planta Humanizada Térreo' },
 { id: 2, name: 'Pavimento 1 (Garagem)', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_pav_1.webp', alt: 'Planta Humanizada Pavimento 1' },
 { id: 3, name: 'Pavimentos Tipo (Aptos)', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_pav_apartamentos.webp', alt: 'Planta Humanizada Pavimentos Tipo' },
 { id: 4, name: 'Pavimento Cobertura (Lazer)', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_cobertura.webp', alt: 'Planta Humanizada Cobertura' },
];

const suitesImages = [
 { id: 1, name: 'Suíte 01', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_suite_01.webp', alt: 'Planta Humanizada Suíte 01' },
 { id: 2, name: 'Suíte 02', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_suite_02.webp', alt: 'Planta Humanizada Suíte 02' },
 { id: 3, name: 'Suíte 03', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_suite_03.webp', alt: 'Planta Humanizada Suíte 03' },
 { id: 4, name: 'Suíte 04', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_suite_04.webp', alt: 'Planta Humanizada Suíte 04' },
 { id: 5, name: 'Suíte 05', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_suite_05.webp', alt: 'Planta Humanizada Suíte 05' },
 { id: 6, name: 'Suíte 06', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_suite_06.webp', alt: 'Planta Humanizada Suíte 06' },
 { id: 7, name: 'Suíte 07', src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/plantas/planta_humanizada_studios_beta_-_suite_07.webp', alt: 'Planta Humanizada Suíte 07' },
];`;

content = content.replace(oldArray, newArrays);

// 2. Substituir Layouts Inteligentes pela nova seção de Plantas Humanizadas
const regexLayouts = /\{\/\* --- LAYOUTS INTELIGENTES ---\*\/\}[\s\S]*?\{\/\* --- GALERIA COMPLETA ---\*\/\}/;

const novaSecao = `{/* --- PLANTAS HUMANIZADAS --- */}
 <section className="py-16 md:py-24 bg-black border-t border-white/10 relative overflow-hidden">
 <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-black to-black pointer-events-none -z-10"></div>
 
 <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
 <div className="text-center mb-16">
 <div className="inline-block bg-white/5 border border-white/10 text-gray-300 px-5 py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] mb-6 shadow-lg backdrop-blur-md">
 Arquitetura & Design
 </div>
 <h2 className="text-3xl md:text-5xl font-light text-white mb-6">
 Plantas <strong className="font-bold text-blue-500">Humanizadas</strong>
 </h2>
 <p className="max-w-2xl mx-auto text-gray-400 text-lg font-light leading-relaxed">
 Explore a distribuição inteligente dos espaços. Desde a área de lazer no rooftop até o design focado em rentabilidade e conforto nas suítes.
 </p>
 </div>

 {/* PAVIMENTOS - Swiper 1 */}
 <div className="mb-24">
 <h3 className="text-xl md:text-2xl text-white font-medium mb-8 flex items-center">
 <span className="w-8 h-[1px] bg-blue-500 mr-4"></span>
 Plantas dos Pavimentos
 </h3>
 <div className="relative rounded-2xl shadow-2xl overflow-hidden bg-white/5 border border-white/10 p-2 md:p-6">
 <Swiper
 slidesPerView={1}
 loop={true}
 pagination={{ clickable: true, dynamicBullets: true }}
 navigation={true}
 modules={[Pagination, Navigation]}
 className="floorplan-swiper"
 >
 {pavimentosImages.map((plan) => (
 <SwiperSlide key={plan.id}>
 <div className="relative group cursor-pointer flex flex-col items-center pb-12"
 onClick={() => openModal(plan.src)}
 >
 <div className="w-full h-[300px] md:h-[600px] relative rounded-xl overflow-hidden mb-4">
 <Image
 src={plan.src}
 alt={plan.alt}
 fill
 className="object-contain transition-transform duration-700 group-hover:scale-105"
 sizes="(max-width: 1024px) 100vw, 80vw"
 />
 </div>
 <div className="text-center">
 <h4 className="text-white text-lg font-bold tracking-wider uppercase bg-black/60 px-6 py-2 rounded-full border border-white/10 backdrop-blur-md inline-block">
 {plan.name}
 </h4>
 </div>
 </div>
 </SwiperSlide>
 ))}
 </Swiper>
 </div>
 </div>

 {/* SUÍTES - Swiper 2 */}
 <div>
 <h3 className="text-xl md:text-2xl text-white font-medium mb-8 flex items-center">
 <span className="w-8 h-[1px] bg-blue-500 mr-4"></span>
 Layout das Unidades (Suítes)
 </h3>
 <div className="relative rounded-2xl shadow-2xl overflow-hidden bg-white/5 border border-white/10 p-2 md:p-6">
 <Swiper
 breakpoints={{
 320: { slidesPerView: 1, spaceBetween: 20 },
 768: { slidesPerView: 2, spaceBetween: 30 },
 1024: { slidesPerView: 3, spaceBetween: 40 },
 }}
 loop={true}
 pagination={{ clickable: true, dynamicBullets: true }}
 navigation={true}
 modules={[Pagination, Navigation]}
 className="floorplan-swiper pb-16"
 >
 {suitesImages.map((plan) => (
 <SwiperSlide key={plan.id}>
 <div className="relative group cursor-pointer flex flex-col items-center bg-black/40 rounded-xl p-4 border border-white/5 hover:border-blue-500/30 transition-all duration-300"
 onClick={() => openModal(plan.src)}
 >
 <div className="w-full h-[250px] md:h-[350px] relative rounded-lg overflow-hidden mb-6">
 <Image
 src={plan.src}
 alt={plan.alt}
 fill
 className="object-contain transition-transform duration-700 group-hover:scale-110"
 sizes="(max-width: 768px) 100vw, 33vw"
 />
 </div>
 <h4 className="text-white text-md font-bold tracking-wider uppercase mb-2">
 {plan.name}
 </h4>
 <div className="w-12 h-1 bg-blue-600/50 rounded-full group-hover:w-full group-hover:bg-blue-500 transition-all duration-500"></div>
 </div>
 </SwiperSlide>
 ))}
 </Swiper>
 </div>
 </div>
 </div>
 </section>

 {/* --- GALERIA COMPLETA --- */}`;

content = content.replace(regexLayouts, novaSecao);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Update successful!');
