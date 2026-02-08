// app/(main)/funcionarios/visualizar/[id]/page.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../../../utils/supabase/client';
import { useParams, notFound, useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPen } from '@fortawesome/free-solid-svg-icons';
import FichaCompletaFuncionario from '../../../../../components/rh/FichaCompletaFuncionario';
import LancamentoFormModal from '../../../../../components/financeiro/LancamentoFormModal';
// 1. IMPORTAÇÃO DO MODAL DE FUNCIONÁRIOS (O mesmo do RH)
import FuncionarioModal from '../../../../../components/rh/FuncionarioModal';

export default function VisualizarFuncionarioPage() {
    const supabase = createClient();
    const params = useParams();
    const router = useRouter();
    const employeeId = params.id;

    const [employee, setEmployee] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [pontos, setPontos] = useState([]);
    const [abonos, setAbonos] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estados para o Modal de Lançamento (Financeiro)
    const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);
    
    // 2. NOVO ESTADO PARA O MODAL DE EDIÇÃO DE FUNCIONÁRIO
    const [isFuncionarioModalOpen, setIsFuncionarioModalOpen] = useState(false);
    
    const [message, setMessage] = useState('');

    const getEmployeeData = useCallback(async () => {
        setLoading(true);
        
        const { data: employeeData, error } = await supabase
            .from('funcionarios')
            .select(`
                *, 
                cadastro_empresa(*), 
                empreendimentos(nome),
                jornada:jornadas(*, detalhes:jornada_detalhes(*))
            `)
            .eq('id', employeeId)
            .single();

        if (error || !employeeData) {
            setLoading(false);
            notFound();
            return;
        }

        if (employeeData.foto_url) {
            const { data: photoData, error: urlError } = await supabase.storage
              .from('funcionarios-documentos')
              .createSignedUrl(employeeData.foto_url, 3600);
            
            if (!urlError) {
                employeeData.foto_url = photoData.signedUrl;
            } else {
                employeeData.foto_url = null;
            }
        }

        setEmployee(employeeData);
        
        const [{ data: documentsData }, { data: pontosData }, { data: abonosData }] = await Promise.all([
            supabase.from('documentos_funcionarios').select('*, tipo:tipo_documento_id(*)').eq('funcionario_id', employeeId),
            supabase.from('pontos').select('*').eq('funcionario_id', employeeId),
            supabase.from('abonos').select('*').eq('funcionario_id', employeeId)
        ]);

        setDocuments(documentsData || []);
        setPontos(pontosData || []);
        setAbonos(abonosData || []);
        
        setLoading(false);
    }, [supabase, employeeId]);

    useEffect(() => {
        getEmployeeData();
    }, [getEmployeeData]);

    // Handlers para Lançamento Financeiro
    const handleOpenEditModal = (lancamento) => {
        setEditingLancamento(lancamento);
        setIsLancamentoModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingLancamento(null);
        setIsLancamentoModalOpen(false);
    };
    
    const handleSaveLancamento = async (formData) => {
        return true; 
    };

    // 3. HANDLER PARA QUANDO SALVAR O FUNCIONÁRIO
    const handleFuncionarioSaved = () => {
        setIsFuncionarioModalOpen(false);
        getEmployeeData(); // Recarrega os dados da tela para mostrar as alterações
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <span className="ml-4 text-lg">Carregando dados do funcionário...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Modal de Financeiro */}
            <LancamentoFormModal
                isOpen={isLancamentoModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveLancamento}
                initialData={editingLancamento}
            />

            {/* 4. MODAL DE EDIÇÃO DE FUNCIONÁRIO */}
            {isFuncionarioModalOpen && (
                <FuncionarioModal 
                    isOpen={isFuncionarioModalOpen}
                    onClose={() => setIsFuncionarioModalOpen(false)}
                    employeeToEdit={employee} // Passamos o funcionário carregado na tela
                    onSaveSuccess={handleFuncionarioSaved}
                />
            )}

            <div className="flex justify-end items-center">
                {/* 5. BOTÃO ATUALIZADO: Abre o modal ao invés de navegar */}
                <button 
                    onClick={() => setIsFuncionarioModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPen} /> Editar Ficha
                </button>
            </div>

            {message && <p className="text-center p-2 bg-blue-100 text-blue-800 rounded-md text-sm">{message}</p>}

            <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
                <FichaCompletaFuncionario 
                    employee={employee} 
                    allDocuments={documents}
                    allPontos={pontos}
                    allAbonos={abonos}
                    onUpdate={getEmployeeData}
                    onEditLancamento={handleOpenEditModal} 
                />
            </div>
        </div>
    );
}