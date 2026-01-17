// components/painel/widgets/VersiculoDoDiaWidget.js
"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuoteLeft, faBookBible, faShareNodes, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// --- LISTA DE OURO (Backup Offline) ---
const listaVersiculos = [
    { texto: "O Senhor é o meu pastor, nada me faltará.", referencia: "Salmos 23:1" },
    { texto: "Tudo posso naquele que me fortalece.", referencia: "Filipenses 4:13" },
    { texto: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.", referencia: "João 3:16" },
    { texto: "Entregue o seu caminho ao Senhor; confie nele, e ele o fará.", referencia: "Salmos 37:5" },
    { texto: "Mil cairão ao teu lado, e dez mil à tua direita, mas não chegará a ti.", referencia: "Salmos 91:7" },
    { texto: "Sejam fortes e corajosos.", referencia: "Deuteronômio 31:6" },
    { texto: "O Senhor lutará por vocês; apenas acalmem-se.", referencia: "Êxodo 14:14" }
];

export default function VersiculoDoDiaWidget() {
    const [versiculo, setVersiculo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Função que escolhe um versículo do backup (se a API falhar)
    const getVersiculoBackup = () => {
        const indice = Math.floor(Math.random() * listaVersiculos.length);
        return listaVersiculos[indice];
    };

    const buscarVersiculo = async (forceRefresh = false) => {
        setLoading(true);
        if (forceRefresh) setIsRefreshing(true);

        const hoje = new Date().toLocaleDateString('pt-BR');
        const cacheKey = 'STUDIO57_VERSICULO_DIA_V2'; // Mudei a chave para limpar cache antigo

        // 1. Tenta Cache (se não for refresh forçado)
        if (!forceRefresh) {
            try {
                const salvo = localStorage.getItem(cacheKey);
                if (salvo) {
                    const dados = JSON.parse(salvo);
                    if (dados.data === hoje) {
                        setVersiculo(dados.conteudo);
                        setLoading(false);
                        setIsRefreshing(false);
                        return;
                    }
                }
            } catch (e) { console.error(e); }
        }

        // 2. Tenta NOSSA API (que chama a api.bible segura)
        try {
            const response = await fetch('/api/versiculo');
            
            if (!response.ok) throw new Error('Falha na API');
            
            const data = await response.json();
            
            const novoVersiculo = {
                texto: data.texto,
                referencia: data.referencia,
                versao: 'API.Bible'
            };

            localStorage.setItem(cacheKey, JSON.stringify({ data: hoje, conteudo: novoVersiculo }));
            setVersiculo(novoVersiculo);

        } catch (error) {
            console.warn("Usando versículo offline:", error);
            // 3. Fallback: Usa o banco local
            const backup = getVersiculoBackup();
            setVersiculo(backup);
            // Salva o backup no cache para não ficar tentando falhar o tempo todo
            localStorage.setItem(cacheKey, JSON.stringify({ data: hoje, conteudo: backup }));
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        buscarVersiculo();
    }, []);

    const handleShare = () => {
        if (!versiculo) return;
        const text = `"${versiculo.texto}" - ${versiculo.referencia}`;
        navigator.clipboard.writeText(text);
        toast.success("Copiado!");
    };

    if (loading && !versiculo) {
        return (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-40 flex items-center justify-center animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-6 shadow-sm border border-blue-100 relative group overflow-hidden transition-all hover:shadow-md h-full">
            {/* Decoração */}
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <FontAwesomeIcon icon={faBookBible} size="4x" />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-center mb-3">
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                        Palavra do Dia
                    </span>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={() => buscarVersiculo(true)}
                            className={`text-gray-400 hover:text-blue-600 transition-colors p-1 ${isRefreshing ? 'animate-spin' : ''}`}
                            title="Nova Palavra"
                        >
                            <FontAwesomeIcon icon={faSyncAlt} />
                        </button>
                        <button 
                            onClick={handleShare}
                            className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                            title="Copiar"
                        >
                            <FontAwesomeIcon icon={faShareNodes} />
                        </button>
                    </div>
                </div>

                <div className="transition-opacity duration-300">
                    <FontAwesomeIcon icon={faQuoteLeft} className="text-blue-200 text-xl mb-2 block" />
                    <p className="text-gray-700 font-medium italic text-lg leading-relaxed font-serif">
                        &quot;{versiculo?.texto}&quot;
                    </p>
                </div>

                <div className="flex justify-end items-center border-t border-blue-100 pt-3 mt-4">
                    <p className="text-sm font-bold text-gray-800">
                        {versiculo?.referencia}
                    </p>
                </div>
            </div>
        </div>
    );
}