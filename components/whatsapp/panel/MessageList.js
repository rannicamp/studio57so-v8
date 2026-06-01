'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCheckDouble, faPlayCircle, faMicrophone, faExclamationCircle, faFileAlt, faBan, faMapMarkerAlt, faExternalLinkAlt, faSpinner, faUserCircle, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

// --- IMPORTAÇÃO DINÂMICA DO SEU MAPA (LEAFLET) ---
const LocationMap = dynamic(() => import('../LocationMap'), { ssr: false,
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
  const supabase = createClient();
  const [loadingContactId, setLoadingContactId] = useState(null);

  const handleSaveAndChat = async (name, phoneClean, msgOrgId, messageId) => {
    if (!phoneClean) {
      toast.error("Telefone inválido.");
      return;
    }
    setLoadingContactId(messageId);
    try {
      // 1. Verificar se já existe o telefone no CRM
      const { data: telData } = await supabase
        .from('telefones')
        .select('contato_id')
        .eq('telefone', phoneClean)
        .eq('organizacao_id', msgOrgId)
        .limit(1)
        .maybeSingle();

      if (telData?.contato_id) {
        // Se já existe, apenas redireciona para a conversa dele
        toast.info("Contato já cadastrado! Redirecionando...");
        window.location.href = `/caixa-de-entrada?contato=${telData.contato_id}`;
        return;
      }

      // 2. Criar contato no CRM
      const { data: newContact, error: errC } = await supabase
        .from('contatos')
        .insert({
          nome: name,
          tipo_contato: 'Lead',
          organizacao_id: msgOrgId,
          origem: 'WhatsApp Compartilhado'
        })
        .select('id')
        .single();

      if (errC) throw errC;

      // 3. Criar telefone associado
      const countryCode = phoneClean.startsWith('55') ? '+55' : (phoneClean.startsWith('1') ? '+1' : '+55');
      const { error: errT } = await supabase.from('telefones').insert({
        contato_id: newContact.id,
        telefone: phoneClean,
        country_code: countryCode,
        tipo: 'Celular',
        organizacao_id: msgOrgId
      });
      if (errT) throw errT;

      // 4. Criar conversa de WhatsApp
      const { error: errConv } = await supabase.from('whatsapp_conversations').insert({
        contato_id: newContact.id,
        phone_number: phoneClean,
        meta_wa_id: phoneClean,
        organizacao_id: msgOrgId,
        updated_at: new Date().toISOString()
      });
      if (errConv) throw errConv;

      // 5. Vincular ao funil na coluna ENTRADA
      const { data: funil } = await supabase
        .from('funis')
        .select('id')
        .eq('organizacao_id', msgOrgId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (funil) {
        const { data: coluna } = await supabase
          .from('colunas_funil')
          .select('id')
          .eq('funil_id', funil.id)
          .eq('tipo_coluna', 'entrada')
          .limit(1)
          .maybeSingle();

        if (coluna) {
          await supabase.from('contatos_no_funil').insert({
            contato_id: newContact.id,
            coluna_id: coluna.id,
            organizacao_id: msgOrgId
          });
        }
      }

      toast.success("Contato tempo de resposta restabelecido! Abrindo chat...");
      window.location.href = `/caixa-de-entrada?contato=${newContact.id}`;

    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar contato: " + e.message);
    } finally {
      setLoadingContactId(null);
    }
  };

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
 const isFailed = msg.status === 'failed';
 const messageDate = msg.sent_at || msg.created_at;
 const currentDateLabel = getDateLabel(messageDate);
 const prevMessage = messages[index - 1];
 const prevDateLabel = prevMessage ? getDateLabel(prevMessage.sent_at || prevMessage.created_at) : null;
 const showDateSeparator = currentDateLabel !== prevDateLabel;

 // Estilização dinâmica da bolha da mensagem
 const bubbleClass = isDeleted 
   ? (isMe ? 'bg-gray-100 rounded-tr-none' : 'bg-gray-100 rounded-tl-none')
   : isFailed
     ? (isMe ? 'bg-red-50 border border-red-200 text-red-950 rounded-tr-none shadow-sm' : 'bg-red-50 border border-red-200 text-red-950 rounded-tl-none shadow-sm')
     : (isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none');

 // --- PARSE SEGURO ---
 let payload = {}; try {
 let raw = msg.raw_payload;
 if (typeof raw === 'string') {
 const parsed = JSON.parse(raw);
 payload = (typeof parsed === 'string') ? JSON.parse(parsed) : parsed;
 } else if (typeof raw === 'object') {
 payload = raw || {};
 }
 } catch (e) { }
 let mediaUrl = msg.media_url || payload?.image?.link || payload?.video?.link || payload?.audio?.link || payload?.document?.link;
 let isImage = !isDeleted && (payload?.type === 'image' || payload?.image);
 let isAudio = !isDeleted && (payload?.type === 'audio' || payload?.audio);
 let isVideo = !isDeleted && (payload?.type === 'video' || payload?.video);
 let isDocument = !isDeleted && (payload?.type === 'document' || payload?.document);

 // --- SUPORTE A MÍDIA DENTRO DE TEMPLATES ---
 if (payload?.type === 'template' && payload?.template?.components) {
  const headerComp = payload.template.components.find(c => c.type === 'header');
  if (headerComp?.parameters?.[0]) {
  const param = headerComp.parameters[0];
  if (param.type === 'image') { isImage = true; mediaUrl = param.image?.link; }
  if (param.type === 'video') { isVideo = true; mediaUrl = param.video?.link; }
  if (param.type === 'document') { isDocument = true; mediaUrl = param.document?.link; }
  }
 }
 // --- DETECÇÃO DE LOCALIZAÇÃO ---
 const isLocation = !isDeleted && (payload?.type === 'location' || payload?.location || msg.content?.includes('Localização:'));
 const locLat = payload?.location?.latitude || parseFloat(msg.content?.split(': ')[1]?.split(',')[0]);
 const locLng = payload?.location?.longitude || parseFloat(msg.content?.split(', ')[1]);
 const locName = payload?.location?.name || "Localização Fixada";

 // --- DETECÇÃO DE CARTÃO DE CONTATO ---
 const isContact = !isDeleted && (payload?.type === 'contacts' || payload?.contacts || msg.content?.startsWith('👤 Contato:'));
 const contactObj = payload?.contacts?.[0];
 const contactName = contactObj?.name?.formatted_name || msg.content?.replace('👤 Contato: ', '') || 'Contato';
 const contactPhone = contactObj?.phones?.[0]?.phone;
 const contactWaId = contactObj?.phones?.[0]?.wa_id;
 const contactPhoneClean = contactWaId || (contactPhone ? contactPhone.replace(/\D/g, '') : null);

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
 <div className={`relative max-w-[85%] sm:max-w-[65%] rounded-lg shadow-sm text-sm group ${bubbleClass}`}>
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
  
  {/* --- MAPA --- */}
  {isLocation && locLat && locLng && (
  <div className="rounded overflow-hidden mb-1 border border-gray-100 w-full min-w-[260px] shadow-sm bg-white">
  <div className="h-40 w-full relative z-0">
  <LocationMap position={[locLat, locLng]} />
  </div>
  <div className="p-2 border-t border-gray-100 flex justify-between items-center bg-gray-50">
  <span className="text-[11px] font-bold text-gray-700 truncate">{locName}</span>
  <a href={`https://www.google.com/maps?q=${locLat},${locLng}`} target="_blank" rel="noopener noreferrer"
  className="text-[#00a884] text-[10px] font-bold flex items-center gap-1 hover:underline"
  >
  <FontAwesomeIcon icon={faExternalLinkAlt} /> ABRIR MAPA
  </a>
  </div>
  </div>
  )}

  {/* --- CARTÃO DE CONTATO --- */}
  {isContact && (
  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col gap-3 min-w-[260px] shadow-xs my-1 select-none">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white text-lg shrink-0 shadow-inner">
        <FontAwesomeIcon icon={faUserCircle} />
      </div>
      <div className="flex-grow min-w-0">
        <p className="font-bold text-gray-800 text-sm truncate">{contactName}</p>
        <p className="text-xs text-gray-500 truncate">{contactPhone || (contactPhoneClean ? `+${contactPhoneClean}` : 'Sem telefone')}</p>
      </div>
    </div>
    
    {contactPhoneClean && (
      <>
        <div className="border-t border-gray-200" />
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => handleSaveAndChat(contactName, contactPhoneClean, msg.organizacao_id, msg.id)}
            disabled={loadingContactId !== null}
            className="flex-grow bg-[#00a884] hover:bg-[#008f72] text-white text-xs font-bold py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-xs cursor-pointer"
          >
            {loadingContactId === msg.id ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>Abrindo...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faUserPlus} />
                <span>Salvar e Conversar</span>
              </>
            )}
          </button>
          <a
            href={`https://wa.me/${contactPhoneClean}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold py-1.5 px-3 rounded flex items-center justify-center gap-1 transition-all no-underline shadow-xs"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            <span>WhatsApp</span>
          </a>
        </div>
      </>
    )}
  </div>
  )}

  {/* TEXTO DA MENSAGEM */}
  {msg.content && !hiddenTexts.includes(msg.content) && !msg.content.startsWith('📍 Localização:') && !msg.content.startsWith('👤 Contato:') && (
  <p className="px-2 pb-1 pt-1 text-gray-800 whitespace-pre-wrap leading-relaxed min-w-[50px]">
  {msg.content}
  </p>
  )}

  {/* EXIBIÇÃO DE ERRO DE ENVIO */}
  {isFailed && msg.error_message && (
    <div className="mx-2 my-1 p-2 bg-red-100/40 rounded border border-red-200 text-[10px] text-red-800 font-semibold select-text">
      <FontAwesomeIcon icon={faExclamationCircle} className="mr-1 text-red-600" />
      {msg.error_message}
    </div>
  )}
  </>
 )}
 </div>

 <div className="flex justify-end items-center gap-1 px-2 pb-1 mt-[-4px]">
 <span className="text-[10px] text-gray-500">{messageDate ? format(new Date(messageDate), 'HH:mm') : ''}</span>
 {isMe && !isDeleted && (
   isFailed ? (
     <span className="flex items-center gap-0.5 text-red-600 font-bold text-[9px] uppercase tracking-wide" title={msg.error_message || 'Falha no envio'}>
       <FontAwesomeIcon icon={faExclamationCircle} className="text-red-500 text-[10px]" /> Falhou
     </span>
   ) : (
     <FontAwesomeIcon icon={msg.status === 'read' ? faCheckDouble : (msg.status === 'delivered' ? faCheckDouble : faCheck)} className={msg.status === 'read' ? "text-[#53bdeb]" : "text-gray-400"} />
   )
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