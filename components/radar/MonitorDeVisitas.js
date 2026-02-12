// Caminho: components/radar/MonitorDeVisitas.js
'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { registrarVisita } from '@/app/_actions/monitorActions';

// Função auxiliar para gerar ID único (funciona em qualquer lugar)
const gerarIDUnico = () => {
  // 1. Tenta usar o método moderno e seguro do navegador
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // 2. Plano B: Método manual para quando acessa pelo IP da rede (http://192...)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

function MonitorLogico() {
  const pathname = usePathname();
  const searchParams = useSearchParams(); 

  useEffect(() => {
    // 1. Gerenciamento de Sessão (O "Crachá" do visitante)
    let sessionId = localStorage.getItem('studio57_session_id');
    
    if (!sessionId) {
      sessionId = gerarIDUnico(); // Usamos nossa função blindada aqui
      localStorage.setItem('studio57_session_id', sessionId);
    }

    // 2. Detecta Dispositivo
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const tipoDispositivo = isMobile ? 'Celular' : 'Computador';

    // 3. Captura Inteligente de Origem (UTMs e Referrer)
    let origem = document.referrer;
    if (!origem) origem = 'Acesso Direto';
    else if (origem.includes('google')) origem = 'Google Orgânico';
    else if (origem.includes('instagram')) origem = 'Instagram';
    else if (origem.includes('facebook')) origem = 'Facebook';

    // UTMs têm prioridade sobre o referrer padrão
    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');
    const utmContent = searchParams.get('utm_content');

    if (utmSource) origem = `Anúncio (${utmSource})`;

    // 4. Prepara o pacote completo de dados
    const dadosDaVisita = {
      pagina: pathname,
      origem: origem,
      dispositivo: tipoDispositivo,
      session_id: sessionId,
      url_completa: window.location.href,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent
    };

    // 5. Envia para o servidor
    // Usamos um pequeno timeout para não travar o carregamento inicial da página
    const timeoutId = setTimeout(() => {
      registrarVisita(dadosDaVisita);
    }, 1000);

    return () => clearTimeout(timeoutId);

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