'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faClock, faSyncAlt, faExclamationTriangle, faFilePdf, faFileWord, faFileImage, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const statusMap = {
  Estudado: { icon: faCheckCircle, color: 'text-green-500', label: 'Estudado' },
  Pendente: { icon: faClock, color: 'text-yellow-500', label: 'Pendente' },
  Erro: { icon: faExclamationTriangle, color: 'text-red-500', label: 'Erro' },
};

const fileIconMap = {
    pdf: faFilePdf,
    doc: faFileWord,
    docx: faFileWord,
    jpg: faFileImage,
    jpeg: faFileImage,
    png: faFileImage,
    txt: faFileAlt,
};

const getFileIcon = (fileName) => {
    const extension = fileName?.split('.').pop().toLowerCase() || '';
    return fileIconMap[extension] || faFileAlt;
};

export default function TreinamentoIA({ initialDocumentos }) {
    const [documentos, setDocumentos] = useState(initialDocumentos);
    const [loadingAnexoId, setLoadingAnexoId] = useState(null);

    const handleReestudar = (anexoId) => {
        setLoadingAnexoId(anexoId);

        const promise = new Promise(async (resolve, reject) => {
            const response = await fetch('/api/empreendimentos/process-anexo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ anexoId: anexoId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                return reject(new Error(errorData.error || 'Falha ao reprocessar.'));
            }

            setDocumentos(docs => docs.map(doc => 
                doc.anexo_id === anexoId ? { ...doc, status: 'Estudado' } : doc
            ));

            return resolve("O documento foi enviado para a fila de estudo da IA.");
        });

        toast.promise(promise, {
            loading: 'Enviando para a fila de estudo...',
            success: (msg) => msg,
            error: (err) => err.message,
            finally: () => setLoadingAnexoId(null),
        });
    };

    return (
        <div className="mt-8 flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead>
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Arquivo</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Empreendimento</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Data de Envio</th>
                                <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Status</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0 text-center text-sm font-semibold text-gray-900">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {documentos.map((doc) => {
                                const statusInfo = statusMap[doc.status] || statusMap['Pendente'];
                                return (
                                    <tr key={doc.anexo_id}>
                                        <td className="whitespace-nowrap py-5 pl-4 pr-3 text-sm sm:pl-0">
                                            <div className="flex items-center">
                                                <div className="h-11 w-11 flex-shrink-0">
                                                    <FontAwesomeIcon icon={getFileIcon(doc.nome_arquivo)} className="text-2xl text-gray-400" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="font-medium text-gray-900 truncate" style={{maxWidth: '250px'}} title={doc.nome_arquivo}>
                                                        {doc.nome_arquivo}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-5 text-sm text-gray-500">{doc.nome_empreendimento}</td>
                                        <td className="whitespace-nowrap px-3 py-5 text-sm text-gray-500">
                                            {new Date(doc.data_envio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-5 text-sm text-center">
                                            <span className={`inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium ${statusInfo.color.replace('text-', 'bg-').replace('-500', '-100')} ${statusInfo.color}`}>
                                                <FontAwesomeIcon icon={statusInfo.icon} className="h-3 w-3" />
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td className="relative whitespace-nowrap py-5 pl-3 pr-4 text-center text-sm font-medium sm:pr-0">
                                            <button
                                                onClick={() => handleReestudar(doc.anexo_id)}
                                                disabled={loadingAnexoId === doc.anexo_id}
                                                className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400 disabled:cursor-wait"
                                            >
                                                {loadingAnexoId === doc.anexo_id ? (
                                                    <FontAwesomeIcon icon={faSyncAlt} spin />
                                                ) : (
                                                    'Re-estudar'
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}