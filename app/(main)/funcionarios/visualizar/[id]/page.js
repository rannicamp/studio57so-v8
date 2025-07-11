"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../../../utils/supabase/client';
import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPen } from '@fortawesome/free-solid-svg-icons';
import FichaCompletaFuncionario from '../../../../../components/FichaCompletaFuncionario';
import LancamentoFormModal from '../../../../../components/financeiro/LancamentoFormModal'; // Importando o Modal

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

    // ***** INÍCIO DA CORREÇÃO *****
    // Estados para controlar o modal de lançamento
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);
    const [message, setMessage] = useState('');
    // ***** FIM DA CORREÇÃO *****

    const getEmployeeData = useCallback(async () => {
        setLoading(true);
        
        const { data: employeeData, error } = await supabase
            .from('funcionarios')
            .select('*, cadastro_empresa(razao_social), empreendimentos(nome)')
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

    // ***** INÍCIO DA CORREÇÃO *****
    // Funções para controlar o modal
    const handleOpenEditModal = (lancamento) => {
        setEditingLancamento(lancamento);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingLancamento(null);
        setIsModalOpen(false);
    };
    
    // Função para salvar o lançamento (edição e upload)
    const handleSaveLancamento = async (formData) => {
        const { anexo, ...baseFormData } = formData;
        let lancamentoId = baseFormData.id;
        
        if (!lancamentoId) {
            setMessage('Erro: ID do lançamento não encontrado para atualização.');
            return false;
        }

        // 1. Atualiza os dados principais do lançamento
        const { error: updateError } = await supabase
            .from('lancamentos')
            .update(baseFormData)
            .eq('id', lancamentoId);

        if (updateError) {
            setMessage(`Erro ao atualizar lançamento: ${updateError.message}`);
            return false;
        }

        // 2. Se um NOVO arquivo foi selecionado, faz o upload e atualiza o anexo
        if (anexo && anexo.file && lancamentoId) {
            const file = anexo.file;
            const filePath = `lancamento-${lancamentoId}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage.from('documentos-financeiro').upload(filePath, file);

            if (uploadError) {
                setMessage(`Lançamento salvo, mas falha ao enviar novo anexo: ${uploadError.message}`);
            } else {
                // Remove o anexo antigo se existir
                if (anexo.id) {
                    await supabase.from('lancamentos_anexos').delete().eq('id', anexo.id);
                }
                // Insere o novo registro de anexo
                const { error: anexoError } = await supabase.from('lancamentos_anexos').insert({ 
                    lancamento_id: lancamentoId, 
                    caminho_arquivo: filePath, 
                    nome_arquivo: file.name, 
                    descricao: anexo.descricao, 
                    tipo_documento_id: anexo.tipo_documento_id 
                });
                if (anexoError) {
                    setMessage(`Lançamento salvo, mas falha ao registrar novo anexo: ${anexoError.message}`);
                }
            }
        }

        setMessage('Lançamento atualizado com sucesso!');
        getEmployeeData(); // Recarrega os dados para mostrar a atualização
        return true; // Retorna sucesso para o modal fechar
    };
    // ***** FIM DA CORREÇÃO *****

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
            {/* O Modal agora existe nesta página */}
            <LancamentoFormModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveLancamento}
                initialData={editingLancamento}
            />

            <div className="flex justify-between items-center">
                <Link href="/funcionarios" className="text-blue-500 hover:underline inline-block">
                    &larr; Voltar para a Lista de Funcionários
                </Link>
                <button 
                    onClick={() => router.push(`/funcionarios/editar/${employeeId}`)}
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
                    // Passando a função para abrir o modal
                    onEditLancamento={handleOpenEditModal} 
                />
            </div>
        </div>
    );
}