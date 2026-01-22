// Caminho: components/radar/MonitorDeVisitas.js
'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { registrarVisita } from '@/app/_actions/monitorActions';

function MonitorLogico() {
  const pathname = usePathname();
  const searchParams = useSearchParams(); 

  useEffect(() => {
    // 1. Gerenciamento de Sessão (O "Crachá" do visitante)
    let sessionId = localStorage.getItem('studio57_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID(); // Gera um ID único
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