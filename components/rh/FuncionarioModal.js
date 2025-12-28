// components/rh/FuncionarioModal.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import FuncionarioForm from '../FuncionarioForm';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';

// Função para buscar dados auxiliares (Empresas, Empreendimentos, Jornadas)
const fetchAuxiliaryData = async (organizacao_id) => {
    if (!organizacao_id) return { companies: [], empreendimentos: [], jornadas: [] };
    const supabase = createClient();
    
    const [companiesRes, empreendimentosRes, jornadasRes] = await Promise.all([
        supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', organizacao_id).order('razao_social'),
        supabase.from('empreendimentos').select('id, nome').eq('organizacao_id', organizacao_id).order('nome'),
        supabase.from('jornadas').select('*').eq('organizacao_id', organizacao_id).order('nome_jornada')
    ]);

    return {
        companies: companiesRes.data || [],
        empreendimentos: empreendimentosRes.data || [],
        jornadas: jornadasRes.data || []
    };
};

export default function FuncionarioModal({ isOpen, onClose, employeeToEdit, onSaveSuccess }) {
    const { user } = useAuth();
    const organizacao_id = user?.organizacao_id;

    const { data: auxData, isLoading } = useQuery({
        queryKey: ['funcionarioAuxData', organizacao_id],
        queryFn: () => fetchAuxiliaryData(organizacao_id),
        enabled: isOpen && !!organizacao_id,
        staleTime: 1000 * 60 * 10 // Cache de 10 minutos
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100 overflow-hidden">
                {/* Cabeçalho do Modal */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-800">
                        {employeeToEdit ? 'Editar Funcionário' : 'Novo Funcionário'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-white">
                        <FontAwesomeIcon icon={faTimes} size="lg"/>
                    </button>
                </div>

                {/* Conteúdo com Scroll */}
                <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                        </div>
                    ) : (
                        <FuncionarioForm 
                            initialData={employeeToEdit}
                            companies={auxData?.companies || []}
                            empreendimentos={auxData?.empreendimentos || []}
                            jornadas={auxData?.jornadas || []}
                            onClose={onClose}
                            onSaveSuccess={onSaveSuccess}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}