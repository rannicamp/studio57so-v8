'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const getEmailFolders = async () => {
    const res = await fetch('/api/email/folders');
    if (!res.ok) throw new Error('Erro ao buscar pastas');
    return res.json();
};

export default function EmailCreateFolderModal({ isOpen, onClose }) {
    const queryClient = useQueryClient();
    const [newFolderName, setNewFolderName] = useState('');
    const [parentFolder, setParentFolder] = useState('');

    // Busca pastas para preencher o select de "Local (Pai)"
    const { data: emailData } = useQuery({
        queryKey: ['emailFolders'],
        queryFn: getEmailFolders,
        staleTime: 1000 * 60 * 5,
        enabled: isOpen // Só busca se estiver aberto
    });

    const createFolderMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/email/folders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    folderName: newFolderName, 
                    parentPath: parentFolder 
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Falha ao criar pasta');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Pasta criada com sucesso!');
            queryClient.invalidateQueries(['emailFolders']);
            handleClose();
        },
        onError: (err) => toast.error(err.message)
    });

    const handleClose = () => {
        setNewFolderName('');
        setParentFolder('');
        onClose();
    };

    const handleSubmit = () => {
        if (!newFolderName.trim()) return toast.warning('Digite um nome para a pasta');
        createFolderMutation.mutate();
    };

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-[99999] bg-black/10 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-full max-w-sm animate-slide-down" onClick={(e) => e.stopPropagation()}>
                <h4 className="text-sm font-bold text-gray-800 mb-3">Nova Pasta</h4>
                
                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Nome</label>
                        <input 
                            autoFocus
                            type="text" 
                            className="w-full text-sm border rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                            placeholder="Ex: Projetos"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />
                    </div>
                    
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Local (Pai)</label>
                        <select 
                            className="w-full text-xs border rounded p-2 bg-gray-50"
                            value={parentFolder}
                            onChange={(e) => setParentFolder(e.target.value)}
                        >
                            <option value="">Raiz (Pasta Principal)</option>
                            {emailData?.folders?.map(f => (
                                <option key={f.path} value={f.path}>
                                    {'-'.repeat(f.level)} {f.displayName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={handleClose} className="text-xs px-3 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
                        <button 
                            onClick={handleSubmit} 
                            disabled={createFolderMutation.isPending}
                            className="text-xs px-3 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 flex items-center gap-2"
                        >
                            {createFolderMutation.isPending && <FontAwesomeIcon icon={faSpinner} spin />}
                            Criar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}