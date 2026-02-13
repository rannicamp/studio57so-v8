'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faPaperPlane, faTimes, faSpinner, faCrosshairs, faSearch, faLocationArrow } from '@fortawesome/free-solid-svg-icons';

// Mapa dinâmico
const LocationMap = dynamic(() => import('./LocationMap'), { 
    ssr: false,
    loading: () => (
        <div className="flex flex-col items-center justify-center h-full bg-gray-100 text-gray-400 gap-3 animate-pulse">
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            <p className="text-sm font-medium">Carregando mapa...</p>
        </div>
    )
});

export default function LocationPickerModal({ isOpen, onClose, onSend }) {
    const [position, setPosition] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [loadingGps, setLoadingGps] = useState(false);

    // Auto-busca (Debounce)
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.length > 3) {
                triggerSearch(searchQuery);
            } else if (searchQuery.length === 0) {
                setSearchResults([]);
            }
        }, 800); // Aumentei um pouquinho para dar tempo de digitar mais detalhes
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    // Pega GPS ao abrir
    useEffect(() => {
        if (isOpen && !position) {
            handleGps();
        }
    }, [isOpen]);

    const handleGps = () => {
        if (!navigator.geolocation) {
            alert("Geolocalização não suportada no seu navegador.");
            return;
        }
        setLoadingGps(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setPosition([pos.coords.latitude, pos.coords.longitude]);
                setLoadingGps(false);
            },
            (err) => {
                console.error("Erro GPS:", err);
                setLoadingGps(false);
                // Fallback para Governador Valadares se falhar o GPS (Contexto Studio 57)
                setPosition([-18.8511, -41.9418]);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const triggerSearch = async (query) => {
        setSearching(true);
        try {
            let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=br`;
            
            // --- O SEGREDO DO CONTEXTO LOCAL ---
            // Se já tivermos uma posição (do GPS ou manual), usamos ela para filtrar a busca!
            if (position) {
                // Criamos uma "caixa" (viewbox) de +/- 1 grau ao redor da posição atual
                // Isso prioriza resultados próximos (aprox. 100km ao redor)
                const lat = position[0];
                const lon = position[1];
                const viewbox = `${lon-1},${lat-1},${lon+1},${lat+1}`; // left,top,right,bottom
                
                // bounded=0: "Prefira aqui perto, mas se não achar, procure longe"
                url += `&viewbox=${viewbox}&bounded=0`; 
            }
            // ------------------------------------

            const response = await fetch(url);
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error("Erro na busca:", error);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectResult = (res) => {
        const newPos = [parseFloat(res.lat), parseFloat(res.lon)];
        setPosition(newPos);
        // Limpa visualmente para focar no mapa
        setSearchQuery(res.display_name.split(',')[0]); 
        setSearchResults([]); 
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full sm:max-w-5xl h-[95vh] sm:h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
                
                {/* Header Compacto */}
                <div className="px-4 py-3 border-b flex items-center justify-between bg-white z-30 shrink-0 shadow-sm">
                    <div className="flex items-center gap-2 text-[#008069]">
                        <FontAwesomeIcon icon={faMapMarkerAlt} />
                        <h3 className="font-bold text-gray-800 text-sm sm:text-base">Localização Studio 57</h3>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                {/* Corpo Principal */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
                    
                    {/* Área de Busca (Topo Mobile / Lateral Desktop) */}
                    <div className="w-full md:w-80 bg-white p-3 flex flex-col gap-2 shrink-0 z-20 md:border-r shadow-lg md:shadow-none">
                        
                        {/* Input de Busca */}
                        <div className="relative group">
                            <input 
                                type="text"
                                placeholder="🔍 Digite rua, bairro ou local..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-[#008069] focus:border-transparent outline-none text-sm transition-all"
                            />
                            <div className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-[#008069] transition-colors">
                                {searching ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSearch} />}
                            </div>
                        </div>

                        {/* Botão GPS Rápido */}
                        <button 
                            onClick={handleGps}
                            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#008069]/10 text-[#008069] text-xs font-bold hover:bg-[#008069]/20 transition-colors border border-[#008069]/10"
                        >
                            <FontAwesomeIcon icon={loadingGps ? faSpinner : faLocationArrow} spin={loadingGps} />
                            {loadingGps ? "Buscando satélites..." : "Usar minha localização atual"}
                        </button>

                        {/* Lista de Resultados */}
                        <div className={`flex flex-col gap-1 overflow-y-auto transition-all bg-white ${searchResults.length > 0 ? 'max-h-60 md:max-h-full border-t pt-2' : 'h-0 md:h-auto'}`}>
                            {searchResults.map((res) => (
                                <button
                                    key={res.place_id}
                                    onClick={() => handleSelectResult(res)}
                                    className="text-left p-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 border border-transparent hover:border-gray-200 transition-all flex gap-3 items-start group"
                                >
                                    <div className="mt-1 text-gray-400 group-hover:text-[#008069]"><FontAwesomeIcon icon={faMapMarkerAlt} size="xs" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-gray-700 line-clamp-2">{res.display_name.split(',')[0]}</p>
                                        <p className="text-[10px] text-gray-500 line-clamp-1 truncate">{res.display_name}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mapa */}
                    <div className="flex-1 relative bg-gray-200 w-full h-full">
                        <LocationMap position={position} onPositionChange={setPosition} />
                        
                        {/* Botão GPS Flutuante no Mapa */}
                        <button 
                            onClick={handleGps}
                            className="absolute bottom-20 right-4 md:bottom-6 md:right-6 z-[400] bg-white w-12 h-12 rounded-full shadow-xl text-gray-600 hover:text-[#008069] flex items-center justify-center active:scale-90 transition-transform"
                            title="Centralizar em mim"
                        >
                            <FontAwesomeIcon icon={faCrosshairs} size="lg" />
                        </button>

                        {/* Indicador de Coordenadas */}
                        {position && (
                             <div className="absolute top-4 left-4 right-16 md:left-auto md:right-auto md:bottom-4 md:left-4 z-[400] pointer-events-none">
                                <div className="bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm border border-gray-100 inline-block pointer-events-auto max-w-full">
                                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Local Selecionado</p>
                                   <p className="text-xs font-mono text-gray-800 truncate">
                                      {position[0].toFixed(5)}, {position[1].toFixed(5)}
                                   </p>
                                </div>
                             </div>
                        )}
                    </div>
                </div>

                {/* Footer Fixo */}
                <div className="p-4 bg-white border-t shrink-0 flex flex-col gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                    <button 
                        onClick={() => { onSend(position); onClose(); }}
                        disabled={!position}
                        className="w-full bg-[#008069] hover:bg-[#006d59] text-white py-3.5 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                    >
                        <FontAwesomeIcon icon={faPaperPlane} /> 
                        {position ? "Confirmar Localização" : "Selecione um local no mapa"}
                    </button>
                </div>
            </div>
        </div>
    );
}