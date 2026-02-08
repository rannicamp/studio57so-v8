// Caminho: app/(landingpages)/migracao/page.js
'use client';

import Image from 'next/image';
import { Montserrat } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// Correção aqui: Mantivemos apenas os ícones sólidos nesta importação
import { 
    faBuildingColumns, 
    faRightLeft, 
    faHandHoldingDollar, 
    faCheck 
} from '@fortawesome/free-solid-svg-icons';
// Correção aqui: Importamos o WhatsApp do pacote de marcas (brands)
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

// Fontes
const montserrat = Montserrat({
    subsets: ['latin'],
    weight: ['300', '400', '500', '700', '900'],
});

// URLs das Logos
const LOGO_ALFA = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759008548201.png";
const LOGO_BETA = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/LOGO-P_1764944035362.png";
const LOGO_STUDIO57 = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG";

export default function PlanoMigracaoPage() {

    const getWhatsappLink = (plano) => {
        const mensagem = `Olá! Tenho interesse no plano de *${plano}*. Poderia me explicar melhor?`;
        return `https://wa.me/5533998192119?text=${encodeURIComponent(mensagem)}`;
    };

    return (
        <div className={`${montserrat.className} min-h-screen bg-gray-50 flex flex-col`}>
            
            {/* --- HEADER STUDIO 57 REFORMULADO --- */}
            <header className="bg-black text-white py-10 border-b border-gray-800">
                <div className="w-full px-4">
                    {/* Flex Container: Em mobile fica coluna, em Desktop fica lado a lado (row) */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
                        
                        {/* 1. Logo Studio 57 - Aumentado */}
                        <div className="relative w-48 md:w-64 h-auto flex-shrink-0">
                            <Image 
                                src={LOGO_STUDIO57} 
                                alt="Studio 57" 
                                width={300} 
                                height={100} 
                                className="object-contain filter invert opacity-100" // Removi qualquer transparência
                                priority
                            />
                        </div>

                        {/* Divisória Vertical (Aparece só no PC para separar logo do texto) */}
                        <div className="hidden md:block w-px h-20 bg-gray-800"></div>

                        {/* 2. Título e Subtítulo */}
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl md:text-5xl font-light tracking-widest uppercase leading-tight">
                                Plano de <span className="font-bold text-orange-500 block md:inline">Transição</span>
                            </h1>
                            <p className="text-gray-400 text-sm md:text-lg mt-2 tracking-wide font-medium">
                                Estratégias personalizadas para seu investimento
                            </p>
                        </div>

                    </div>
                </div>
            </header>

            {/* --- CONTEÚDO PRINCIPAL --- */}
            <main className="flex-grow py-16 px-4">
                <div className="w-full max-w-7xl">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                        
                        {/* === OPÇÃO 1: ALFA (Estilo Clássico/Light) === */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 flex flex-col transition-transform hover:-translate-y-1 duration-300 group">
                            <div className="bg-gray-100 p-6 flex justify-center items-center h-32 border-b border-gray-200 group-hover:bg-gray-200 transition-colors">
                                <Image 
                                    src={LOGO_ALFA} 
                                    alt="Residencial Alfa" 
                                    width={180} 
                                    height={80} 
                                    className="object-contain max-h-full"
                                />
                            </div>
                            
                            <div className="p-8 flex-grow flex flex-col">
                                <h3 className="text-xl font-bold text-gray-800 mb-1">Financiamento</h3>
                                <div className="flex items-center space-x-2 mb-6">
                                    <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">CAIXA</span>
                                    <span className="text-xs text-gray-500">Opção Padrão</span>
                                </div>

                                <div className="text-center mb-8">
                                    <p className="text-gray-500 text-sm">Prazo de até</p>
                                    <p className="text-4xl font-bold text-[#45301f]">420 meses</p>
                                </div>

                                <ul className="space-y-4 mb-8 flex-grow">
                                    <li className="flex items-start text-sm text-gray-600">
                                        <FontAwesomeIcon icon={faBuildingColumns} className="text-[#45301f] mt-1 mr-3 w-4" />
                                        <span>Financiamento do saldo pela <strong>Caixa Econômica</strong>.</span>
                                    </li>
                                    <li className="flex items-start text-sm text-gray-600">
                                        <FontAwesomeIcon icon={faCheck} className="text-[#45301f] mt-1 mr-3 w-4" />
                                        Sujeito a análise de crédito.
                                    </li>
                                    <li className="flex items-start text-sm text-gray-600">
                                        <FontAwesomeIcon icon={faCheck} className="text-[#45301f] mt-1 mr-3 w-4" />
                                        Renda comprovada no Brasil.
                                    </li>
                                </ul>

                                <a 
                                    href={getWhatsappLink('Financiamento Alfa/Caixa')}
                                    target="_blank"
                                    className="w-full block text-center py-3 rounded-lg border-2 border-[#45301f] text-[#45301f] font-bold hover:bg-[#45301f] hover:text-white transition-colors uppercase text-sm tracking-wide"
                                >
                                    Simular Caixa
                                </a>
                            </div>
                        </div>

                        {/* === OPÇÃO 2: BETA (DESTAQUE - Estilo Dark/Premium) === */}
                        <div className="bg-black rounded-2xl shadow-2xl overflow-hidden border-2 border-orange-500 flex flex-col transform md:-translate-y-6 md:scale-105 relative z-10">
                            
                            {/* Faixa de Destaque */}
                            <div className="bg-orange-600 text-white text-center py-2 text-xs font-bold uppercase tracking-widest shadow-md">
                                Recomendado pelo Studio 57
                            </div>

                            <div className="p-6 flex justify-center items-center h-32 bg-gradient-to-b from-gray-900 to-black">
                                <Image 
                                    src={LOGO_BETA} 
                                    alt="Beta Suítes" 
                                    width={160} 
                                    height={80} 
                                    className="object-contain max-h-full transform hover:scale-105 transition-transform"
                                />
                            </div>
                            
                            <div className="p-8 flex-grow flex flex-col text-white">
                                <h3 className="text-2xl font-bold text-white mb-1">Migração Beta</h3>
                                <p className="text-orange-500 text-sm font-bold mb-6 uppercase tracking-wide">Investimento Inteligente</p>

                                <div className="text-center mb-6 bg-gray-900 rounded-lg p-4 border border-gray-800 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500 opacity-10 rounded-bl-full"></div>
                                    <p className="text-gray-400 text-sm mb-1">Seu saldo vale</p>
                                    <p className="text-5xl font-bold text-white">+20%</p>
                                    <p className="text-orange-500 text-sm font-bold mt-1">na troca de unidade</p>
                                </div>

                                <p className="text-gray-300 text-sm italic mb-8 text-center px-4 border-l-2 border-orange-500 pl-4">
                                    "Transforme R$ 100 mil pagos em <span className="text-white font-bold">R$ 120 mil</span> de crédito imediato."
                                </p>

                                <ul className="space-y-4 mb-8 flex-grow">
                                    <li className="flex items-start text-sm text-gray-300">
                                        <FontAwesomeIcon icon={faRightLeft} className="text-orange-500 mt-1 mr-3 w-4" />
                                        Migração de <strong>100% do capital</strong>.
                                    </li>
                                    <li className="flex items-start text-sm text-gray-300">
                                        <FontAwesomeIcon icon={faCheck} className="text-orange-500 mt-1 mr-3 w-4" />
                                        Alta liquidez (Suítes).
                                    </li>
                                    <li className="flex items-start text-sm text-gray-300">
                                        <FontAwesomeIcon icon={faCheck} className="text-orange-500 mt-1 mr-3 w-4" />
                                        Sem burocracia bancária.
                                    </li>
                                </ul>

                                <a 
                                    href={getWhatsappLink('Migração Beta com Bônus')}
                                    target="_blank"
                                    className="w-full block text-center py-4 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-lg shadow-orange-900/50 hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-[1.02] uppercase tracking-wider"
                                >
                                    Quero Migrar Agora
                                </a>
                            </div>
                        </div>

                        {/* === OPÇÃO 3: RECAPITALIZAÇÃO (Estilo Financeiro) === */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 flex flex-col transition-transform hover:-translate-y-1 duration-300 group">
                            <div className="bg-gray-50 p-6 flex justify-center items-center h-32 border-b border-gray-200 group-hover:bg-gray-100 transition-colors">
                                <div className="text-center">
                                    <FontAwesomeIcon icon={faHandHoldingDollar} className="text-4xl text-green-700 mb-2" />
                                    <h4 className="font-bold text-gray-700 text-sm uppercase">Recapitalização</h4>
                                </div>
                            </div>
                            
                            <div className="p-8 flex-grow flex flex-col">
                                <h3 className="text-xl font-bold text-gray-800 mb-1">Resgate</h3>
                                <p className="text-sm text-green-700 font-bold mb-6 uppercase">Venda da Unidade</p>

                                <div className="text-center mb-8">
                                    <p className="text-gray-500 text-sm">Correção de</p>
                                    <p className="text-4xl font-bold text-green-700">15%</p>
                                    <p className="text-gray-400 text-xs mt-1">sobre o valor pago</p>
                                </div>

                                <ul className="space-y-4 mb-8 flex-grow">
                                    <li className="flex items-start text-sm text-gray-600">
                                        <FontAwesomeIcon icon={faCheck} className="text-green-700 mt-1 mr-3 w-4" />
                                        Devolução com ágio (30k entrada + 18x).
                                    </li>
                                    <li className="flex items-start text-sm text-red-600 font-medium bg-red-50 p-3 rounded border border-red-100">
                                        <span className="mr-2">⚠️</span>
                                        <span className="leading-tight">Pagamento inicia <strong>após a revenda</strong>.</span>
                                    </li>
                                    <li className="flex items-start text-sm text-gray-600">
                                        <FontAwesomeIcon icon={faCheck} className="text-green-700 mt-1 mr-3 w-4" />
                                        Mantém pagamentos até a venda.
                                    </li>
                                </ul>

                                <a 
                                    href={getWhatsappLink('Recapitalização/Resgate')}
                                    target="_blank"
                                    className="w-full block text-center py-3 rounded-lg border border-gray-300 text-gray-600 font-bold hover:bg-gray-50 hover:text-gray-900 transition-colors uppercase text-sm tracking-wide"
                                >
                                    Solicitar Resgate
                                </a>
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            {/* --- FOOTER STUDIO 57 --- */}
            <footer className="bg-black text-gray-500 py-10 border-t border-gray-800 text-center text-sm">
                <div className="w-full px-4">
                    <p className="mb-4">© {new Date().getFullYear()} Studio 57 Arquitetura e Incorporação</p>
                    <div className="flex justify-center items-center space-x-2">
                        <FontAwesomeIcon icon={faWhatsapp} className="text-green-500" />
                        <a href="https://wa.me/5533998192119" className="hover:text-white transition-colors">
                            Precisa de ajuda? Fale conosco.
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}