"use client";

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

const ImageThumbnail = ({ photo, onClick, className }) => {
  const [signedUrl, setSignedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const [isVisible, setIsVisible] = useState(false);
  const placeholderRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px',
      }
    );

    const currentRef = placeholderRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  useEffect(() => {
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

  if (!isVisible || (isVisible && loading && !signedUrl)) {
    return <div ref={placeholderRef} className="w-full h-full bg-gray-200 animate-pulse"></div>;
  }

  if (!signedUrl) {
    return <div ref={placeholderRef} className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-red-500">Erro</div>;
  }

  return (
    <img
      src={signedUrl}
      alt={photo.descricao || 'Foto do RDO'}
      className={className || "object-cover w-full h-full cursor-pointer group-hover:opacity-75 transition-opacity"}
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
        <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 animate-fade-in"> {/* Alterado para flex-col para melhor controle do layout vertical */}
          <div className="relative w-full h-full max-w-4xl max-h-screen flex flex-col"> {/* Removido max-h-4/5 e adicionado flex-col */}
            
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white text-2xl z-50 hover:text-gray-300"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            
            {/* O PORQUÊ (ALTERAÇÃO): O cabeçalho agora está dentro de um div que tem uma altura mínima
                e garantimos que ele não vai encolher, permitindo que as informações fiquem visíveis. */}
            <div className="w-full text-center text-white p-4 bg-black bg-opacity-50 rounded-t-lg flex-shrink-0"> 
              <div className="flex flex-col items-center justify-center gap-2"> {/* Alterado para flex-col para alinhar itens */}
                <p className="font-bold text-lg">{currentPhoto.descricao || 'Sem descrição'}</p> {/* Aumentei o texto da descrição */}
                {currentPhoto.tamanho_arquivo && (
                  <span className="text-sm bg-gray-700 px-2 py-0.5 rounded-full"> {/* Aumentei o texto do tamanho */}
                    {formatBytes(currentPhoto.tamanho_arquivo)}
                  </span>
                )}
                <Link href={`/rdo/${currentPhoto.diarios_obra.id}`} className="text-base text-blue-300 hover:text-blue-200 hover:underline inline-flex items-center mt-1"> {/* Aumentei o texto do link e adicionei inline-flex */}
                  RDO {currentPhoto.diarios_obra.rdo_numero} - {new Date(currentPhoto.diarios_obra.data_relatorio + 'T00:00:00').toLocaleDateString('pt-BR')}
                  <FontAwesomeIcon icon={faExternalLinkAlt} className="ml-2 w-4 h-4"/>
                </Link>
              </div>
            </div>
            
            {/* O PORQUÊ (ALTERAÇÃO): A área da imagem agora é um flex-grow,
                o que significa que ela vai ocupar o espaço restante,
                respeitando o cabeçalho e os botões de navegação. */}
            <div className="relative w-full flex-grow flex items-center justify-between overflow-hidden"> {/* Adicionado overflow-hidden */}
              <button
                onClick={goToPrevious}
                className="absolute left-4 text-white text-3xl z-50 p-2 bg-black bg-opacity-40 rounded-full hover:bg-opacity-70"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              
              <div className="w-full h-full flex items-center justify-center p-4"> {/* Adicionado padding para a imagem */}
                 {/* O PORQUÊ (ALTERAÇÃO): Adicionado max-h-full e max-w-full ao className
                     para garantir que a imagem nunca ultrapasse o tamanho do seu container
                     e, assim, não "empurre" as informações para fora da tela. */}
                 <ImageThumbnail 
                    photo={currentPhoto} 
                    onClick={() => {}} 
                    className="object-contain max-h-full max-w-full"
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