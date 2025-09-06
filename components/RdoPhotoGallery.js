"use client";

// O PORQUÊ: Adicionamos o 'useRef' do React. Ele nos permitirá
// criar uma referência direta ao elemento da imagem na tela para o "sensor" observar.
import { useState, useEffect, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faChevronLeft, faChevronRight, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// O PORQUÊ (ATUALIZADO): O componente da miniatura da imagem agora é "inteligente".
// Ele só vai buscar a imagem do servidor quando estiver visível na tela.
const ImageThumbnail = ({ photo, onClick }) => {
  const [signedUrl, setSignedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // O PORQUÊ: Estes são os novos estados para controlar o Lazy Loading.
  const [isVisible, setIsVisible] = useState(false); // Controla se a imagem está visível
  const placeholderRef = useRef(null); // A referência para o "sensor"

  // O PORQUÊ: Este useEffect configura o "sensor de presença" (Intersection Observer).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Quando o placeholder da imagem entra na tela...
        if (entries[0].isIntersecting) {
          setIsVisible(true); // ...avisamos que ela está visível...
          observer.disconnect(); // ...e desligamos o sensor para não trabalhar mais à toa.
        }
      },
      {
        // O sensor será acionado um pouco antes da imagem aparecer, para uma transição suave.
        rootMargin: '100px',
      }
    );

    if (placeholderRef.current) {
      observer.observe(placeholderRef.current);
    }

    // Limpa o observador quando o componente é desmontado
    return () => {
      if (placeholderRef.current) {
        observer.unobserve(placeholderRef.current);
      }
    };
  }, []);

  // O PORQUÊ: Este useEffect, que busca a URL da imagem, agora SÓ é acionado se 'isVisible' for verdadeiro.
  useEffect(() => {
    // Se não estiver visível, não faz nada.
    if (!isVisible) return;

    const getUrl = async () => {
      setLoading(true);
      const { data, error } = await supabase.storage.from('rdo-fotos').createSignedUrl(photo.caminho_arquivo, 3600);
      if (error) {
        console.error('Erro ao gerar URL assinada:', error);
      } else {
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    };
    getUrl();
  }, [isVisible, photo.caminho_arquivo, supabase]);

  // Se a imagem ainda não está visível, ou se está visível mas carregando, mostramos um placeholder.
  // A 'ref' é anexada aqui para que o sensor saiba qual div observar.
  if (!isVisible || (isVisible && loading && !signedUrl)) {
    return <div ref={placeholderRef} className="w-full h-full bg-gray-200 animate-pulse"></div>;
  }

  if (!signedUrl) {
    return <div ref={placeholderRef} className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-red-500">Erro</div>;
  }

  // Somente quando estiver visível E com a URL carregada, a imagem é renderizada.
  return (
    <img
      src={signedUrl}
      alt={photo.descricao || 'Foto do RDO'}
      className="object-cover w-full h-full cursor-pointer group-hover:opacity-75 transition-opacity"
      onClick={onClick}
    />
  );
};

// Componente principal da galeria
export default function RdoPhotoGallery({ photos }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);

  const openLightbox = (index) => {
    setSelectedImageIndex(index);
  };

  const closeLightbox = () => {
    setSelectedImageIndex(null);
  };

  const goToPrevious = () => {
    setSelectedImageIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : photos.length - 1));
  };

  const goToNext = () => {
    setSelectedImageIndex((prevIndex) => (prevIndex < photos.length - 1 ? prevIndex + 1 : 0));
  };

  const currentPhoto = selectedImageIndex !== null ? photos[selectedImageIndex] : null;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (selectedImageIndex === null) return;
      if (event.key === 'ArrowLeft') {
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        goToNext();
      } else if (event.key === 'Escape') {
        closeLightbox();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedImageIndex]);

  return (
    <div>
      {photos.length === 0 ? (
        <p className="text-center text-gray-500">Nenhuma foto encontrada nos Relatórios Diários de Obra.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative aspect-square group bg-gray-100 rounded-lg overflow-hidden shadow-sm">
              <ImageThumbnail photo={photo} onClick={() => openLightbox(index)} />
              
              {photo.tamanho_arquivo && (
                <span className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
                  {formatBytes(photo.tamanho_arquivo)}
                </span>
              )}

              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2 truncate">
                {photo.descricao || 'Sem descrição'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedImageIndex !== null && currentPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 animate-fade-in">
          <div className="relative w-full h-full max-w-4xl max-h-4/5 flex flex-col items-center justify-center">
            
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white text-2xl z-50 hover:text-gray-300"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            
            <div className="w-full text-center text-white p-4 bg-black bg-opacity-50 rounded-t-lg">
              <div className="flex items-center justify-center gap-4">
                <p className="font-bold">{currentPhoto.descricao || 'Sem descrição'}</p>
                {currentPhoto.tamanho_arquivo && (
                  <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full">
                    {formatBytes(currentPhoto.tamanho_arquivo)}
                  </span>
                )}
              </div>
              <Link href={`/rdo/${currentPhoto.diarios_obra.id}`} className="text-sm text-blue-300 hover:text-blue-200 hover:underline mt-1 inline-block">
                {currentPhoto.diarios_obra.rdo_numero} - {new Date(currentPhoto.diarios_obra.data_relatorio + 'T00:00:00').toLocaleDateString('pt-BR')}
                <FontAwesomeIcon icon={faExternalLinkAlt} className="ml-2 w-3 h-3"/>
              </Link>
            </div>
            
            <div className="relative w-full flex-grow flex items-center justify-between">
              <button
                onClick={goToPrevious}
                className="absolute left-4 text-white text-3xl z-50 p-2 bg-black bg-opacity-40 rounded-full hover:bg-opacity-70"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              
              {/* O Lightbox precisa da imagem completa imediatamente, então usamos o componente original aqui */}
              <div className="w-full h-full flex items-center justify-center">
                 <img
                    src={currentPhoto.signedUrl || ''} // Assumindo que a URL já foi buscada para a miniatura
                    alt={currentPhoto.descricao || 'Foto do RDO'}
                    className="object-contain w-full h-full"
                  />
              </div>
              
              <button
                onClick={goToNext}
                className="absolute right-4 text-white text-3xl z-50 p-2 bg-black bg-opacity-40 rounded-full hover:bg-opacity-70"
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}