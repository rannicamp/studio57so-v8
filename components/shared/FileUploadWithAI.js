"use client";

import { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCheckCircle, faTimesCircle, faRobot, faFileLines, faUpload } from '@fortawesome/free-solid-svg-icons';
import UppyFileImporter from '@/components/ui/UppyFileImporter';

export default function FileUploadWithAI({ onAnalysisComplete, analysisEndpoint, prompt }) {
 const [file, setFile] = useState(null);
 const [status, setStatus] = useState('idle'); // idle, analyzing, success, error
 const [message, setMessage] = useState('Selecione um documento para a IA analisar.');
 const [isUppyOpen, setIsUppyOpen] = useState(false);

 const handleFileChange = (selectedFile) => {
 setIsUppyOpen(false);
 if (selectedFile) {
 setFile(selectedFile);
 setStatus('idle');
 setMessage(`Arquivo selecionado: ${selectedFile.name}`);
 }
 };

 const handleAnalyzeClick = async () => {
 if (!file) {
 setMessage('Por favor, selecione um arquivo primeiro.');
 return;
 }

 setStatus('analyzing');
 setMessage(`Analisando ${file.name} com a IA...`);

 const formData = new FormData();
 formData.append('file', file);
 formData.append('prompt', prompt);

 try {
 const response = await fetch(analysisEndpoint, {
 method: 'POST',
 body: formData,
 });

 const result = await response.json();

 if (!response.ok) {
 throw new Error(result.error || 'Ocorreu um erro desconhecido na análise.');
 }

 setStatus('success');
 setMessage('Análise concluída com sucesso!');
 onAnalysisComplete(result);

 } catch (error) {
 setStatus('error');
 setMessage(`Erro na análise: ${error.message}`);
 console.error("Erro no upload ou análise:", error);
 }
 };

 const getStatusIcon = () => {
 switch (status) {
 case 'analyzing':
 return <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />;
 case 'success':
 return <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />;
 case 'error':
 return <FontAwesomeIcon icon={faTimesCircle} className="text-red-500" />;
 default:
 return <FontAwesomeIcon icon={faRobot} className="text-blue-600" />;
 }
 };

 return (
 <div className="p-4 border-2 border-dashed border-purple-300 bg-purple-50 rounded-lg">
 <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-2">
 {getStatusIcon()}
 Assistente de IA para Documentos
 </h4>
 <p className="text-xs text-purple-700 mb-3">
 Faça o upload de um documento (como a Matrícula do Imóvel) e a IA tentará preencher os campos relevantes para você.
 </p>

 <UppyFileImporter
 isOpen={isUppyOpen}
 onClose={() => setIsUppyOpen(false)}
 onFileSelected={handleFileChange}
 title="Documento para IA"
 allowedFileTypes={['.pdf', 'image/*']}
 note="Selecione o PDF ou Imagem para análise"
 />

 <div className="flex items-center gap-4">
 <button
 type="button"
 onClick={() => setIsUppyOpen(true)}
 className="flex-grow text-sm flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-purple-300 bg-white text-purple-700 hover:bg-purple-50 transition-colors"
 >
 <FontAwesomeIcon icon={faUpload} />
 {file ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
 </button>
 <button
 type="button"
 onClick={handleAnalyzeClick}
 disabled={!file || status === 'analyzing'}
 className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 min-w-[120px]"
 >
 {status === 'analyzing' ? <FontAwesomeIcon icon={faSpinner} spin /> : "Analisar"}
 </button>
 </div>
 {message && (
 <p className="text-center text-sm mt-3 font-medium">
 {file && status !== 'analyzing' && <FontAwesomeIcon icon={faFileLines} className="text-gray-500 mr-2" />}
 {message}
 </p>
 )}
 </div>
 );
}
