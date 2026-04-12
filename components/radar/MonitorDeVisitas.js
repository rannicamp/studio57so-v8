// Caminho: components/radar/MonitorDeVisitas.js
'use client';

import { useEffect, Suspense, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { registrarVisita } from '@/app/_actions/monitorActions';

const gerarIDUnico = () => {
 if (typeof crypto !== 'undefined' && crypto.randomUUID) {
 return crypto.randomUUID();
 }
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
 var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
 return v.toString(16);
 });
};

function MonitorLogico() {
 const pathname = usePathname();
 const searchParams = useSearchParams();
 const tempoInicial = useRef(Date.now());
 const sessaoRef = useRef(null);

 useEffect(() => {
 // Ponto zero do cronômetro quando a URL muda
 tempoInicial.current = Date.now();

 let sessionId = localStorage.getItem('studio57_session_id');
 if (!sessionId) {
 sessionId = gerarIDUnico();
 localStorage.setItem('studio57_session_id', sessionId);
 }
 sessaoRef.current = sessionId;

 const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
 const tipoDispositivo = isMobile ? 'Celular' : 'Computador';

 let origem = document.referrer;
 if (!origem) origem = 'Acesso Direto';
 else if (origem.includes('google')) origem = 'Google Orgânico';
 else if (origem.includes('instagram')) origem = 'Instagram';
 else if (origem.includes('facebook')) origem = 'Facebook';

 const utmSource = searchParams.get('utm_source');
 const utmMedium = searchParams.get('utm_medium');
 const utmCampaign = searchParams.get('utm_campaign');
 const utmContent = searchParams.get('utm_content');

 if (utmSource) origem = `Anúncio (${utmSource})`;

 const urlAtual = window.location.href;

 const dadosDaVisita = {
 pagina: pathname,
 origem: origem,
 dispositivo: tipoDispositivo,
 session_id: sessionId,
 url_completa: urlAtual,
 utm_medium: utmMedium,
 utm_campaign: utmCampaign,
 utm_content: utmContent
 };

 // Registra "Entrada" (PageView)
 const timeoutId = setTimeout(() => {
 registrarVisita(dadosDaVisita);
 }, 1000);

 // -------------------------------------------------------------
 // MOTOR DE RETENÇÃO (Dwell Time)
 // -------------------------------------------------------------
 
 const dispararSaltoTemporal = () => {
    if (!sessaoRef.current) return;
    const duracaoSegundos = Math.floor((Date.now() - tempoInicial.current) / 1000);
    if (duracaoSegundos < 2) return; // Ignora se ficou menos de 2s

    const payload = JSON.stringify({
       session_id: sessaoRef.current,
       url_completa: urlAtual,
       tempo_permanencia_segundos: duracaoSegundos
    });

    // Usa sendBeacon (funciona mesmo se a página estiver morrendo)
    if (navigator.sendBeacon) {
       navigator.sendBeacon('/api/tracker', payload);
    } else {
       // Fallback simples
       fetch('/api/tracker', { method: 'POST', body: payload, keepalive: true }).catch(() => {});
    }
 };

 // Evento 1: Antes de Descarregar (Sair do Site/Aba)
 window.addEventListener('beforeunload', dispararSaltoTemporal);
 
 // Evento 2: Visibilidade Mobile (minimizar app do safari/chrome)
 const tratarVisibilidade = () => {
    if (document.visibilityState === 'hidden') {
       dispararSaltoTemporal();
    }
 };
 document.addEventListener('visibilitychange', tratarVisibilidade);

 // Evento 3: Heartbeat. Para usuários que ficam com aba aberta mas letárgicos
 // Pings de segurança a cada 30 segundos
 const heartbeat = setInterval(dispararSaltoTemporal, 30000);

 return () => {
   clearTimeout(timeoutId);
   clearInterval(heartbeat);
   window.removeEventListener('beforeunload', dispararSaltoTemporal);
   document.removeEventListener('visibilitychange', tratarVisibilidade);
   // Quando esse componente desmontar (mudar de rota dentro do site/SPA), enviamos os segundos retidos
   dispararSaltoTemporal();
 };

 }, [pathname, searchParams]);

 return null;
}

export default function MonitorDeVisitas() {
 return (
 <Suspense fallback={null}>
 <MonitorLogico />
 </Suspense>
 );
}