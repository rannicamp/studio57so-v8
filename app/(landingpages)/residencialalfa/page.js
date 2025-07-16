// Caminho do arquivo: app/(landingpages)/residencialalfa/page.js

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import FormularioDeContato from './FormularioDeContato';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapPin, faMountain, faShieldAlt, faChartLine, faRulerCombined, faHandshake } from '@fortawesome/free-solid-svg-icons';

export default function PaginaResidencialAlfa() {

  const imagemCapaVaziaUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa//capa%20vazia.png";
  const imagemTatiUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa//tatisemfundo.png";
  const logoAlfaUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa//Logo%20-%20Residencial%20ALFA%20-%206.png";

  const animacaoDeEntrada = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <div className="bg-white font-sans">

      {/* SEÇÃO 1: CAPA MINIMALISTA E RESPONSIVA */}
      <section className="h-screen relative text-white overflow-hidden">
        {/* Imagem de fundo */}
        <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: `url('${imagemCapaVaziaUrl}')` }}>
          <div className="absolute inset-0 bg-black bg-opacity-15"></div>
        </div>

        {/* --- LAYOUT PARA TELAS GRANDES (md: e maior) --- */}
        <div className="hidden md:block w-full h-full relative">
            {/* Tati (Canto Inferior Esquerdo) */}
            <motion.div
              variants={animacaoDeEntrada}
              initial="initial" animate="animate" transition={{ duration: 0.8, delay: 0.4 }}
              className="absolute left-0 bottom-0 h-[90%] w-auto z-10"
            >
              <img src={imagemTatiUrl} alt="Tati" className="h-full w-auto object-contain" />
            </motion.div>
            
            {/* Logo Alfa (Perfeitamente Centralizada) */}
            <motion.div
              variants={animacaoDeEntrada}
              initial="initial" animate="animate" transition={{ duration: 0.8, delay: 0.2 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
            >
              <img src={logoAlfaUrl} alt="Logo Residencial Alfa" className="h-96" />
            </motion.div>
        </div>
        
        {/* --- LAYOUT PARA CELULAR (padrão) --- */}
        <div className="relative z-20 flex flex-col justify-center items-center h-full w-full md:hidden text-center p-4">
            {/* Logo Alfa (Topo) */}
            <motion.div
                variants={animacaoDeEntrada} initial="initial" animate="animate" transition={{ duration: 0.8, delay: 0.2 }}
                className="w-full"
            >
                <img src={logoAlfaUrl} alt="Logo Residencial Alfa" className="h-32 mx-auto" />
            </motion.div>

            {/* Tati (Ancorada em baixo) */}
            <motion.div
                variants={animacaoDeEntrada} initial="initial" animate="animate" transition={{ duration: 0.8, delay: 0.4 }}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[60%]"
            >
                <img src={imagemTatiUrl} alt="Tati" className="h-full w-full object-contain" />
            </motion.div>
        </div>
      </section>

      {/* Restante das seções (sem alterações) */}
      <section className="py-20 px-4 text-center">
        <h2 className="text-4xl font-bold text-gray-800 mb-12">O Residencial Alfa é perfeito para você</h2>
        <div className="container mx-auto grid md:grid-cols-2 gap-12">
          <div className="bg-gray-50 p-8 rounded-lg">
            <h3 className="text-2xl font-bold text-blue-600 mb-4">Para Morar</h3>
            <p className="text-gray-600 text-lg">Ideal para casais e pequenas famílias que buscam um lar com layout moderno, conforto, praticidade e uma localização segura, perto de tudo o que você precisa.</p>
          </div>
          <div className="bg-gray-50 p-8 rounded-lg">
            <h3 className="text-2xl font-bold text-blue-600 mb-4">Para Investir</h3>
            <p className="text-gray-600 text-lg">Uma oportunidade única para investidores que buscam retorno garantido, com potencial de alta rentabilidade através de aluguéis e valorização do imóvel.</p>
          </div>
        </div>
      </section>

      <section id="diferenciais" className="py-20 px-4 bg-gray-100">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-800 mb-12">Vantagens que fazem a diferença</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faMapPin} className="text-5xl text-blue-500 mb-4" /><h3 className="font-bold text-lg text-gray-700">Localização Estratégica</h3></div>
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faMountain} className="text-5xl text-blue-500 mb-4" /><h3 className="font-bold text-lg text-gray-700">Vista para o Pico da Ibituruna</h3></div>
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faShieldAlt} className="text-5xl text-blue-500 mb-4" /><h3 className="font-bold text-lg text-gray-700">Bairro Seguro e Ventilado</h3></div>
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faChartLine} className="text-5xl text-blue-500 mb-4" /><h3 className="font-bold text-lg text-gray-700">Alto Potencial de Valorização</h3></div>
          </div>
        </div>
      </section>

      <section id="galeria" className="py-20 px-4">
        <h2 className="text-4xl font-bold text-center mb-12 text-gray-800">Conheça seu futuro lar</h2>
        <div className="container mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          <div className="overflow-hidden rounded-lg shadow-lg"><img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/imagem-galeria-1.jpg" alt="Área Gourmet" className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500" /></div>
          <div className="overflow-hidden rounded-lg shadow-lg"><img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/imagem-galeria-2.jpg" alt="Sala Integrada" className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500" /></div>
          <div className="overflow-hidden rounded-lg shadow-lg"><img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/imagem-galeria-3.jpg" alt="Quarto" className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500" /></div>
          <div className="overflow-hidden rounded-lg shadow-lg"><img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/imagem-galeria-4.jpg" alt="Fachada" className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500" /></div>
        </div>
      </section>

      <section id="plantas" className="py-20 px-4 bg-gray-100">
        <h2 className="text-4xl font-bold text-center mb-12 text-gray-800">Plantas Inteligentes para o seu Estilo de Vida</h2>
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg shadow-lg">
              <img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/planta-tipo-1.jpg" alt="Planta Tipo 1 - 58,86 m²" className="w-full rounded-md" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-gray-800">Apartamento Tipo 1</h3>
            <p className="font-semibold text-gray-600">58,86 m² de área privativa</p>
          </div>
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg shadow-lg">
              <img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/planta-tipo-2.jpg" alt="Planta Tipo 2 - 49,76 m²" className="w-full rounded-md" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-gray-800">Apartamento Tipo 2</h3>
            <p className="font-semibold text-gray-600">49,76 m² de área privativa</p>
          </div>
        </div>
        <div className="text-center mt-12 bg-blue-50 p-6 rounded-lg container mx-auto max-w-4xl">
          <FontAwesomeIcon icon={faRulerCombined} className="text-4xl text-blue-500 mb-3" /><h4 className="text-2xl font-bold text-gray-800">Flexibilidade para o seu projeto</h4>
          <p className="text-gray-600 mt-2">A laje nervurada do Residencial Alfa permite a personalização das paredes internas e até mesmo a junção de unidades, criando um espaço único para você.</p>
        </div>
      </section>

      <section id="investimento" className="py-20 px-4 bg-white text-center">
        <div className="container mx-auto max-w-4xl">
          <FontAwesomeIcon icon={faHandshake} className="text-5xl text-blue-500 mb-4" /><h2 className="text-4xl font-bold text-gray-800 mb-4">Um Investimento Inteligente e Seguro</h2>
          <p className="text-lg text-gray-600 mb-6">Governador Valadares é a capital mundial do voo livre e recebe milhares de turistas. O Residencial Alfa é a opção ideal para aluguel temporário, com uma demanda constante e alto retorno financeiro.</p>
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-6 rounded-lg inline-block">
            <p className="font-bold text-xl">Renda estimada de até</p>
            <p className="text-5xl font-extrabold tracking-tight">R$ 4.144,25/mês</p>
            <p className="text-sm mt-1">com aluguéis de curta temporada.</p>
          </div>
          <p className="text-sm text-gray-500 mt-6">Empreendimento com registro de incorporação N° 24.920/R-08, garantindo total segurança e transparência na sua compra.</p>
        </div>
      </section>

      <section id="contato" className="py-20 px-4 bg-gray-800">
        <div className="container mx-auto">
          <FormularioDeContato />
        </div>
      </section>

      <footer className="bg-black text-white py-8 text-center">
        <p>&copy; {new Date().getFullYear()} Studio 57. Todos os direitos reservados.</p>
        <p className="opacity-70">Desenvolvido com a plataforma Stella.</p>
      </footer>
    </div>
  );
}