'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faMapMarkerAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function LocationSearch({ onSelectLocation }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setSearching(true);
        try {
            // Buscamos no OpenStreetMap (Gratuito e sem chave!)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
            );
            const data = await response.json();
            setResults(data);
        } catch (error) {
            console.error("Erro na busca:", error);
        } finally {
            setSearching(false);
        }
    };

    return (
        <div className="absolute top-4 left-4 z-[1000] w-72 sm:w-80">
            <form onSubmit={handleSearch} className="relative shadow-xl">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Pesquisar rua, cidade ou local..."
                    className="w-full p-3 pr-10 rounded-lg border-2 border-transparent focus:border-[#008069] outline-none text-sm text-gray-700 shadow-sm transition-all"
                />
                <button 
                    type="submit"
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-[#008069]"
                >
                    {searching ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSearch} />}
                </button>
            </form>

            {/* Lista de Resultados */}
            {results.length > 0 && (
                <div className="mt-2 bg-white rounded-lg shadow-2xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                    {results.map((res) => (
                        <button
                            key={res.place_id}
                            onClick={() => {
                                onSelectLocation([parseFloat(res.lat), parseFloat(res.lon)]);
                                setResults([]);
                                setQuery(res.display_name);
                            }}
                            className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-3 transition-colors"
                        >
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="mt-1 text-red-500 text-xs" />
                            <span className="text-xs text-gray-600 line-clamp-2">{res.display_name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}