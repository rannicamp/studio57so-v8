'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- Correção dos Ícones do Leaflet ---
// Isso resolve o problema do pino sumir em produção
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- Sub-componente: Atualiza a visão quando a coordenada muda ---
function RecenterMap({ coords }) {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            // Aqui o map.getZoom() vai funcionar porque o useMap() é nativo agora
            map.setView(coords, map.getZoom() || 15);
        }
    }, [coords, map]);
    return null;
}

// --- Sub-componente: Permite clicar no mapa para mudar o pino ---
function ClickEvents({ onPositionChange }) {
    useMapEvents({
        click(e) {
            onPositionChange([e.latlng.lat, e.latlng.lng]);
        },
    });
    return null;
}

// --- Componente Principal do Mapa ---
export default function LocationMap({ position, onPositionChange }) {
    // Padrão: São Paulo se não tiver posição (fallback visual)
    const displayPosition = position || [-23.5505, -46.6333];

    return (
        <MapContainer 
            center={displayPosition} 
            zoom={15} 
            style={{ height: '100%', width: '100%' }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            
            {/* O Marcador só aparece se tivermos uma posição real */}
            {position && <Marker position={position} />}
            
            {/* Controladores Lógicos */}
            <RecenterMap coords={position} />
            <ClickEvents onPositionChange={onPositionChange} />
        </MapContainer>
    );
}