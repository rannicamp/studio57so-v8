"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faIdBadge, faPen } from '@fortawesome/free-solid-svg-icons';
import FichaCompletaFuncionario from './FichaCompletaFuncionario';
import FuncionarioModal from './FuncionarioModal';
import LancamentoFormModal from '../financeiro/LancamentoFormModal';
import { toast } from 'sonner';

export default function ColaboradorDetailPanel({ selectedId, isCandidateSelected, onEmployeeUpdate }) {
    const supabase = createClient();
    const [employee, setEmployee] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [pontos, setPontos] = useState([]);
    const [abonos, setAbonos] = useState([]);
    const [loading, setLoading] = useState(false);

    const [isFuncionarioModalOpen, setIsFuncionarioModalOpen] = useState(false);
    const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);

    const getEmployeeData = useCallback(async () => {
        if (!selectedId) {
            setEmployee(null);
            return;
        }

        setLoading(true);

        // Se for um candidato do Banco de Talentos
        if (isCandidateSelected) {
             const { data: candData, error } = await supabase
                .from('contatos')
                .select('*')
                .eq('id', selectedId)
                .single();
             if(candData){
                 let candFoto = candData.foto_url;
                 if (candFoto && !candFoto.startsWith('http')) {
                     const { data } = supabase.storage.from('avatars').getPublicUrl(candFoto);
                     if (data?.publicUrl) candFoto = data.publicUrl;
                 }

                 setEmployee({
                     ...candData,
                     foto_url: candFoto,
                     id: candData.id,
                     original_id: candData.id,
                     full_name: candData.nome || candData.razao_social,
                     contract_role: candData.cargo || 'Candidato',
                     status: 'Candidato',
                     cadastro_empresa: null,
                     empreendimentos: null,
                     jornada: null
                 });
                 setDocuments([]);
                 setPontos([]);
                 setAbonos([]);
             }
             setLoading(false);
             return;
        }

        // Fluxo normal para Funcionários
        const { data: employeeData, error } = await supabase
            .from('funcionarios')
            .select(`
                *, 
                cadastro_empresa(*), 
                empreendimentos(nome),
                jornada:jornadas(*, detalhes:jornada_detalhes(*))
            `)
            .eq('id', selectedId)
            .single();

        if (error || !employeeData) {
            toast.error("Erro ao carregar dados do funcionário.");
            setLoading(false);
            return;
        }

        if (employeeData.foto_url && !employeeData.foto_url.startsWith('http')) {
            const { data } = supabase.storage
                .from('funcionarios-documentos')
                .getPublicUrl(employeeData.foto_url);
            if (data?.publicUrl) {
                employeeData.foto_url = data.publicUrl;
            } else {
                employeeData.foto_url = null;
            }
        }

        setEmployee(employeeData);

        const [{ data: documentsData }, { data: pontosData }, { data: abonosData }] = await Promise.all([
            supabase.from('documentos_funcionarios').select('*, tipo:tipo_documento_id(*)').eq('funcionario_id', selectedId),
            supabase.from('pontos').select('*').eq('funcionario_id', selectedId),
            supabase.from('abonos').select('*').eq('funcionario_id', selectedId)
        ]);

        setDocuments(documentsData || []);
        setPontos(pontosData || []);
        setAbonos(abonosData || []);

        setLoading(false);
    }, [supabase, selectedId, isCandidateSelected]);

    useEffect(() => {
        getEmployeeData();
    }, [getEmployeeData]);

    const handleFuncionarioSaved = () => {
        setIsFuncionarioModalOpen(false);
        getEmployeeData();
        if (onEmployeeUpdate) onEmployeeUpdate();
    };

    const handleOpenEditModal = (lancamento) => {
        setEditingLancamento(lancamento);
        setIsLancamentoModalOpen(true);
    };

    const handleDemitir = async () => {
        if (!confirm(`Tem certeza que deseja inativar/demitir o colaborador ${employee?.full_name}?`)) return;
        try {
            const { error } = await supabase.from('funcionarios').update({
                status: 'Demitido',
                demission_date: new Date().toISOString().split('T')[0]
            }).eq('id', employee.id);
            if (error) throw error;
            toast.success('Funcionário inativado com sucesso!');
            getEmployeeData();
            if (onEmployeeUpdate) onEmployeeUpdate();
        } catch (error) {
            toast.error(`Erro ao inativar/demitir: ${error.message}`);
        }
    };

    if (!selectedId && !employee) {
        return (
            <div className="flex flex-col justify-center items-center h-full text-center p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 min-h-[500px]">
                <div className="w-24 h-24 mb-6 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-inner">
                    <FontAwesomeIcon icon={faIdBadge} className="w-12 h-12 opacity-80" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Painel Funcional Master</h3>
                <p className="text-gray-500 max-w-md">
                    Selecione um funcionário, terceirizado ou talento no menu em árvore lateral para acessar sua ficha completa.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-full text-center p-8 bg-white rounded-xl shadow-sm border border-gray-100 min-h-[500px]">
                <FontAwesomeIcon icon={faSpinner} spin size="3x" className="mb-4 text-blue-500" />
                <p className="text-lg font-medium animate-pulse text-gray-600">Extraindo Ficha do Servidor...</p>
            </div>
        );
    }

    if (!employee) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in flex flex-col h-full min-h-[600px] xl:min-h-[800px]">
            {/* Conteudo Interno da Ficha Escalonável */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                {/* Modais Retros */}
                {isFuncionarioModalOpen && !isCandidateSelected && (
                    <FuncionarioModal
                        isOpen={isFuncionarioModalOpen}
                        onClose={() => setIsFuncionarioModalOpen(false)}
                        employeeToEdit={employee}
                        onSaveSuccess={handleFuncionarioSaved}
                    />
                )}

                <LancamentoFormModal
                    isOpen={isLancamentoModalOpen}
                    onClose={() => setIsLancamentoModalOpen(false)}
                    onSave={() => true}
                    initialData={editingLancamento}
                />

                <div className="bg-white">
                    {isCandidateSelected ? (
                        <div className="text-center p-8 bg-purple-50 rounded-lg border border-purple-100">
                             <h2 className="text-xl font-bold text-purple-800 mb-2">Perfil de Candidato: {employee.full_name}</h2>
                             <p className="text-purple-600">Este perfil pertence ao <b>Banco de Talentos</b>. Transforme-o em funcionário oficial pela aba de Contatos para desbloquear Contracheques, Pontos e Contratos Departamentais.</p>
                        </div>
                    ) : (
                        <FichaCompletaFuncionario
                            employee={employee}
                            allDocuments={documents}
                            allPontos={pontos}
                            allAbonos={abonos}
                            onUpdate={getEmployeeData}
                            onEditLancamento={handleOpenEditModal}
                            onEditClick={() => setIsFuncionarioModalOpen(true)}
                            onDemitirClick={handleDemitir}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
