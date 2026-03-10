'use client';

import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { Montserrat } from 'next/font/google';

// Configurando a fonte exata do design original com vários pesos
const montserrat = Montserrat({ 
  subsets: ['latin'], 
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-montserrat'
});

export default function GeradorAnunciosProPage() {
  const [loading, setLoading] = useState(false);

  // --- DADOS EDITÁVEIS ---
  const [dados, setDados] = useState({
    preco: '429.204',
    entrada: '20%',
    parcelas: '420',
    textoChamada: 'O SONHO DA CASA PRÓPRIA',
    subtitulo: 'Financiamento facilitado pela Caixa',
    telefone: '(33) 99999-9999'
  });

  // Links das imagens (Supabase)
  const imgFachada = 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png';
  const imgInterior = 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018929039.png';
  const imgLogoAlfa = 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759008548201.png';
  // Logo Caixa Branca (para fundos escuros)
  const logoCaixaWhite = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Logo_Caixa_Economica_Federal_%28branca%29.svg/2560px-Logo_Caixa_Economica_Federal_%28branca%29.svg.png';
  
  const refs = useRef([]);

  // --- FUNÇÃO DE DOWNLOAD (Melhorada para qualidade máxima) ---
  const baixarImagem = async (index, nomeArquivo) => {
    const elemento = refs.current[index];
    if (!elemento) return;
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 200)); // Delay para garantir renderização das fontes
      const canvas = await html2canvas(elemento, {
        scale: 3, // Escala 3x para qualidade Cristalina em telas Retina
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        imageTimeout: 0,
      });
      const link = document.createElement('a');
      link.download = `${nomeArquivo}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      console.error("Erro:", err);
      alert("Erro ao gerar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setDados({ ...dados, [e.target.name]: e.target.value });
  };

  // Estilo base para garantir a fonte em tudo
  const fontStyle = { fontFamily: montserrat.style.fontFamily };

  return (
    <div className={`min-h-screen bg-gray-100 p-8 ${montserrat.variable}`} style={fontStyle}>
      
      {/* PAINEL DE CONTROLE */}
      <div className="max-w-6xl mx-auto mb-12 bg-white p-6 rounded-xl shadow-lg border-t-4 border-[#005ca9]">
        <h1 className="text-2xl font-black text-[#45301f] mb-6 uppercase tracking-tight flex items-center">
          <span className="text-4xl text-[#005ca9] mr-2">///</span> Gerador de Anúncios PRO
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Título Principal</label>
            <input name="textoChamada" value={dados.textoChamada} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg text-[#45301f] font-bold focus:border-[#005ca9] outline-none transition" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Subtítulo</label>
            <input name="subtitulo" value={dados.subtitulo} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg text-[#45301f] focus:border-[#005ca9] outline-none transition" />
          </div>
           <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Preço (R$)</label>
            <input name="preco" value={dados.preco} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg text-[#45301f] font-black text-lg focus:border-[#005ca9] outline-none transition" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Entrada</label>
                <input name="entrada" value={dados.entrada} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg text-[#45301f] font-bold focus:border-[#005ca9] outline-none transition" />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Parcelas</label>
                <input name="parcelas" value={dados.parcelas} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg text-[#45301f] font-bold focus:border-[#005ca9] outline-none transition" />
            </div>
          </div>
           <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">WhatsApp</label>
            <input name="telefone" value={dados.telefone} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg text-[#45301f] focus:border-[#005ca9] outline-none transition" />
          </div>
        </div>
      </div>

      {/* GRID DE ANÚNCIOS */}
      <div className="flex flex-wrap justify-center gap-16 pb-32">

        {/* ==================================================================================
            VARIAÇÃO 1: CLÁSSICA CANVA (Tarja Azul Central, Fundo Claro)
            Foco: Réplica exata do estilo "Financiamento Caixa" que você enviou.
        ================================================================================== */}
        <div className="flex flex-col items-center group">
          <div className="relative shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[2em] transition-transform duration-300 group-hover:scale-[1.01]">
            <div 
              ref={el => refs.current[0] = el}
              // Tamanho exato de Story (1080x1920) reduzido proporcionalmente para visualização (360x640)
              className="w-[360px] h-[640px] relative bg-white flex flex-col overflow-hidden rounded-[2em]"
              style={fontStyle}
            >
              {/* Imagem Topo com Fade Branco */}
              <div className="h-[55%] relative">
                 <img src={imgFachada} className="w-full h-full object-cover" crossOrigin="anonymous" />
                 {/* Gradiente para suavizar a transição para o branco */}
                 <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white to-transparent"></div>
                 <img src={imgLogoAlfa} className="absolute top-8 left-1/2 -translate-x-1/2 w-32 drop-shadow-lg" crossOrigin="anonymous" />
              </div>

              {/* Tarja Azul Caixa */}
              <div className="bg-[#005ca9] py-4 px-2 relative z-10 -mt-8 mx-4 rounded-xl shadow-lg flex items-center justify-center">
                  <img src={logoCaixaWhite} className="h-8 mr-4" crossOrigin="anonymous" alt="Caixa" />
                  <span className="text-white font-black uppercase tracking-wider text-lg">Financiamento</span>
              </div>

              {/* Conteúdo Inferior */}
              <div className="flex-grow pt-6 pb-10 px-8 flex flex-col items-center text-center relative">
                 <h2 className="text-[#45301f] text-2xl font-black uppercase leading-none mb-2 tracking-tight">
                    {dados.textoChamada}
                 </h2>
                 <p className="text-gray-500 text-sm font-medium mb-6">{dados.subtitulo}</p>

                 {/* Preço Gigante */}
                 <div className="mb-6">
                     <p className="text-[#45301f] text-xs font-bold uppercase tracking-[0.2em] mb-1">A partir de</p>
                     <p className="text-[#005ca9] text-5xl font-black tracking-tighter" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.05)' }}>
                        R$<span className="text-6xl">{dados.preco.split(',')[0]}</span>
                     </p>
                 </div>

                {/* Detalhes em Grid */}
                 <div className="w-full grid grid-cols-2 gap-4 text-[#45301f]">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 uppercase font-bold">Entrada</p>
                        <p className="text-xl font-black">{dados.entrada}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 uppercase font-bold">Prazo</p>
                        <p className="text-xl font-black">{dados.parcelas}x</p>
                    </div>
                 </div>
              </div>
            </div>
          </div>
          <BotaoDownload index={0} loading={loading} onClick={baixarImagem} nome="classico-caixa" />
        </div>


        {/* ==================================================================================
            VARIAÇÃO 2: PREMIUM DARK (Fundo Escuro, Texto Branco/Laranja)
            Foco: Sofisticação, alto padrão. O laranja (#f7941d) é usado para destaque.
        ================================================================================== */}
        <div className="flex flex-col items-center group">
          <div className="relative shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2em] transition-transform duration-300 group-hover:scale-[1.01]">
            <div 
              ref={el => refs.current[1] = el}
              className="w-[360px] h-[640px] relative bg-[#1a1a1a] flex flex-col overflow-hidden rounded-[2em]"
              style={fontStyle}
            >
              {/* Imagem de Fundo Total */}
              <img src={imgInterior} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity" crossOrigin="anonymous" />
              {/* Overlay Degradê Escuro Premium */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/80 to-transparent"></div>

              <div className="relative z-10 h-full flex flex-col p-8">
                 <img src={imgLogoAlfa} className="w-36 self-center mt-8 drop-shadow-2xl invert brightness-0" crossOrigin="anonymous" />

                 <div className="mt-auto mb-12">
                     {/* Tag Laranja */}
                     <span className="inline-block bg-[#f7941d] text-white text-xs font-black uppercase px-3 py-1 rounded-sm mb-4 tracking-widest">
                        Oportunidade Exclusiva
                     </span>
                     
                     <h2 className="text-white text-4xl font-black uppercase leading-[0.9] mb-4 tracking-tight">
                       {dados.textoChamada.split(' ').map((word, i) => i === 1 ? <span key={i} className="text-[#f7941d]">{word} </span> : word + ' ')}
                     </h2>
                     
                     <p className="text-gray-300 text-lg font-light mb-8">{dados.subtitulo}</p>

                     <div className="border-l-4 border-[#f7941d] pl-6">
                        <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Investimento</p>
                        <p className="text-white text-5xl font-black tracking-tighter">
                            R$ {dados.preco}
                        </p>
                        <div className="flex items-center mt-4 text-gray-300 text-sm font-bold">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-[#f7941d] mr-2" />
                            Entrada facilitada de {dados.entrada}
                        </div>
                     </div>
                 </div>
                 
                 <div className="absolute bottom-6 right-8 flex items-center opacity-80">
                    <img src={logoCaixaWhite} className="h-6 w-auto mr-3" crossOrigin="anonymous" />
                    <span className="text-white text-sm font-bold uppercase tracking-wider">Financiamento</span>
                 </div>
              </div>
            </div>
          </div>
          <BotaoDownload index={1} loading={loading} onClick={baixarImagem} nome="premium-dark" />
        </div>


        {/* ==================================================================================
            VARIAÇÃO 3: MODERNA / SPLIT (Metade Foto, Metade Informação)
            Foco: Limpeza visual, hierarquia clara, foco no preço e na marca.
        ================================================================================== */}
        <div className="flex flex-col items-center group">
          <div className="relative shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[2em] transition-transform duration-300 group-hover:scale-[1.01]">
            <div 
              ref={el => refs.current[2] = el}
              className="w-[360px] h-[640px] relative bg-white flex flex-col overflow-hidden rounded-[2em]"
              style={fontStyle}
            >
               {/* Metade Superior: Imagem */}
               <div className="h-1/2 relative">
                 <img src={imgFachada} className="w-full h-full object-cover" crossOrigin="anonymous" />
                 {/* Tarja Diagonal Laranja */}
                 <div className="absolute top-4 left-0 bg-[#f7941d] text-white text-xs font-black uppercase py-2 px-6 transform -skew-x-12 shadow-md z-10">
                    Últimas Unidades
                 </div>
               </div>

               {/* Metade Inferior: Conteúdo Clean */}
               <div className="h-1/2 p-8 flex flex-col relative">
                 {/* Logo como marca d'água sutil */}
                 <img src={imgLogoAlfa} className="absolute top-0 right-0 w-64 opacity-5 -translate-y-1/2 translate-x-1/4" crossOrigin="anonymous" />
                 
                 <div className="relative z-10 flex-grow flex flex-col justify-center">
                    <h2 className="text-[#45301f] text-3xl font-black uppercase leading-none mb-2">
                        {dados.textoChamada}
                    </h2>
                    <div className="w-20 h-2 bg-[#005ca9] mb-6"></div>

                    <div className="flex items-end mb-8">
                        <div>
                            <p className="text-[#005ca9] text-sm font-bold uppercase tracking-wider mb-1">Apenas</p>
                            <p className="text-[#45301f] text-6xl font-black tracking-tighter leading-none">
                                {dados.preco.split('.')[0]}
                                <span className="text-3xl">.{dados.preco.split('.')[1]}</span>
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#005ca9]/10 p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center">
                             {/* Ícone Caixa (SVG inline para garantir cor) */}
                            <svg className="w-8 h-8 text-[#005ca9] mr-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                            <div>
                                <p className="text-[#005ca9] font-black uppercase text-sm leading-none">Financiamento</p>
                                <p className="text-[#45301f] font-bold text-xs">Caixa Econômica</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[#45301f] font-black text-lg leading-none">{dados.entrada}</p>
                            <p className="text-[#005ca9] font-bold text-xs uppercase">Entrada</p>
                        </div>
                    </div>
                 </div>
                  <p className="text-center text-gray-400 text-xs font-bold mt-4 flex items-center justify-center">
                     <FontAwesomeIcon icon={faCheckCircle} className="text-[#f7941d] mr-2" />
                     Chame no WhatsApp: {dados.telefone}
                  </p>
               </div>
            </div>
          </div>
          <BotaoDownload index={2} loading={loading} onClick={baixarImagem} nome="moderno-split" />
        </div>

      </div>
    </div>
  );
}

// Componente do Botão para limpar o código principal
function BotaoDownload({ index, loading, onClick, nome }) {
    return (
        <button 
        onClick={() => onClick(index, nome)} 
        disabled={loading}
        className="mt-8 group-hover:-translate-y-2 transition-all duration-300 bg-[#45301f] text-white px-10 py-4 rounded-full hover:bg-[#005ca9] flex items-center gap-3 font-black uppercase tracking-wider shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
             <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        ) : (
            <FontAwesomeIcon icon={faDownload} className="text-lg" />
        )}
        {loading ? 'Gerando Alta Resolução...' : 'Baixar PNG'}
      </button>
    )
}