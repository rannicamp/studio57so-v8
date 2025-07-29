// components/WhatsAppChatManager.js

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPaperPlane, faSpinner, faUserCircle, faSearch, faAddressBook,
    faPaperclip, faFileAlt, faMicrophone, faStopCircle, faPlayCircle, faTimes, faFileImage,
    faTrash, faCheck
} from '@fortawesome/free-solid-svg-icons';
import { sendWhatsAppMedia, sendWhatsAppText } from '../utils/whatsapp';

// Componente para exibir as bolhas de mensagem
const MessageBubble = ({ message }) => {
    const isSentByUser = message.direction === 'outbound';
    const bubbleClasses = isSentByUser ? 'bg-blue-500 text-white self-end rounded-l-lg rounded-tr-lg' : 'bg-gray-200 text-gray-800 self-start rounded-r-lg rounded-tl-lg';
    
    const renderContent = () => {
        // Assegura que raw_payload seja um objeto, caso venha como string JSON do banco de dados
        const payload = typeof message.raw_payload === 'string' ? JSON.parse(message.raw_payload) : message.raw_payload;
        const type = payload?.type;

        switch (type) {
            case 'document': 
                return (
                    <a href={payload.document?.link || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                        <FontAwesomeIcon icon={faFileAlt} className="text-xl" />
                        <span>{payload.document?.caption || payload.document?.filename || 'Documento'}</span>
                    </a>
                );
            case 'image': 
                return (
                    <a href={payload.image?.link || '#'} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-2">
                        <img src={payload.image?.link} alt={payload.image?.caption || 'Imagem'} className="max-w-xs rounded-md" />
                        {payload.image?.caption && <span className="text-sm">{payload.image.caption}</span>}
                    </a>
                );
            case 'audio': 
                return (
                    <audio controls src={payload.audio?.link} className="w-64">
                        Seu navegador não suporta o elemento de áudio.
                    </audio>
                );
            case 'text': 
            default: 
                return <p className="text-sm break-words">{message.content}</p>;
        }
    }

    return (
        <div className={`max-w-md w-fit p-3 ${bubbleClasses}`}>
            {renderContent()}
            <p className="text-xs mt-1 text-right opacity-70">
                {new Date(message.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
        </div>
    );
};

export default function WhatsAppChatManager({ contatos }) {
    const supabase = createClient();
    const [selectedContact, setSelectedContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [displayContacts, setDisplayContacts] = useState([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // Usado para forçar a atualização da lista de contatos
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const [attachment, setAttachment] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // Efeito para organizar e ordenar contatos com base na última mensagem
    useEffect(() => {
        const organizeAndSortContacts = async () => {
            if (!contatos || contatos.length === 0) { 
                setDisplayContacts([]); 
                setIsLoadingContacts(false); 
                return; 
            }
            setIsLoadingContacts(true);
            const { data: messagesData, error } = await supabase.from('whatsapp_messages')
                .select('contato_id, sent_at')
                .not('contato_id', 'is', null)
                .order('sent_at', { ascending: false });

            if (error) { 
                console.error("Erro ao buscar datas de últimas mensagens:", error);
                // Se houver erro, apenas ordena alfabeticamente
                const sortedAlphabetically = [...contatos].sort((a, b) => (a.nome || a.razao_social || '').localeCompare(b.nome || b.razao_social || '')); 
                setDisplayContacts(sortedAlphabetically.map(c => ({ ...c, lastMessageDate: null }))); 
                setIsLoadingContacts(false); 
                return; 
            }

            const datesMap = new Map();
            messagesData.forEach(msg => { 
                const contactIdStr = String(msg.contato_id); 
                if (!datesMap.has(contactIdStr)) { 
                    datesMap.set(contactIdStr, new Date(msg.sent_at)); 
                } 
            });

            const enrichedContacts = contatos.map(contact => ({ 
                ...contact, 
                lastMessageDate: datesMap.get(String(contact.id)) || null 
            }));

            // Ordena por data da última mensagem (mais recente primeiro), depois por nome
            const sorted = enrichedContacts.sort((a, b) => { 
                const dateA = a.lastMessageDate; 
                const dateB = b.lastMessageDate; 
                if (dateA && dateB) return dateB.getTime() - dateA.getTime(); 
                if (dateA) return -1; // Contatos com mensagens recentes vêm primeiro
                if (dateB) return 1;  // Contatos sem mensagens recentes vêm depois
                const nameA = a.nome || a.razao_social || ''; 
                const nameB = b.nome || b.razao_social || ''; 
                return nameA.localeCompare(nameB); 
            });
            
            setDisplayContacts(sorted); 
            setIsLoadingContacts(false);
        };
        organizeAndSortContacts();
    }, [contatos, supabase, refreshTrigger]); // refreshTrigger é uma dependência para reordenar os contatos quando uma nova mensagem chega

    // Filtra contatos com base no termo de busca
    const filteredContacts = useMemo(() => {
        if (!searchTerm) { return displayContacts; }
        return displayContacts.filter(contact => { 
            const name = (contact.nome || contact.razao_social || '').toLowerCase(); 
            const phone = (contact.telefones?.[0]?.telefone || '').toLowerCase(); 
            return name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm.toLowerCase()); 
        });
    }, [displayContacts, searchTerm]);

    // Efeito para rolar para a última mensagem
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    
    // Função para selecionar um contato e carregar suas mensagens
    const handleSelectContact = useCallback(async (contact) => {
        setSelectedContact(contact); 
        setLoadingMessages(true); 
        setMessages([]); // Limpa as mensagens ao selecionar um novo contato
        setNewMessage(''); 
        setAttachment(null); 
        setAudioBlob(null); 
        setAudioUrl(null);
        if (isRecording) { 
            mediaRecorderRef.current?.stop(); 
            setIsRecording(false); 
        }

        // Busca todas as mensagens para o contato selecionado
        const { data, error } = await supabase.from('whatsapp_messages')
            .select('*')
            .eq('contato_id', contact.id)
            .order('sent_at', { ascending: true });

        if (error) { 
            console.error("Erro ao buscar mensagens:", error); 
        } else { 
            setMessages(data || []); 
        }
        setLoadingMessages(false);
    }, [supabase, isRecording]); // isRecording é uma dependência do useCallback

    // Efeito para o listener de tempo real do Supabase
    useEffect(() => {
        if (!selectedContact) return;

        // Cria um nome único para o canal para o contato selecionado
        const channelName = `whatsapp_messages_for_${selectedContact.id}`;
        const channel = supabase.channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT', // Escuta apenas por novas inserções
                    schema: 'public',
                    table: 'whatsapp_messages',
                    filter: `contato_id=eq.${selectedContact.id}`
                },
                (payload) => {
                    console.log('Mudança em tempo real recebida!', payload);
                    // Adiciona a nova mensagem diretamente ao estado 'messages'
                    setMessages(prevMessages => {
                        // Evita duplicatas se a mensagem já estiver na lista
                        if (prevMessages.some(msg => msg.id === payload.new.id)) {
                            return prevMessages;
                        }
                        return [...prevMessages, payload.new];
                    });
                    // Dispara a atualização da lista de contatos para reordená-los
                    setRefreshTrigger(prev => prev + 1);
                }
            )
            .subscribe();

        console.log(`Inscrito no canal: ${channelName}`);

        // Função de limpeza: remove o canal quando o componente é desmontado ou o contato selecionado muda
        return () => {
            supabase.removeChannel(channel);
            console.log(`Desinscrito do canal: ${channelName}`);
        };
    }, [selectedContact, supabase, setMessages, setRefreshTrigger]); // Dependências do useEffect

    // Manipulador para seleção de arquivo
    const handleFileSelected = (event) => {
        const file = event.target.files[0];
        if (file) { setAttachment(file); }
        if (fileInputRef.current) { fileInputRef.current.value = ""; }
    };

    // Determina o tipo de mídia do arquivo
    const getMediaType = (file) => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        return 'document';
    };

    // Função para converter áudio gravado para MP3 (usando lamejs)
    const convertToMp3 = async (audioBlob) => {
        console.log(`[ÁUDIO LOG] Iniciando conversão. Tamanho do Blob de entrada: ${audioBlob.size} bytes. Tipo: ${audioBlob.type}`);
    
        if (!window.lamejs) {
            console.error("[ÁUDIO LOG] ERRO CRÍTICO: Biblioteca lamejs não foi carregada no objeto window.");
            throw new Error("Biblioteca de conversão de áudio não carregou.");
        }
    
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await audioBlob.arrayBuffer();
        console.log(`[ÁUDIO LOG] ArrayBuffer criado. Tamanho: ${arrayBuffer.byteLength} bytes.`);
        
        try {
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            console.log(`[ÁUDIO LOG] Áudio decodificado. Duração: ${audioBuffer.duration.toFixed(2)}s, Sample Rate: ${audioBuffer.sampleRate}, Canais: ${audioBuffer.numberOfChannels}`);
            
            let pcmData;
            // Mixa áudio estéreo para mono se necessário
            if (audioBuffer.numberOfChannels === 2) {
                console.log("[ÁUDIO LOG] Áudio estéreo detectado. Fazendo a mixagem para mono.");
                const left = audioBuffer.getChannelData(0);
                const right = audioBuffer.getChannelData(1);
                pcmData = new Float32Array(left.length);
                for (let i = 0; i < left.length; i++) {
                    pcmData[i] = (left[i] + right[i]) / 2;
                }
            } else {
                console.log("[ÁUDIO LOG] Áudio mono detectado.");
                pcmData = audioBuffer.getChannelData(0);
            }

            console.log(`[ÁUDIO LOG] Convertendo ${pcmData.length} amostras de Float32 para Int16.`);
            const samples = new Int16Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
                // A conversão garante que o valor fique entre -1 e 1
                const s = Math.max(-1, Math.min(1, pcmData[i]));
                samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            console.log(`[ÁUDIO LOG] Conversão para Int16 concluída. Primeira amostra: ${samples[0]}`);

            // Inicializa o encoder LAME MP3
            const mp3Encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128); // 1 canal, sampleRate, bitrate
            const mp3Data = [];
            const BATCH_SIZE = 1152; // Tamanho de lote recomendado pelo LAME
            
            console.log("[ÁUDIO LOG] Iniciando loop de codificação para MP3...");
            // Processa amostras em lotes
            for (let i = 0; i < samples.length; i += BATCH_SIZE) {
                const batch = samples.subarray(i, i + BATCH_SIZE);
                const mp3buf = mp3Encoder.encodeBuffer(batch);
                if (mp3buf.length > 0) {
                    mp3Data.push(new Uint8Array(mp3buf)); // Armazena como Uint8Array
                }
            }
            console.log("[ÁUDIO LOG] Loop de codificação finalizado.");
            
            const end = mp3Encoder.flush(); // Finaliza a codificação e obtém os dados restantes
            if (end.length > 0) {
                console.log(`[ÁUDIO LOG] Finalizando com flush(). Tamanho do buffer final: ${end.length}`);
                mp3Data.push(new Uint8Array(end));
            }
            
            const mp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' });
            console.log(`[ÁUDIO LOG] Conversão para MP3 finalizada. Tamanho final do Blob MP3: ${mp3Blob.size} bytes.`);
            
            if (mp3Blob.size === 0) {
                console.error("[ÁUDIO LOG] ERRO: O MP3 finalizado tem tamanho 0.");
                throw new Error("A conversão resultou em um arquivo de áudio vazio.");
            }
            return mp3Blob;

        } catch(decodeError) {
            console.error("[ÁUDIO LOG] ERRO CRÍTICO ao decodificar áudio. O formato gravado pode não ser suportado.", decodeError);
            throw new Error(`Falha ao ler o áudio gravado: ${decodeError.message}`);
        }
    };

    // Inicia a gravação de áudio
    const handleStartRecording = async () => {
        setAttachment(null); // Limpa anexos existentes
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.log("[ÁUDIO LOG] MimeType 'audio/webm;codecs=opus' não suportado. Usando o padrão do navegador.");
                delete options.mimeType; // Remove a opção se não for suportada
            }
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = []; // Zera os chunks de áudio
            mediaRecorderRef.current.ondataavailable = event => { audioChunksRef.current.push(event.data); }; // Adiciona chunks de dados
            mediaRecorderRef.current.onstop = async () => {
                stream.getTracks().forEach(track => track.stop()); // Para a trilha de mídia
                const recordedBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType });
                try {
                    const mp3Blob = await convertToMp3(recordedBlob); // Converte para MP3
                    const audioUrl = URL.createObjectURL(mp3Blob); // Cria URL para preview
                    setAudioBlob(mp3Blob);
                    setAudioUrl(audioUrl);
                } catch (error) {
                    console.error("[ÁUDIO LOG] Erro no processo de conversão de áudio:", error);
                    alert(`Erro ao processar o áudio: ${error.message}`);
                    handleCancelRecording(); // Cancela em caso de erro
                }
            };
            mediaRecorderRef.current.start(); // Inicia a gravação
            setIsRecording(true);
        } catch (err) {
            console.error("Erro ao acessar microfone:", err);
            alert(`Não foi possível acessar o microfone: ${err.message}`);
        }
    };
    
    // Para a gravação
    const handleStopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };
    
    // Cancela a gravação e limpa o estado
    const handleCancelRecording = () => { 
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) { 
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop()); 
        } 
        mediaRecorderRef.current?.stop(); 
        setIsRecording(false); 
        setAudioBlob(null); 
        setAudioUrl(null); 
    };

    // Lida com o envio de mensagens (texto, anexo ou áudio)
    const handleSendMessage = async () => {
        if (!selectedContact || (!newMessage.trim() && !attachment && !audioBlob)) return;
        setIsSending(true);
        const textToSend = newMessage; 
        const attachmentToSend = attachment; 
        const audioToSend = audioBlob;
        setNewMessage(''); 
        setAttachment(null); 
        setAudioBlob(null); 
        setAudioUrl(null);

        try {
            const phoneNumber = selectedContact.telefones?.[0]?.telefone;
            if (!phoneNumber) throw new Error("O contato não possui um número de telefone válido.");
            
            let fileToSend = attachmentToSend;
            // Se houver áudio gravado, cria um File object para upload
            if (audioToSend) {
                if (audioToSend.size === 0) throw new Error("O áudio gravado está vazio e não pode ser enviado.");
                fileToSend = new File([audioToSend], "audio_gravado.mp3", { type: 'audio/mpeg' }); 
            }
            
            // Se houver arquivo para enviar (anexo ou áudio)
            if (fileToSend) {
                const mediaType = getMediaType(fileToSend);
                // Sanitiza o nome do arquivo para URL/path
                const sanitizedFileName = fileToSend.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const filePath = `${selectedContact.id}/${Date.now()}_${sanitizedFileName}`;
                
                // Faz o upload do arquivo para o Supabase Storage
                const { error: uploadError } = await supabase.storage.from('whatsapp-media').upload(filePath, fileToSend);
                if (uploadError) throw uploadError;
                
                // Obtém a URL pública do arquivo
                const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
                if (!urlData?.publicUrl) throw new Error("Não foi possível obter a URL pública do arquivo.");
                
                // Envia a mídia via WhatsApp
                await sendWhatsAppMedia(phoneNumber, mediaType, urlData.publicUrl, textToSend, mediaType === 'document' ? fileToSend.name : undefined);
            } 
            // Se não houver arquivo, envia apenas texto
            else if (textToSend) { 
                await sendWhatsAppText(phoneNumber, textToSend); 
            }
        } catch (error) {
            console.error("Falha no processo de envio:", error); 
            alert(`Erro ao enviar: ${error.message}`);
            // Restaura os dados da mensagem não enviada para que o usuário possa tentar novamente
            setNewMessage(textToSend); 
            setAttachment(attachmentToSend); 
            setAudioBlob(audioToSend);
            if (audioToSend && audioUrl) setAudioUrl(URL.createObjectURL(audioToSend)); // Restaura a URL do áudio
        } finally { 
            setIsSending(false); // Finaliza o estado de envio
        }
    };

    return (
        <div className="grid grid-cols-[300px_1fr_250px] h-[calc(100vh-100px)] bg-white rounded-lg shadow-xl border">
            {/* Coluna da Lista de Contatos */}
            <div className="flex flex-col border-r overflow-hidden">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                        <FontAwesomeIcon icon={faAddressBook} /> Contatos ({filteredContacts.length})
                    </h2>
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar..."
                            className="w-full p-2 pl-9 border rounded-md text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <ul className="overflow-y-auto flex-1">
                    {isLoadingContacts ? (
                        <div className="text-center p-4 flex items-center justify-center gap-2 text-gray-500">
                            <FontAwesomeIcon icon={faSpinner} spin /> Carregando...
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <p className="text-center text-gray-500 p-4 text-sm">Nenhum contato.</p>
                    ) : (
                        filteredContacts.map(contact => (
                            <li
                                key={contact.id}
                                onClick={() => handleSelectContact(contact)}
                                className={`p-4 cursor-pointer hover:bg-gray-100 ${selectedContact?.id === contact.id ? 'bg-blue-100' : ''}`}
                            >
                                <p className="font-semibold truncate">{contact.nome || contact.razao_social}</p>
                                <p className="text-sm text-gray-500">{contact.telefones?.[0]?.telefone || 'Sem telefone'}</p>
                                {contact.lastMessageDate && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        Última: {new Date(contact.lastMessageDate).toLocaleTimeString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </li>
                        ))
                    )}
                </ul>
            </div>

            {/* Coluna do Chat (Mensagens) */}
            <div className="flex flex-col bg-gray-100 overflow-hidden">
                {selectedContact ? (
                    <>
                        <div className="p-4 border-b flex items-center gap-3 bg-white">
                            <FontAwesomeIcon icon={faUserCircle} className="text-3xl text-gray-400" />
                            <div>
                                <h3 className="font-bold">{selectedContact.nome || selectedContact.razao_social}</h3>
                                <p className="text-sm text-gray-500">{selectedContact.telefones?.[0]?.telefone || 'Sem telefone'}</p>
                            </div>
                        </div>
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50 flex flex-col">
                            {loadingMessages ? (
                                <div className="m-auto text-center">
                                    <FontAwesomeIcon icon={faSpinner} spin /> Carregando...
                                </div>
                            ) : (
                                messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-4 border-t bg-white space-y-2">
                            {/* Pré-visualização de anexo */}
                            {attachment && (
                                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in">
                                    <div className="flex items-center gap-2 text-sm text-blue-800">
                                        <FontAwesomeIcon icon={attachment.type.startsWith('image/') ? faFileImage : faFileAlt} />
                                        <span className="font-medium truncate">{attachment.name}</span>
                                    </div>
                                    <button onClick={() => setAttachment(null)} className="text-blue-600 hover:text-blue-800">
                                        <FontAwesomeIcon icon={faTimes} />
                                    </button>
                                </div>
                            )}
                            {/* Pré-visualização de áudio gravado */}
                            {audioUrl && (
                                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in">
                                    <audio src={audioUrl} controls className="w-full h-10"></audio>
                                    <button onClick={handleCancelRecording} className="text-red-500 hover:text-red-700 ml-2 p-1">
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            )}
                            {/* Área de Input de Mensagens */}
                            <div className="flex items-center gap-3">
                                {isRecording ? (
                                    <div className="flex-1 flex items-center gap-4 bg-red-100 p-2 rounded-full">
                                        <button onClick={handleStopRecording} className="text-red-600">
                                            <FontAwesomeIcon icon={faCheck} className="text-xl" />
                                        </button>
                                        <div className="w-full text-center text-red-600 font-semibold animate-pulse">
                                            Gravando...
                                        </div>
                                        <button onClick={handleCancelRecording} className="text-gray-600">
                                            <FontAwesomeIcon icon={faTrash} className="text-xl" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" />
                                        <button onClick={() => fileInputRef.current.click()} disabled={isSending || audioBlob} className="text-gray-500 hover:text-blue-500 p-2 rounded-full disabled:opacity-50">
                                            <FontAwesomeIcon icon={faPaperclip} className="text-xl"/>
                                        </button>
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSendMessage(); }}
                                            placeholder={audioBlob ? "Áudio pronto para envio" : "Digite uma mensagem..."}
                                            className="flex-1 p-2 border rounded-full"
                                            disabled={audioBlob}
                                        />
                                        {/* Botão de Enviar ou Microfone */}
                                        {newMessage.trim() || attachment || audioBlob ? (
                                            <button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !attachment && !audioBlob)} className="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:bg-gray-400">
                                                {isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                                            </button>
                                        ) : (
                                            <button onClick={handleStartRecording} disabled={isSending} className="text-gray-500 hover:text-blue-500 p-2 rounded-full disabled:opacity-50">
                                                <FontAwesomeIcon icon={faMicrophone} className="text-xl"/>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <p>Selecione um contato para ver as mensagens.</p>
                    </div>
                )}
            </div>

            {/* Coluna do Assistente de IA (Removida) */}
            {/* O componente AIChatAssistant e sua definição foram removidos */}
            <div className="p-4 space-y-4 bg-white border-l border-gray-200">
                <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faRobot} /> Assistente de IA (Desativado)
                </h3>
                <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700">
                    <p>O assistente de IA está temporariamente desativado para melhorias. Por favor, entre em contato com o suporte se precisar de ajuda adicional.</p>
                </div>
            </div>
        </div>
    );
}
