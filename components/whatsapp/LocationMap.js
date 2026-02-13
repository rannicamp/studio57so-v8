'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Ícone do Marcador
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Controlador de Zoom e Movimento
function MapController({ coords }) {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.setView(coords, 16, { animate: true }); // Animação suave
            // Ajuste crucial para mobile (evita mapa cinza)
            setTimeout(() => { map.invalidateSize(); }, 300);
        }
    }, [coords, map]);
    return null;
}

function ClickEvents({ onPositionChange }) {
    useMapEvents({
        click(e) { onPositionChange([e.latlng.lat, e.latlng.lng]); },
    });
    return null;
}

export default function LocationMap({ position, onPositionChange }) {
    // Padrão (SP) se não tiver GPS ainda
    const displayPosition = position || [-23.5505, -46.6333];

    return (
        <MapContainer 
            center={displayPosition} 
            zoom={15} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false} // Removemos o zoom padrão para ficar mais limpo no celular
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OSM'
            />
            {position && <Marker position={position} />}
            <MapController coords={position} />
            <ClickEvents onPositionChange={onPositionChange} />
        </MapContainer>
    );
}