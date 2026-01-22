// Caminho: components/MonitorDeVisitas.js
'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { registrarVisita } from '@/app/_actions/monitorActions';

// 1. Criamos um componente interno que faz o trabalho "perigoso" de ler a URL
function MonitorLogico() {
  const pathname = usePathname();
  const searchParams = useSearchParams(); 

  useEffect(() => {
    // Detecta se é Celular ou PC
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const tipoDispositivo = isMobile ? 'Celular' : 'Computador';

    // Pega a origem (Referrer)
    let origem = document.referrer;
    if (!origem) origem = 'Acesso Direto';
    if (origem.includes('google')) origem = 'Google';
    if (origem.includes('instagram')) origem = 'Instagram';
    if (origem.includes('facebook')) origem = 'Facebook';

    // Se tiver parâmetros na URL (tipo anúncios), eles têm prioridade
    const utmSource = searchParams.get('utm_source');
    if (utmSource) origem = `Anúncio (${utmSource})`;

    // Prepara o pacote
    const dadosDaVisita = {
      pagina: pathname,
      origem: origem,
      dispositivo: tipoDispositivo
    };

    // Manda registrar
    registrarVisita(dadosDaVisita);

  }, [pathname, searchParams]);

  return null;
}

// 2. O componente principal apenas "encapsula" a lógica no Suspense
// Isso acalma o Next.js 15 e evita o erro de build
export default function MonitorDeVisitas() {
  return (
    <Suspense fallback={null}>
      <MonitorLogico />
    </Suspense>
  );
}