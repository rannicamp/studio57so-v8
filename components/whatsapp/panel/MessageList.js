'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faCheck, faCheckDouble, faPlayCircle, faMicrophone, 
    faExclamationCircle, faFileAlt, faBan, faMapMarkerAlt, faExternalLinkAlt, faSpinner 
} from '@fortawesome/free-solid-svg-icons';
import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';

// --- IMPORTAÇÃO DINÂMICA DO SEU MAPA (LEAFLET) ---
// Usamos o import relativo para subir uma pasta e achar o componente que você já tem
const LocationMap = dynamic(() => import('../LocationMap'), { 
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-32 bg-gray-100 rounded text-gray-400 gap-2">
            <FontAwesomeIcon icon={faSpinner} spin />
            <span className="text-xs">Carregando mapa...</span>
        </div>
    )
});

const getDateLabel = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    const diffDays = differenceInCalendarDays(today, date);
    if (diffDays === 2) return 'Anteontem';
    return format(date, 'dd/MM/yyyy');
};

export default function MessageList({ messages, onMediaClick }) {
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Legendas que o sistema gera e não precisam aparecer como texto repetido
    const hiddenTexts = ['Imagem', 'Áudio', 'Documento', 'Vídeo', 'Áudio enviado', 'Imagem enviada', 'Vídeo enviado'];

    return (
        <div className="flex-grow p-4 overflow-y-auto custom-scrollbar space-y-2" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}>
            {messages?.map((msg, index) => {
                const isMe = msg.direction === 'outbound';
                const isDeleted = msg.status === 'deleted';
                
                const messageDate = msg.sent_at || msg.created_at;
                const currentDateLabel = getDateLabel(messageDate);
                const prevMessage = messages[index - 1];
                const prevDateLabel = prevMessage ? getDateLabel(prevMessage.sent_at || prevMessage.created_at) : null;
                const showDateSeparator = currentDateLabel !== prevDateLabel;

                // --- PARSE SEGURO (O "DESCACO DA CEBOLA") ---
                let payload = {}; 
                try {
                    let raw = msg.raw_payload;
                    if (typeof raw === 'string') {
                        const parsed = JSON.parse(raw);
                        payload = (typeof parsed === 'string') ? JSON.parse(parsed) : parsed;
                    } else if (typeof raw === 'object') {
                        payload = raw || {};
                    }
                } catch (e) { }
                
                const mediaUrl = msg.media_url || payload?.image?.link || payload?.video?.link || payload?.audio?.link || payload?.document?.link;
                
                const isImage = !isDeleted && (payload?.type === 'image' || payload?.image); 
                const isAudio = !isDeleted && (payload?.type === 'audio' || payload?.audio);
                const isVideo = !isDeleted && (payload?.type === 'video' || payload?.video); 
                const isDocument = !isDeleted && (payload?.type === 'document' || payload?.document);
                
                // --- DETECÇÃO DE LOCALIZAÇÃO ---
                // Verifica se o tipo é location ou se o content contém as coordenadas coordenadas
                const isLocation = !isDeleted && (payload?.type === 'location' || payload?.location || msg.content?.includes('Localização:'));
                
                // Tenta pegar lat/lng do payload ou extrair do texto se necessário
                const locLat = payload?.location?.latitude || parseFloat(msg.content?.split(': ')[1]?.split(',')[0]);
                const locLng = payload?.location?.longitude || parseFloat(msg.content?.split(', ')[1]);
                const locName = payload?.location?.name || "Localização Fixada";

                const reaction = msg.reaction_data;

                return (
                    <div key={msg.id} className="flex flex-col">
                        {showDateSeparator && (
                            <div className="flex justify-center my-4 sticky top-2 z-10">
                                <span className="bg-[#e1f3fb] text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm border border-[#e1f3fb]/50 uppercase tracking-wide opacity-95">
                                    {currentDateLabel}
                                </span>
                            </div>
                        )}

                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 group/message`}>
                            <div className={`relative max-w-[85%] sm:max-w-[65%] rounded-lg shadow-sm text-sm group ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                
                                <div className="p-1">
                                    {isDeleted ? (
                                        <div className="flex items-center gap-2 p-2 text-gray-500 italic text-xs select-none bg-opacity-50">
                                            <FontAwesomeIcon icon={faBan} className="text-sm opacity-50" />
                                            <span>🚫 Esta mensagem foi apagada</span>
                                        </div>
                                    ) : (
                                        <>
                                            {/* RENDERIZAÇÃO DE MÍDIAS */}
                                            {isImage && mediaUrl && <div className="rounded overflow-hidden mb-1 cursor-pointer bg-[#cfd4d2]" onClick={() => onMediaClick({ url: mediaUrl, type: 'image' })}><img src={mediaUrl} className="w-full h-auto max-h-80 object-cover" loading="lazy" alt="Imagem" /></div>}
                                            {isVideo && mediaUrl && <div className="rounded overflow-hidden mb-1 bg-black relative flex items-center justify-center min-h-[150px]"><button className="absolute inset-0 z-20 w-full h-full cursor-pointer opacity-0" onClick={() => onMediaClick({ url: mediaUrl, type: 'video' })}></button><div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg"><FontAwesomeIcon icon={faPlayCircle} size="2x" /></div></div><video src={mediaUrl} className="w-full max-h-80 opacity-80 pointer-events-none object-cover" /></div>}
                                            {isAudio && (mediaUrl ? (<div className="flex items-center gap-2 p-2 min-w-[240px]"><div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"><FontAwesomeIcon icon={faMicrophone} /></div><audio controls src={mediaUrl} className="h-8 w-full max-w-[200px]" /></div>) : (<div className="flex items-center gap-2 p-2 text-red-500 bg-red-50 rounded"><FontAwesomeIcon icon={faExclamationCircle} /><span className="text-xs">Erro: Áudio sem link</span></div>))}
                                            {isDocument && <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-black/5 rounded-lg hover:bg-black/10 transition-colors no-underline"><FontAwesomeIcon icon={faFileAlt} className="text-[#e55050] text-2xl" /><div className="overflow-hidden"><p className="font-medium text-gray-700 truncate">{payload?.document?.filename || "Documento"}</p></div></a>}
                                            
                                            {/* --- VISUALIZAÇÃO DO MAPA (LEAFLET) --- */}
                                            {isLocation && locLat && locLng && (
                                                <div className="rounded overflow-hidden mb-1 border border-gray-100 w-full min-w-[260px] shadow-sm bg-white">
                                                    <div className="h-40 w-full relative z-0">
                                                        <LocationMap position={[locLat, locLng]} />
                                                    </div>
                                                    <div className="p-2 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                                                        <span className="text-[11px] font-bold text-gray-700 truncate">{locName}</span>
                                                        <a 
                                                            href={`https://www.google.com/maps?q=${locLat},${locLng}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-[#00a884] text-[10px] font-bold flex items-center gap-1 hover:underline"
                                                        >
                                                            <FontAwesomeIcon icon={faExternalLinkAlt} /> ABRIR MAPA
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {/* TEXTO DA MENSAGEM (SÓ APARECE SE NÃO FOR SÓ COORDENADA) */}
                                            {msg.content && !hiddenTexts.includes(msg.content) && !msg.content.startsWith('📍 Localização:') && (
                                                <p className="px-2 pb-1 pt-1 text-gray-800 whitespace-pre-wrap leading-relaxed min-w-[50px]">
                                                    {msg.content}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="flex justify-end items-center gap-1 px-2 pb-1 mt-[-4px]">
                                    <span className="text-[10px] text-gray-500">{messageDate ? format(new Date(messageDate), 'HH:mm') : ''}</span>
                                    {isMe && !isDeleted && (
                                        <FontAwesomeIcon 
                                            icon={msg.status === 'read' ? faCheckDouble : (msg.status === 'delivered' ? faCheckDouble : faCheck)} 
                                            className={msg.status === 'read' ? "text-[#53bdeb]" : "text-gray-400"} 
                                        />
                                    )}
                                </div>
                                
                                {reaction && reaction.emoji && !isDeleted && (
                                    <div className="absolute -bottom-2 -right-1 bg-white rounded-full p-1 shadow-md border border-gray-100 text-xs z-10 animate-in fade-in zoom-in duration-200">
                                        {reaction.emoji}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
}