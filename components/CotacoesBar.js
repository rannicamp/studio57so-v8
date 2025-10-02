// Local do Arquivo: components/CotacoesBar.js
"use client";

import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChartLine, faDollarSign, faEuroSign, faTree, faGasPump, 
    faBox, faLeaf, faDroplet, faWind, faFire, faSun, faShieldHalved,
    faMugHot, faSeedling, faCarrot, faTractor, faSnowflake, faGem
} from '@fortawesome/free-solid-svg-icons';
import { faBitcoin } from '@fortawesome/free-brands-svg-icons';
import { useRef, useState, useEffect } from 'react';

// O mapa de ícones e a função de busca continuam os mesmos
const iconMap = {
    USD: { icon: faDollarSign, color: 'text-green-500' },
    EUR: { icon: faEuroSign, color: 'text-blue-500' },
    GBP: { icon: faDollarSign, color: 'text-purple-500' },
    JPY: { icon: faDollarSign, color: 'text-red-500' },
    CAD: { icon: faDollarSign, color: 'text-red-600' },
    AUD: { icon: faDollarSign, color: 'text-blue-700' },
    CHF: { icon: faDollarSign, color: 'text-red-400' },
    CNY: { icon: faDollarSign, color: 'text-yellow-500' },
    ARS: { icon: faDollarSign, color: 'text-cyan-500' },
    BTC: { icon: faBitcoin, color: 'text-orange-500' },
    ETH: { icon: faGem, color: 'text-gray-400' },
    lumber: { icon: faTree, color: 'text-yellow-700' },
    aluminum: { icon: faBox, color: 'text-gray-400' },
    brent_crude_oil: { icon: faGasPump, color: 'text-orange-700' },
    coal: { icon: faBox, color: 'text-black' },
    cocoa: { icon: faMugHot, color: 'text-yellow-900' },
    coffee: { icon: faMugHot, color: 'text-amber-800' },
    copper: { icon: faBox, color: 'text-orange-400' },
    corn: { icon: faLeaf, color: 'text-yellow-400' },
    cotton: { icon: faSeedling, color: 'text-gray-200' },
    gold: { icon: faSun, color: 'text-yellow-400' },
    iron_ore: { icon: faTractor, color: 'text-red-900' },
    natural_gas: { icon: faWind, color: 'text-blue-300' },
    nickel: { icon: faShieldHalved, color: 'text-gray-500' },
    silver: { icon: faGem, color: 'text-slate-400' },
    soybeans: { icon: faCarrot, color: 'text-green-300' },
    sugar: { icon: faSnowflake, color: 'text-gray-500' }, // Cor ajustada para ser visível em fundo branco
    wheat: { icon: faLeaf, color: 'text-amber-400' },
    zinc: { icon: faBox, color: 'text-slate-500' },
};

const fetchCotacoes = async () => {
    const res = await fetch('/api/cotacoes');
    if (!res.ok) {
        throw new Error('A resposta da rede não foi boa');
    }
    return res.json();
};

export default function CotacoesBar({ visibleCotacoes }) {
    const containerRef = useRef(null);
    const contentRef = useRef(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    if (!visibleCotacoes || visibleCotacoes.length === 0) {
        return null;
    }

    const { data: cotacoes, isLoading, isError } = useQuery({
        queryKey: ['cotacoesData'],
        queryFn: fetchCotacoes,
        refetchInterval: 1000 * 60 * 30,
    });

    useEffect(() => {
        const checkOverflow = () => {
            if (containerRef.current && contentRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                const contentWidth = contentRef.current.scrollWidth;
                setIsOverflowing(contentWidth > containerWidth);
            }
        };
        checkOverflow();
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [cotacoes, visibleCotacoes]);

    const filteredCotacoes = cotacoes?.filter(c => visibleCotacoes.includes(c.id));

    if (isLoading) {
        return <div className="bg-white text-gray-500 text-xs h-6 flex items-center px-4 border-b">Carregando cotações...</div>;
    }
    
    if (isError || !filteredCotacoes || filteredCotacoes.length === 0) {
        return null;
    }

    const Content = () => (
        <>
            {/* ##### 2. Cor do título "Cotações:" ajustada para azul escuro ##### */}
            <span className="flex items-center mx-4 text-sm font-semibold text-blue-700 flex-shrink-0">
                <FontAwesomeIcon icon={faChartLine} className="mr-2"/> Cotações:
            </span>
            {filteredCotacoes.map(c => {
                const iconInfo = iconMap[c.id] || { icon: faDollarSign, color: 'text-gray-400' };
                return (
                    // ##### 3. Cor do nome da cotação ajustada para um cinza escuro #####
                    <span key={c.id} className="flex items-center mx-4 text-xs text-gray-700 flex-shrink-0">
                        <FontAwesomeIcon icon={iconInfo.icon} className={`mr-2 ${iconInfo.color}`} />
                        {c.name}: 
                        {/* ##### 4. Cor do valor da cotação ajustada para um verde mais escuro e forte ##### */}
                        <strong className="ml-1.5 text-green-700 font-semibold">{c.type === 'currency' ? `R$ ${c.value}` : `$ ${c.value}`}</strong>
                    </span>
                );
            })}
        </>
    );

    return (
        // ##### 1. Fundo branco, texto principal preto e uma borda inferior para separar do header #####
        <div ref={containerRef} className="bg-white text-black border-b border-gray-200 overflow-hidden h-6 flex items-center">
            {isOverflowing ? (
                <div className="flex animate-marquee whitespace-nowrap">
                    <div ref={contentRef} className="flex"> <Content /> </div>
                    <div className="flex"> <Content /> </div>
                </div>
            ) : (
                <div ref={contentRef} className="flex whitespace-nowrap"> <Content /> </div>
            )}
        </div>
    );
}