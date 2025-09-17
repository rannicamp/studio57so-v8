// components/EmpresaList.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';

// =================================================================================
// INÍCIO DA CORREÇÃO
// O PORQUÊ: O componente agora recebe a lista de empresas via 'props' ('initialEmpresas').
// Removemos a lógica de busca de dados interna (useQuery) para que ele apenas
// exiba a lista que a página principal, já segura e filtrada, lhe entrega.
// =================================================================================
export default function EmpresaList({ initialEmpresas, isAdmin }) {
    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');

    // A lista de empresas agora vem diretamente da propriedade 'initialEmpresas'.
    const empresas = initialEmpresas;

    const { mutate: deleteEmpresa } = useMutation({
        mutationFn: async (empresaId) => {
            const { error } = await supabase.from('cadastro_empresa').delete().eq('id', empresaId);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success('Empresa excluída com sucesso!');
            // O PORQUÊ: router.refresh() é a forma moderna no Next.js de pedir
            // para a página do servidor recarregar os dados e enviar a nova lista.
            router.refresh(); 
        },
        onError: (error) => {
            toast.error(`Erro ao excluir: ${error.message}`);
        },
    });

    const handleDelete = (empresaId) => {
        toast("Você tem certeza?", {
            description: "Esta ação não poderá ser desfeita.",
            action: { label: "Sim, excluir", onClick: () => deleteEmpresa(empresaId) },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    const filteredEmpresas = useMemo(() => {
        if (!searchTerm) return empresas;
        return empresas.filter(emp =>
            emp.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.nome_fantasia && emp.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (emp.cnpj && emp.cnpj.includes(searchTerm))
        );
    }, [empresas, searchTerm]);

    // O spinner de carregamento e a mensagem de erro foram removidos daqui,
    // pois a página principal agora gerencia isso antes de renderizar a lista.
    return (
        <div className="space-y-4 p-4">
            <input
                type="text"
                placeholder="Buscar por Razão Social, Nome Fantasia ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="p-2 border rounded-md w-full max-w-lg shadow-sm"
            />
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Razão Social</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Nome Fantasia</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">CNPJ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Telefone</th>
                            <th className="relative px-6 py-3 text-right text-xs font-medium uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredEmpresas.length > 0 ? (
                            filteredEmpresas.map((emp) => (
                                <tr key={emp.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium">{emp.razao_social}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{emp.nome_fantasia || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{emp.cnpj}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{emp.telefone || '-'}</td>
                                    <td className="px-6 py-4 text-right text-sm font-medium space-x-4">
                                        <button onClick={() => router.push(`/empresas/editar/${emp.id}`)} className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1">
                                            <FontAwesomeIcon icon={faPenToSquare} /> Editar
                                        </button>
                                        {isAdmin && (
                                            <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 font-semibold inline-flex items-center gap-1">
                                                <FontAwesomeIcon icon={faTrash} /> Excluir
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="text-center py-8 text-gray-500">
                                    Nenhuma empresa encontrada.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
// =================================================================================
// FIM DA CORREÇÃO
// =================================================================================