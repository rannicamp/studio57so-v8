// components/ui/UppyFileImporter.js
// Padrão nativo do sistema - sem Dashboard do Uppy
"use client";

import React, { useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCloudUploadAlt, faFileAlt } from '@fortawesome/free-solid-svg-icons';

export default function UppyFileImporter({
 isOpen,
 onClose,
 onFileSelected,
 title = "Importar Arquivo",
 allowedFileTypes = ['.csv'],
 note = "Selecione ou arraste o arquivo aqui",
 multiple = false,
 children
}) {
 const fileInputRef = useRef(null);

 if (!isOpen) return null;

 const handleFileChange = (e) => {
 const files = Array.from(e.target.files || []);
 if (files.length > 0 && onFileSelected) {
 onFileSelected(multiple ? files : files[0]);
 }
 // Limpa o input para permitir selecionar o mesmo arquivo novamente
 if (fileInputRef.current) fileInputRef.current.value = '';
 };

 const handleDrop = (e) => {
 e.preventDefault();
 const files = Array.from(e.dataTransfer.files || []);
 if (files.length > 0 && onFileSelected) {
 // Validar a extensão do arquivo
 const validFiles = files.filter(file => {
 const ext = '.' + file.name.split('.').pop().toLowerCase();
 return allowedFileTypes.length === 0 || allowedFileTypes.includes(ext);
 });
 if (validFiles.length > 0) {
 onFileSelected(multiple ? validFiles : validFiles[0]);
 }
 }
 };

 const handleDragOver = (e) => {
 e.preventDefault();
 };

 return (
 // Overlay
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col relative animate-fadeIn">

 {/* Header */}
 <div className="flex justify-between items-center px-6 py-4 border-b">
 <h2 className="text-lg font-bold text-gray-800">{title}</h2>
 <button
 onClick={onClose}
 className="text-gray-400 hover:text-red-500 hover:bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
 title="Fechar"
 >
 <FontAwesomeIcon icon={faXmark} size="lg" />
 </button>
 </div>

 {/* Área de Drop e Seleção */}
 <div className="p-6">
 <p className="text-sm text-gray-500 mb-3">{note}</p>

 {/* Zona de Drop */}
 <div
 onDrop={handleDrop}
 onDragOver={handleDragOver}
 onClick={() => fileInputRef.current?.click()}
 className="border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
 >
 <div className="bg-blue-100 w-14 h-14 rounded-full flex items-center justify-center">
 <FontAwesomeIcon icon={faCloudUploadAlt} className="text-blue-500 text-2xl" />
 </div>
 <div className="text-center">
 <p className="font-semibold text-gray-700">Clique para selecionar ou arraste aqui</p>
 <p className="text-xs text-gray-400 mt-1">
 Formatos aceitos: {allowedFileTypes.join(', ').toUpperCase()}
 </p>
 </div>
 <FontAwesomeIcon icon={faFileAlt} className="text-gray-200 text-5xl absolute opacity-10 pointer-events-none" />
 </div>

 {/* Input oculto */}
 <input
 ref={fileInputRef}
 type="file"
 multiple={multiple}
 accept={allowedFileTypes.join(',')}
 onChange={handleFileChange}
 className="hidden"
 />

 {/* Slot extra para conteúdo adicional (ex: mapeamento de colunas) */}
 {children}
 </div>

 {/* Footer */}
 <div className="px-6 pb-4 flex justify-end border-t pt-4">
 <button
 onClick={onClose}
 className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors"
 >
 Cancelar
 </button>
 </div>
 </div>
 </div>
 );
}
