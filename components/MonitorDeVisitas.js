// Caminho: components/MonitorDeVisitas.js
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { registrarVisita } from '@/app/_actions/monitorActions';

export default function MonitorDeVisitas() {
  const pathname = usePathname(); // Pega a página atual (ex: /residencialalfa)
  const searchParams = useSearchParams(); // Pega se veio de anúncio (ex: ?utm_source=instagram)

  useEffect(() => {
    // Detecta se é Celular ou PC de forma simples
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const tipoDispositivo = isMobile ? 'Celular' : 'Computador';

    // Pega a origem (Referrer) - De onde o cara veio antes de entrar aqui
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

    // Manda registrar (sem travar o site, roda em segundo plano)
    registrarVisita(dadosDaVisita);

  }, [pathname, searchParams]); // Roda sempre que a página ou parâmetros mudarem

  return null; // Esse componente não mostra nada na tela, é invisível
}