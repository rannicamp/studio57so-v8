'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapController({ coords }) {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.setView(coords, 16);
            // Isso conserta o bug visual do mapa cortado:
            setTimeout(() => { map.invalidateSize(); }, 200);
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
    return (
        <MapContainer center={position || [-23.5505, -46.6333]} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
            {position && <Marker position={position} />}
            <MapController coords={position} />
            <ClickEvents onPositionChange={onPositionChange} />
        </MapContainer>
    );
}