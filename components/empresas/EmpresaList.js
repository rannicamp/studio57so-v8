// components/empresas/EmpresaList.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Importa o useRouter
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client'; // Caminho corrigido aqui
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faEdit } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';

export default function EmpresaList({ initialEmpresas, isAdmin }) {
    const [empresas, setEmpresas] = useState(initialEmpresas);
    const supabase = createClient();
    const queryClient = useQueryClient();
    const router = useRouter(); // Inicializa o router

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('cadastro_empresa').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: (_, id) => {
            toast.success('Empresa excluída com sucesso!');
            setEmpresas(prev => prev.filter(e => e.id !== id));
            queryClient.invalidateQueries(['empresas']);
        },
        onError: (error) => {
            toast.error(`Erro ao excluir: ${error.message}`);
        }
    });

    const handleDelete = (e, id, nome) => {
        e.stopPropagation(); // Impede que o clique no botão propague para a linha
        toast("Confirmar exclusão", {
            description: `Tem certeza que deseja excluir a empresa "${nome}"? Esta ação não pode ser desfeita.`,
            action: { label: "Excluir", onClick: () => deleteMutation.mutate(id) },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };
    
    // Função para navegar para a página de detalhes
    const handleRowClick = (id) => {
        router.push(`/empresas/${id}`);
    };
    
    // Função para o botão de editar, que também impede a propagação
    const handleEditClick = (e) => {
        e.stopPropagation(); 
    };

    if (empresas.length === 0) {
        return <p className="p-4 text-center text-gray-500">Nenhuma empresa cadastrada.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Razão Social</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome Fantasia</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CNPJ</th>
                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {empresas.map((empresa) => (
                        <tr 
                            key={empresa.id} 
                            onClick={() => handleRowClick(empresa.id)} 
                            className="hover:bg-gray-100 cursor-pointer"
                        >
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 text-blue-600">
                                {empresa.razao_social}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">{empresa.nome_fantasia}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{empresa.cnpj}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                <Link href={`/empresas/editar/${empresa.id}`} onClick={handleEditClick} className="text-indigo-600 hover:text-indigo-900">
                                    <FontAwesomeIcon icon={faEdit} />
                                </Link>
                                {isAdmin && (
                                    <button onClick={(e) => handleDelete(e, empresa.id, empresa.razao_social)} className="text-red-600 hover:text-red-900">
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}