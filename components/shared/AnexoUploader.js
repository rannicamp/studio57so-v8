"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import UppyListUploader from '@/components/ui/UppyListUploader';

export default function AnexoUploader({ parentId, storageBucket, tableName, allowedTipos, onUploadSuccess, categoria, organizacaoId }) {
 const supabase = createClient();

 const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

 const handleUppySuccess = async (result) => {
 const tipoId = result.tipoDocumento;
 if (!tipoId && !categoria) return; // Se não tem tipo, pelo menos a categoria tem que ter sentido

 const tipoSelecionado = allowedTipos?.find(t => t.id == tipoId);
 const sigla = tipoSelecionado?.sigla || 'DOC';

 // O Uppy já fez o upload real para o Storage (result.path)
 // Agora fazemos a inserção na tabela final do banco
 const { data: dbData, error: dbError } = await supabase.from(tableName).insert({
 [tableName === 'empresa_anexos' ? 'empresa_id' : 'empreendimento_id']: parentId,
 caminho_arquivo: result.path,
 nome_arquivo: result.fileName,
 descricao: result.descricao || '',
 tipo_documento_id: tipoId || null,
 categoria_aba: categoria,
 organizacao_id: organizacaoId
 }).select().single();

 if (dbError) {
 toast.error(`Erro ao salvar no banco o arquivo ${result.fileName}: ${dbError.message}`);
 } else {
 toast.success(`Arquivo ${result.fileName} anexado e salvo com sucesso!`);
 if (onUploadSuccess) {
 onUploadSuccess(dbData);
 }
 }
 };

 const handleUploadComplete = () => {
 setIsUploadModalOpen(false); // Fecha o modal ao terminar todos
 };

 return (
 <div className="w-full pb-4">
 <div className="flex justify-between items-center mb-4">
 <div>
 <h4 className="font-semibold text-gray-700">Documentos</h4>
 <p className="text-gray-500 text-sm">Gerencie os arquivos desta sessão.</p>
 </div>
 <button
 onClick={() => setIsUploadModalOpen(true)}
 className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2"
 >
 <FontAwesomeIcon icon={faUpload} /> Novo Documento
 </button>
 </div>

 {/* MODAL DE UPLOAD */}
 {isUploadModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-in fade-in duration-200">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden relative">
 {/* Header do Modal */}
 <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
 <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
 <FontAwesomeIcon icon={faUpload} className="text-blue-600" />
 Lista Pessoal e Otimizada de Envios
 </h2>
 <button
 onClick={() => setIsUploadModalOpen(false)}
 className="text-white/70 hover:text-white transition-colors p-1 rounded-md bg-gray-400 hover:bg-red-500"
 title="Fechar"
 >
 <FontAwesomeIcon icon={faTimesCircle} className="w-6 h-6" />
 </button>
 </div>

 {/* Corpo do Modal em Lista - O Uploader List é Self Contained em height */}
 <div className="p-6 bg-gray-50 flex-1 overflow-hidden">
 <UppyListUploader
 bucketName={storageBucket}
 folderPath={`${parentId}/anexos`}
 tiposDocumento={allowedTipos}
 onUploadSuccess={handleUppySuccess}
 onUploadComplete={handleUploadComplete}
 hideClassificacao={!allowedTipos || allowedTipos.length === 0}
 />
 </div>
 </div>
 </div>
 )}
 </div>
 );
}