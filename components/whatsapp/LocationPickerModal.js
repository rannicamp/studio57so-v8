'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faPaperPlane, faTimes, faSpinner, faCrosshairs, faSearch } from '@fortawesome/free-solid-svg-icons';

const LocationMap = dynamic(() => import('./LocationMap'), { 
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full bg-gray-50 text-gray-400 gap-2">
            <FontAwesomeIcon icon={faSpinner} spin />
            <p>Iniciando Mapa...</p>
        </div>
    )
});

export default function LocationPickerModal({ isOpen, onClose, onSend }) {
    const [position, setPosition] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // MÁGICA DA BUSCA AUTOMÁTICA (Debounce)
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.length > 3) {
                triggerSearch(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 600); // Espera 600ms após o último caractere digitado

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const triggerSearch = async (query) => {
        setSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=br`
            );
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error("Erro na busca:", error);
        } finally {
            setSearching(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-none sm:rounded-2xl w-full max-w-5xl h-full sm:h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-white shrink-0">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-[#008069]" />
                        Localização Studio 57
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                    {/* Barra de Busca Lateral - Agora mais interativa */}
                    <div className="w-full sm:w-80 border-r bg-gray-50 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 z-20">
                        <div className="relative">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Pesquisar Endereço</label>
                            <div className="relative">
                                <input 
                                    type="text"
                                    placeholder="Comece a digitar..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full p-3 pr-10 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#008069] text-sm bg-white shadow-sm"
                                />
                                <div className="absolute right-3 top-3 text-gray-300">
                                    {searching ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSearch} />}
                                </div>
                            </div>
                        </div>

                        {/* Lista de Resultados que aparecem sozinhos */}
                        <div className="flex flex-col gap-2">
                            {searchResults.length > 0 ? (
                                searchResults.map((res) => (
                                    <button
                                        key={res.place_id}
                                        onClick={() => {
                                            setPosition([parseFloat(res.lat), parseFloat(res.lon)]);
                                            setSearchResults([]); // Limpa a lista após selecionar
                                        }}
                                        className="text-left p-3 bg-white hover:bg-[#008069]/5 rounded-xl border border-gray-100 hover:border-[#008069]/30 transition-all shadow-sm group"
                                    >
                                        <p className="text-xs font-bold text-gray-700 line-clamp-2 group-hover:text-[#008069]">{res.display_name}</p>
                                        <p className="text-[10px] text-gray-400 mt-1 capitalize">{res.type.replace('_', ' ')}</p>
                                    </button>
                                ))
                            ) : searchQuery.length > 3 && !searching ? (
                                <p className="text-[10px] text-center text-gray-400 py-4">Nenhum local encontrado...</p>
                            ) : null}
                        </div>
                    </div>

                    {/* Área do Mapa - Ocupando o resto da tela */}
                    <div className="flex-1 relative bg-gray-100 z-10">
                        <LocationMap position={position} onPositionChange={setPosition} />
                        
                        {/* Botão de GPS flutuante */}
                        <button 
                            type="button"
                            onClick={() => {
                                navigator.geolocation.getCurrentPosition((pos) => {
                                    setPosition([pos.coords.latitude, pos.coords.longitude]);
                                });
                            }}
                            className="absolute bottom-6 right-6 z-[1000] bg-white w-12 h-12 rounded-full shadow-2xl text-[#008069] border border-gray-100 flex items-center justify-center hover:bg-gray-50 active:scale-90 transition-all"
                        >
                            <FontAwesomeIcon icon={faCrosshairs} size="lg" />
                        </button>
                    </div>
                </div>

                {/* Footer Fixo */}
                <div className="p-4 border-t bg-white flex flex-col sm:flex-row items-center justify-between shrink-0 gap-3">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Status da Seleção</span>
                        <span className="text-xs font-medium text-gray-600">
                            {position ? "✅ Local marcado no mapa" : "📍 Clique no mapa ou pesquise"}
                        </span>
                    </div>
                    <button 
                        onClick={() => { onSend(position); onClose(); }}
                        disabled={!position}
                        className="w-full sm:w-auto bg-[#008069] hover:bg-[#006d59] text-white px-10 py-3.5 rounded-xl font-bold shadow-lg disabled:opacity-30 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <FontAwesomeIcon icon={faPaperPlane} /> Confirmar e Enviar
                    </button>
                </div>
            </div>
        </div>
    );
}