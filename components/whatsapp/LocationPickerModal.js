'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faPaperPlane, faTimes, faSpinner, faCrosshairs } from '@fortawesome/free-solid-svg-icons';

// Importamos o mapa dinamicamente com SSR desligado
// Isso impede que o servidor tente renderizar o Leaflet (o que causaria erro)
const LocationMap = dynamic(() => import('./LocationMap'), { 
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full text-gray-400 gap-2">
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            <p>Carregando mapa...</p>
        </div>
    )
});

export default function LocationPickerModal({ isOpen, onClose, onSend }) {
    const [position, setPosition] = useState(null);
    const [loading, setLoading] = useState(true);

    // Tenta pegar o GPS assim que abre
    useEffect(() => {
        if (isOpen && navigator.geolocation) {
            setLoading(true);
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    setPosition([latitude, longitude]);
                    setLoading(false);
                },
                (err) => {
                    console.error("Erro ao obter GPS:", err);
                    // Não marcamos posição, deixamos o mapa abrir no padrão
                    setLoading(false);
                },
                { enableHighAccuracy: true }
            );
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (position) {
            onSend({ latitude: position[0], longitude: position[1] });
            onClose();
        }
    };

    const handleCenterOnMe = () => {
        setLoading(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            setPosition([pos.coords.latitude, pos.coords.longitude]);
            setLoading(false);
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col h-[80vh] md:h-[600px]">
                
                {/* Header */}
                <div className="bg-[#008069] p-4 text-white flex justify-between items-center shadow-md z-10">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <FontAwesomeIcon icon={faMapMarkerAlt} /> Enviar Localização
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                {/* Área do Mapa */}
                <div className="flex-grow relative bg-gray-100">
                    <LocationMap 
                        position={position} 
                        onPositionChange={setPosition} 
                    />

                    {/* Botão de Centralizar (Flutuante) */}
                    <button 
                        onClick={handleCenterOnMe}
                        className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg z-[400] text-gray-600 hover:text-[#008069] hover:scale-110 transition-all border border-gray-200"
                        title="Onde estou?"
                    >
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCrosshairs} size="lg" />}
                    </button>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row gap-3 items-center justify-between z-10">
                    <div className="text-sm text-gray-600">
                        {position ? (
                            <span className="flex flex-col">
                                <span className="font-semibold text-gray-800">Local selecionado:</span>
                                <span>{position[0].toFixed(5)}, {position[1].toFixed(5)}</span>
                            </span>
                        ) : (
                            <span className="italic text-gray-400">Toque no mapa para marcar um local</span>
                        )}
                    </div>
                    
                    <button 
                        onClick={handleConfirm}
                        disabled={!position || loading}
                        className="w-full sm:w-auto bg-[#008069] hover:bg-[#006d59] text-white px-6 py-3 rounded-lg font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <FontAwesomeIcon icon={faPaperPlane} /> 
                        Enviar Agora
                    </button>
                </div>
            </div>
        </div>
    );
}