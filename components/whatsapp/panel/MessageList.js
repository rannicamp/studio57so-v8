'use client';

import { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faCheck, faCheckDouble, faPlayCircle, faMicrophone, 
    faExclamationCircle, faFileAlt, faBan 
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';

export default function MessageList({ messages, onMediaClick }) {
    const messagesEndRef = useRef(null);

    // Rola para a última mensagem automaticamente
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const hiddenTexts = ['Imagem', 'Áudio', 'Documento', 'Vídeo', 'Áudio enviado', 'Imagem enviada', 'Vídeo enviado'];

    return (
        <div className="flex-grow p-4 overflow-y-auto space-y-2 custom-scrollbar" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}>
            {messages?.map(msg => {
                const isMe = msg.direction === 'outbound';
                // Mantivemos a checagem visual caso já tenha alguma mensagem deletada no banco
                const isDeleted = msg.status === 'deleted';
                
                let payload = {}; 
                try { payload = typeof msg.raw_payload === 'string' ? JSON.parse(msg.raw_payload) : msg.raw_payload; } catch (e) {}
                
                const mediaUrl = msg.media_url || payload?.image?.link || payload?.video?.link || payload?.audio?.link || payload?.document?.link;
                
                const isImage = !isDeleted && (payload?.type === 'image' || payload?.image); 
                const isAudio = !isDeleted && (payload?.type === 'audio' || payload?.audio);
                const isVideo = !isDeleted && (payload?.type === 'video' || payload?.video); 
                const isDocument = !isDeleted && (payload?.type === 'document' || payload?.document);
                
                const reaction = msg.reaction_data;

                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 group/message`}>
                        <div className={`relative max-w-[85%] sm:max-w-[65%] rounded-lg shadow-sm text-sm group ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                            
                            <div className="p-1">
                                {isDeleted ? (
                                    <div className="flex items-center gap-2 p-2 text-gray-500 italic text-xs select-none bg-opacity-50">
                                        <FontAwesomeIcon icon={faBan} className="text-sm opacity-50" />
                                        <span>🚫 Esta mensagem foi apagada</span>
                                    </div>
                                ) : (
                                    <>
                                        {isImage && mediaUrl && <div className="rounded overflow-hidden mb-1 cursor-pointer bg-[#cfd4d2]" onClick={() => onMediaClick({ url: mediaUrl, type: 'image' })}><img src={mediaUrl} className="w-full h-auto max-h-80 object-cover" loading="lazy" alt="Imagem" /></div>}
                                        
                                        {isVideo && mediaUrl && <div className="rounded overflow-hidden mb-1 bg-black relative flex items-center justify-center min-h-[150px]"><button className="absolute inset-0 z-20 w-full h-full cursor-pointer opacity-0" onClick={() => onMediaClick({ url: mediaUrl, type: 'video' })}></button><div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg"><FontAwesomeIcon icon={faPlayCircle} size="2x" /></div></div><video src={mediaUrl} className="w-full max-h-80 opacity-80 pointer-events-none object-cover" /></div>}
                                        
                                        {isAudio && (mediaUrl ? (<div className="flex items-center gap-2 p-2 min-w-[240px]"><div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"><FontAwesomeIcon icon={faMicrophone} /></div><audio controls src={mediaUrl} className="h-8 w-full max-w-[200px]" /></div>) : (<div className="flex items-center gap-2 p-2 text-red-500 bg-red-50 rounded"><FontAwesomeIcon icon={faExclamationCircle} /><span className="text-xs">Erro: Áudio sem link</span></div>))}
                                        
                                        {isDocument && <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-black/5 rounded-lg hover:bg-black/10 transition-colors no-underline"><FontAwesomeIcon icon={faFileAlt} className="text-[#e55050] text-2xl" /><div className="overflow-hidden"><p className="font-medium text-gray-700 truncate">{payload?.document?.filename || "Documento"}</p></div></a>}
                                        
                                        {msg.content && !hiddenTexts.includes(msg.content) && <p className="px-2 pb-1 pt-1 text-gray-800 whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
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
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
}