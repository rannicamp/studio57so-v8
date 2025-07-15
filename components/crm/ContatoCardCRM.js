// components/crm/ContatoCardCRM.js
"use client";

export default function ContatoCardCRM({ contato, onDragStart }) {
    // Se por algum motivo o contato não for carregado, retorna um card vazio para evitar erros.
    if (!contato) {
        return <div className="bg-red-100 p-3 rounded-md shadow">Erro ao carregar contato.</div>;
    }

    return (
        <div
            draggable
            onDragStart={onDragStart}
            className="bg-white p-3 rounded-md shadow border-l-4 border-blue-500 cursor-grab hover:shadow-lg transition-shadow duration-200"
        >
            <div className="font-bold text-sm text-gray-800 mb-2">{contato.nome}</div>
            {contato.empresa && <p className="text-xs text-gray-600 mb-2">{contato.empresa}</p>}
            
            <div className="flex justify-between items-center text-xs text-gray-500">
                {/* --- AQUI ESTÁ A CORREÇÃO --- */}
                {/* O ícone do responsável foi removido */}
                <span>{contato.telefone || contato.email}</span>
            </div>
        </div>
    );
}