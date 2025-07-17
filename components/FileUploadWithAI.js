"use client";

import { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faSpinner, faCheckCircle, faTimesCircle, faRobot, faFileLines } from '@fortawesome/free-solid-svg-icons';

export default function FileUploadWithAI({ onAnalysisComplete, analysisEndpoint, prompt }) {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, analyzing, success, error
    const [message, setMessage] = useState('Selecione um documento para a IA analisar.');
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setStatus('idle'); // Reseta o status para permitir a análise
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
            onAnalysisComplete(result); // Envia os dados extraídos para o formulário pai

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
        <div className="p-4 border rounded-lg bg-gray-50">
             <h4 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                {getStatusIcon()}
                Assistente de IA para Documentos
            </h4>
            <p className="text-sm text-gray-600 mb-4">
                Faça o upload de um documento (como a Matrícula do Imóvel) e a IA tentará preencher os campos relevantes para você.
            </p>
            <div className="flex items-center gap-4">
                <div className="flex-grow">
                    <label htmlFor="ai-file-input" className="sr-only">Escolher arquivo</label>
                    <input
                        id="ai-file-input"
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        accept=".pdf, image/*"
                    />
                </div>
                <button
                    type="button"
                    onClick={handleAnalyzeClick}
                    disabled={!file || status === 'analyzing' || status === 'success'}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {status === 'analyzing' ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faRobot} />}
                    Analisar com IA
                </button>
            </div>
            {message && (
                <p className="text-center text-sm mt-3 font-medium">
                    {status === 'success' && <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mr-2" />}
                    {status === 'error' && <FontAwesomeIcon icon={faTimesCircle} className="text-red-500 mr-2" />}
                    {file && status !== 'analyzing' && <FontAwesomeIcon icon={faFileLines} className="text-gray-500 mr-2" />}
                    {message}
                </p>
            )}
        </div>
    );
}
