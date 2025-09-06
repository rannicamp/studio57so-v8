"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faChevronLeft, faChevronRight, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

// Componente para exibir uma miniatura de imagem com tratamento de carregamento e erro
const ImageThumbnail = ({ photo, onClick }) => {
  const [signedUrl, setSignedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getUrl = async () => {
      setLoading(true);
      const { data, error } = await supabase.storage.from('rdo-fotos').createSignedUrl(photo.caminho_arquivo, 3600); // URL válida por 1 hora
      if (error) {
        console.error('Erro ao gerar URL assinada:', error);
      } else {
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    };
    getUrl();
  }, [photo.caminho_arquivo, supabase]);

  if (loading) {
    return <div className="w-full h-full bg-gray-200 animate-pulse"></div>;
  }

  if (!signedUrl) {
    return <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-red-500">Erro</div>;
  }

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

  // Adiciona um listener para as teclas de seta e Esc quando o lightbox estiver aberto
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
            
            {/* Botão de Fechar */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white text-2xl z-50 hover:text-gray-300"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            
            {/* Informações do RDO */}
            <div className="w-full text-center text-white p-4 bg-black bg-opacity-50 rounded-t-lg">
              <p className="font-bold">{currentPhoto.descricao || 'Sem descrição'}</p>
              <Link href={`/rdo/${currentPhoto.diarios_obra.id}`} className="text-sm text-blue-300 hover:text-blue-200 hover:underline">
                {currentPhoto.diarios_obra.rdo_numero} - {new Date(currentPhoto.diarios_obra.data_relatorio + 'T00:00:00').toLocaleDateString('pt-BR')}
                <FontAwesomeIcon icon={faExternalLinkAlt} className="ml-2 w-3 h-3"/>
              </Link>
            </div>
            
            {/* Imagem Principal e Navegação */}
            <div className="relative w-full flex-grow flex items-center justify-between">
              <button
                onClick={goToPrevious}
                className="absolute left-4 text-white text-3xl z-50 p-2 bg-black bg-opacity-40 rounded-full hover:bg-opacity-70"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              
              <div className="w-full h-full flex items-center justify-center">
                <ImageThumbnail photo={currentPhoto} onClick={() => {}} />
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