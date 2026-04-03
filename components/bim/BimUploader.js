// Caminho: app/components/bim/BimUploader.js
'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faSpinner, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import UppyFileImporter from '@/components/ui/UppyFileImporter';

export default function BimUploader({ onUploadComplete }) {
 const supabase = createClientComponentClient();
 const [uploading, setUploading] = useState(false);
 const [status, setStatus] = useState('');
 const [isUppyOpen, setIsUppyOpen] = useState(false);

 const handleFileChange = async (file) => {
 setIsUppyOpen(false);
 if (!file) return;

 if (!file.name.endsWith('.rvt')) {
 alert('Por favor, envie apenas arquivos Revit (.rvt)');
 return;
 }

 setUploading(true);

 try {
 // --- ETAPA 1: Adicionar Registro Visual de Estado ---
 setStatus('1/4: Preparando Banco de Dados...');

 const { data: projetoRef, error: dbError } = await supabase
 .from('projetos_bim')
 .insert({
 nome_arquivo: file.name,
 tamanho_bytes: file.size,
 caminho_storage: null, // Sem Supabase Storage para arq grandes
 status: 'Processando'
 })
 .select()
 .single();

 if (dbError) throw new Error(`Erro Tabela BIM: ${dbError.message}`);

 // --- ETAPA 2: Obter Link Direto de Upload Autodesk ---
 setStatus('2/4: Conectando com Autodesk (Direct Upload)...');

 const startRes = await fetch('/api/aps/upload-direct-start', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ fileName: file.name })
 });

 const startData = await startRes.json();
 if (!startRes.ok) throw new Error(startData.error || 'Falha ao conectar com Autodesk.');
 const { uploadUrl, uploadKey, objectKey } = startData;

 // --- ETAPA 3: Upload GIGANTE direto Browser -> Autodesk S3 ---
 setStatus(`3/4: Enviando arquivo de ${(file.size / 1024 / 1024).toFixed(1)}MB para nuvem Autodesk...`);

 const s3UploadRes = await fetch(uploadUrl, {
 method: 'PUT',
 body: file
 });

 if (!s3UploadRes.ok) {
 // Remove registro do banco já que o upload falhou
 await supabase.from('projetos_bim').delete().eq('id', projetoRef.id);
 throw new Error(`O upload direto falhou: ${s3UploadRes.statusText}`);
 }

 // --- ETAPA 4: Finaliza Upload e Pede Tradução SVF ---
 setStatus('4/4: Iniciando Tradução 3D...');

 const finalizeRes = await fetch('/api/aps/upload-direct-finalize', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ uploadKey, objectKey })
 });

 const finalizeData = await finalizeRes.json();
 if (!finalizeRes.ok) throw new Error(finalizeData.error || 'Erro ao mandar traduzir o modelo.');
 if (!finalizeData.urn) throw new Error('Não recebi o código URN de visualização.');

 // --- ETAPA 5: Salvar URN Seguro no Banco ---
 setStatus('Atualizando URN do Banco...');

 const { error: updateError } = await supabase
 .from('projetos_bim')
 .update({
 urn_autodesk: finalizeData.urn,
 status: 'Processando'
 })
 .eq('id', projetoRef.id);

 if (updateError) throw new Error('Falha ao registrar URN final.');

 setStatus('Sucesso! Projeto processado.');
 if (onUploadComplete) onUploadComplete(finalizeData.urn);

 } catch (error) {
 console.error(error);
 // Mostra o erro na tela para o usuário (e para você debugar)
 setStatus(`Erro: ${error.message}`);
 } finally {
 setUploading(false);
 }
 };

 return (
 <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 text-center">

 <UppyFileImporter
 isOpen={isUppyOpen}
 onClose={() => setIsUppyOpen(false)}
 onFileSelected={handleFileChange}
 title="Importar Arquivo BIM"
 allowedFileTypes={['.rvt']}
 note="Selecione ou arraste o arquivo .rvt do Revit"
 maxFileSize={500 * 1024 * 1024} // Permitir até 500MB para arquivos BIM
 />

 {!uploading ? (
 <div onClick={() => setIsUppyOpen(true)} className="cursor-pointer flex flex-col items-center gap-2 group">
 <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
 <FontAwesomeIcon icon={faCloudUploadAlt} className="text-2xl text-blue-600" />
 </div>
 <div>
 <span className="font-bold text-gray-700 block">Novo Projeto BIM</span>
 <span className="text-xs text-gray-400">Upload para Supabase + Autodesk</span>
 </div>
 </div>
 ) : (
 <div className="flex flex-col items-center gap-3">
 <FontAwesomeIcon icon={faSpinner} className="text-3xl text-blue-600 animate-spin" />
 <p className="text-xs text-gray-600 font-medium animate-pulse">{status}</p>
 </div>
 )}

 {status.includes('Erro') && (
 <p className="mt-4 text-red-600 text-xs font-bold bg-red-50 p-2 rounded break-words">
 <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" /> {status}
 </p>
 )}

 {status.includes('Sucesso') && !uploading && (
 <p className="mt-4 text-green-600 text-sm font-bold">
 <FontAwesomeIcon icon={faCheckCircle} className="mr-1" /> Processamento Concluído!
 </p>
 )}
 </div>
 );
}