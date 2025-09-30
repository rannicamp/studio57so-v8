// components/shared/ListaAnexos.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faEye, faTrash } from '@fortawesome/free-solid-svg-icons';

export default function ListaAnexos({ anexos, onDelete }) {
    if (!anexos || anexos.length === 0) return <p className="text-center text-gray-500 py-4 mt-4">Nenhum documento nesta categoria.</p>;

    return (
        <div className="space-y-3 mt-4">
            {anexos.map(anexo => (
                <div key={anexo.id} className="bg-white p-3 rounded-md border flex items-center justify-between gap-4 hover:bg-gray-50">
                    <div className="flex items-center gap-4 min-w-0">
                        <FontAwesomeIcon icon={faFileLines} className="text-xl text-gray-500 flex-shrink-0" />
                        <div className="flex-grow min-w-0">
                            <p className="font-medium text-gray-800 truncate" title={anexo.nome_arquivo}>{anexo.nome_arquivo}</p>
                            <p className="text-xs text-gray-500">{anexo.descricao || anexo.tipo?.descricao || 'Sem descrição'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="Visualizar"><FontAwesomeIcon icon={faEye} /></a>
                        <button onClick={() => onDelete(anexo)} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                    </div>
                </div>
            ))}
        </div>
    );
}