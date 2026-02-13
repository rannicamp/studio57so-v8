'use client';

import { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faCheck, faCheckDouble, faPlayCircle, faMicrophone, 
    faExclamationCircle, faFileAlt, faBan, faMapMarkerAlt, faExternalLinkAlt 
} from '@fortawesome/free-solid-svg-icons';
import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';

// Função para datas amigáveis (Hoje, Ontem...)
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

    // Rola para o final quando chega mensagem nova
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const hiddenTexts = ['Imagem', 'Áudio', 'Documento', 'Vídeo', 'Áudio enviado', 'Imagem enviada', 'Vídeo enviado', 'Localização Fixada'];

    return (
        <div className="flex-grow p-4 overflow-y-auto custom-scrollbar space-y-2" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}>
            {messages?.map((msg, index) => {
                const isMe = msg.direction === 'outbound';
                const isDeleted = msg.status === 'deleted';
                
                // --- 1. LÓGICA DE DATAS ---
                const messageDate = msg.sent_at || msg.created_at;
                const currentDateLabel = getDateLabel(messageDate);
                const prevMessage = messages[index - 1];
                const prevDateLabel = prevMessage ? getDateLabel(prevMessage.sent_at || prevMessage.created_at) : null;
                const showDateSeparator = currentDateLabel !== prevDateLabel;

                // --- 2. PARSE ROBUSTO DO PAYLOAD (Corrige o bug do "não aparece") ---
                let payload = {}; 
                try { 
                    if (typeof msg.raw_payload === 'string') {
                        payload = JSON.parse(msg.raw_payload);
                        // Se ainda for string (dupla codificação), parseia de novo
                        if (typeof payload === 'string') {
                            payload = JSON.parse(payload);
                        }
                    } else {
                        payload = msg.raw_payload || {};
                    }
                } catch (e) {
                    console.error("Erro ao ler mensagem:", e);
                }
                
                const mediaUrl = msg.media_url || payload?.image?.link || payload?.video?.link || payload?.audio?.link || payload?.document?.link;
                
                // --- 3. DETECÇÃO DE TIPOS ---
                const isImage = !isDeleted && (payload?.type === 'image' || payload?.image); 
                const isAudio = !isDeleted && (payload?.type === 'audio' || payload?.audio);
                const isVideo = !isDeleted && (payload?.type === 'video' || payload?.video); 
                const isDocument = !isDeleted && (payload?.type === 'document' || payload?.document);
                // Nova detecção de localização:
                const isLocation = !isDeleted && (payload?.type === 'location' || payload?.location);
                
                const reaction = msg.reaction_data;

                return (
                    <div key={msg.id} className="flex flex-col">
                        
                        {/* SEPARADOR DE DATA */}
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
                                            {/* IMAGEM */}
                                            {isImage && mediaUrl && <div className="rounded overflow-hidden mb-1 cursor-pointer bg-[#cfd4d2]" onClick={() => onMediaClick({ url: mediaUrl, type: 'image' })}><img src={mediaUrl} className="w-full h-auto max-h-80 object-cover" loading="lazy" alt="Imagem" /></div>}
                                            
                                            {/* VÍDEO */}
                                            {isVideo && mediaUrl && <div className="rounded overflow-hidden mb-1 bg-black relative flex items-center justify-center min-h-[150px]"><button className="absolute inset-0 z-20 w-full h-full cursor-pointer opacity-0" onClick={() => onMediaClick({ url: mediaUrl, type: 'video' })}></button><div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg"><FontAwesomeIcon icon={faPlayCircle} size="2x" /></div></div><video src={mediaUrl} className="w-full max-h-80 opacity-80 pointer-events-none object-cover" /></div>}
                                            
                                            {/* ÁUDIO */}
                                            {isAudio && (mediaUrl ? (<div className="flex items-center gap-2 p-2 min-w-[240px]"><div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"><FontAwesomeIcon icon={faMicrophone} /></div><audio controls src={mediaUrl} className="h-8 w-full max-w-[200px]" /></div>) : (<div className="flex items-center gap-2 p-2 text-red-500 bg-red-50 rounded"><FontAwesomeIcon icon={faExclamationCircle} /><span className="text-xs">Erro: Áudio sem link</span></div>))}
                                            
                                            {/* DOCUMENTO */}
                                            {isDocument && <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-black/5 rounded-lg hover:bg-black/10 transition-colors no-underline"><FontAwesomeIcon icon={faFileAlt} className="text-[#e55050] text-2xl" /><div className="overflow-hidden"><p className="font-medium text-gray-700 truncate">{payload?.document?.filename || "Documento"}</p></div></a>}
                                            
                                            {/* --- NOVO: CARD DE LOCALIZAÇÃO --- */}
                                            {isLocation && (
                                                <div className="rounded overflow-hidden mb-1 bg-white border border-gray-100 min-w-[240px]">
                                                    <a 
                                                        href={`https://www.google.com/maps/search/?api=1&query=${payload.location?.latitude},${payload.location?.longitude}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="block group"
                                                    >
                                                        {/* Mapa Fake Visual (Placeholder bonito) */}
                                                        <div className="bg-[#e9e9eb] h-32 flex flex-col items-center justify-center relative overflow-hidden">
                                                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-500 via-gray-300 to-gray-200"></div>
                                                            <div className="z-10 text-[#ea4335] transform group-hover:-translate-y-1 transition-transform duration-300 drop-shadow-md">
                                                                <FontAwesomeIcon icon={faMapMarkerAlt} size="3x" />
                                                            </div>
                                                            <div className="z-10 w-3 h-1 bg-black/20 rounded-full blur-[2px] mt-1 group-hover:scale-75 transition-all"></div>
                                                        </div>
                                                        <div className="p-3 bg-[#f0f2f5] border-t border-gray-200">
                                                            <h4 className="font-bold text-gray-800 text-sm mb-0.5">
                                                                {payload.location?.name || "Localização Fixada"}
                                                            </h4>
                                                            <p className="text-xs text-gray-500 truncate mb-2">
                                                                {payload.location?.address || `${payload.location?.latitude}, ${payload.location?.longitude}`}
                                                            </p>
                                                            <span className="text-[#00a884] text-xs font-medium flex items-center gap-1 hover:underline">
                                                                <FontAwesomeIcon icon={faExternalLinkAlt} /> Ver no Google Maps
                                                            </span>
                                                        </div>
                                                    </a>
                                                </div>
                                            )}

                                            {/* TEXTO (Se não for um dos tipos acima ou se tiver legenda) */}
                                            {msg.content && !hiddenTexts.includes(msg.content) && !isLocation && (
                                                <p className="px-2 pb-1 pt-1 text-gray-800 whitespace-pre-wrap leading-relaxed min-w-[50px]">
                                                    {msg.content}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="flex justify-end items-center gap-1 px-2 pb-1 mt-[-4px]">
                                    <span className="text-[10px] text-gray-500">{msg.sent_at ? format(new Date(msg.sent_at), 'HH:mm') : ''}</span>
                                    {isMe && !isDeleted && <FontAwesomeIcon icon={msg.status === 'read' ? faCheckDouble : msg.status === 'delivered' ? faCheckDouble : faCheck} className={msg.status === 'read' ? "text-[#53bdeb]" : "text-gray-500"} />}
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