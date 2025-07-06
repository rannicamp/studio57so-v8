"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import ContasManager from '../../../components/financeiro/ContasManager';
import CategoriasManager from '../../../components/financeiro/CategoriasManager';
import ConciliacaoManager from '../../../components/financeiro/ConciliacaoManager';
import LancamentoFormModal from '../../../components/financeiro/LancamentoFormModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCogs } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';

export default function FinanceiroPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('lancamentos');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const [empresas, setEmpresas] = useState([]);
    const [contas, setContas] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [lancamentos, setLancamentos] = useState([]);
    
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [
            { data: lancamentosData, error: lancamentosError },
            { data: empresasData, error: empresasError },
            { data: contasData, error: contasError },
            { data: categoriasData, error: categoriasError },
            { data: empreendimentosData, error: empreendimentosError }
        ] = await Promise.all([
            supabase.from('lancamentos').select('*, empresa:empresa_id(nome_fantasia, razao_social), conta:conta_id(nome, instituicao), categoria:categoria_id(nome), favorecido:favorecido_contato_id(nome, razao_social), empreendimento:empreendimento_id(nome, empresa:empresa_proprietaria_id(nome_fantasia, razao_social)), anexos:lancamentos_anexos(*)').order('data_vencimento', { ascending: false, nullsFirst: false }),
            supabase.from('cadastro_empresa').select('*').order('nome_fantasia'),
            supabase.from('contas_financeiras').select('*').order('nome'),
            supabase.from('categorias_financeiras').select('*').order('nome'),
            supabase.from('empreendimentos').select('*, empresa:empresa_proprietaria_id(nome_fantasia, razao_social)').order('nome')
        ]);
        if (lancamentosError || contasError || categoriasError || empreendimentosError || empresasError) {
            setMessage("Ocorreu um erro ao carregar os dados financeiros.");
            console.error(lancamentosError || contasError || categoriasError || empreendimentosError || empresasError)
        } else {
            setLancamentos(lancamentosData || []);
            setEmpresas(empresasData || []);
            setContas(contasData || []);
            setCategorias(categoriasData || []);
            setEmpreendimentos(empreendimentosData || []);
        }
        setLoading(false);
    }, [supabase]);
    
    useEffect(() => {
        setPageTitle('Gestão Financeira');
        fetchData();
    }, [setPageTitle, fetchData]);
    
    // ***** NOVA LÓGICA DE SALVAR CENTRALIZADA *****
    const handleSaveLancamento = async (formData) => {
        const isEditing = Boolean(formData.id);
        const { anexo, novo_favorecido, ...baseFormData } = formData;
        
        let finalFormData = { ...baseFormData };

        // 1. Criar novo favorecido se necessário
        if (novo_favorecido && novo_favorecido.nome) {
            const { data: novoContato, error: contatoError } = await supabase.from('contatos').insert({ nome: novo_favorecido.nome, tipo_contato: novo_favorecido.tipo_contato }).select().single();
            if (contatoError) {
                setMessage(`Erro ao criar novo favorecido: ${contatoError.message}`);
                return false;
            }
            finalFormData.favorecido_contato_id = novoContato.id;
        }

        // 2. Salvar o lançamento principal (ou atualizar)
        let lancamentoId = finalFormData.id;
        let error;
        if (isEditing) {
            const { id, ...dataToUpdate } = finalFormData;
            const { error: updateError } = await supabase.from('lancamentos').update(dataToUpdate).eq('id', id);
            error = updateError;
        } else {
            delete finalFormData.id;
            const { data: newLancamento, error: insertError } = await supabase.from('lancamentos').insert(finalFormData).select().single();
            error = insertError;
            if (newLancamento) lancamentoId = newLancamento.id;
        }

        if (error) {
            setMessage(`Erro ao salvar lançamento: ${error.message}`);
            return false;
        }

        // 3. Lidar com o anexo
        if (anexo && anexo.file && lancamentoId) {
            const file = anexo.file;
            const filePath = `lancamento-${lancamentoId}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage.from('documentos-financeiro').upload(filePath, file);

            if (uploadError) {
                setMessage(`Lançamento salvo, mas falha ao enviar anexo: ${uploadError.message}`);
            } else {
                const { error: anexoError } = await supabase.from('lancamentos_anexos').insert({
                    lancamento_id: lancamentoId,
                    caminho_arquivo: filePath,
                    nome_arquivo: file.name,
                    descricao: anexo.descricao,
                    tipo_documento_id: anexo.tipo_documento_id
                });
                if (anexoError) setMessage(`Lançamento salvo, mas falha ao registrar anexo: ${anexoError.message}`);
            }
        }
        
        setMessage(`Lançamento ${isEditing ? 'atualizado' : 'criado'} com sucesso!`);
        router.refresh(); // FORÇA A ATUALIZAÇÃO DA PÁGINA
        return true;
    };
    
    const handleDeleteLancamento = async (id) => {
        if (!window.confirm("Tem certeza que deseja excluir este lançamento?")) return;
        const { error } = await supabase.from('lancamentos').delete().eq('id', id);
        if(error) {
            setMessage('Erro ao excluir: ' + error.message);
        } else {
            setMessage('Lançamento excluído.');
            router.refresh(); // FORÇA A ATUALIZAÇÃO DA PÁGINA
        }
    };

    const handleOpenAddModal = () => { setEditingLancamento(null); setIsFormModalOpen(true); };
    const handleOpenEditModal = (lancamento) => { setEditingLancamento(lancamento); setIsFormModalOpen(true); };

    const TabButton = ({ tabName, label }) => (
        <button onClick={() => setActiveTab(tabName)} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            {label}
        </button>
    );

    return (
        <div className="space-y-6">
            <LancamentoFormModal 
                isOpen={isFormModalOpen} 
                onClose={() => setIsFormModalOpen(false)} 
                onSave={handleSaveLancamento}
                initialData={editingLancamento}
            />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Painel Financeiro</h1>
                {activeTab === 'lancamentos' && (
                    <div className="flex items-center gap-2">
                         <Link href="/configuracoes/financeiro/importar" className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2">
                             <FontAwesomeIcon icon={faCogs} /> Assistente de Importação
                         </Link>
                         <button onClick={handleOpenAddModal} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2">
                            <FontAwesomeIcon icon={faPlus} /> Novo Lançamento
                         </button>
                    </div>
                )}
            </div>

            <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
                <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
                    <TabButton tabName="lancamentos" label="Lançamentos" />
                    <TabButton tabName="conciliacao" label="Conciliação Bancária" />
                    <TabButton tabName="contas" label="Contas" />
                    <TabButton tabName="categorias" label="Categorias" />
                </nav>
            </div>
            
            {message && <p className="text-center p-2 bg-blue-50 text-blue-800 rounded-md text-sm">{message}</p>}

            <div className="mt-4">
                {activeTab === 'lancamentos' && (
                    <LancamentosManager 
                        lancamentos={lancamentos} 
                        loading={loading}
                        contas={contas}
                        categorias={categorias}
                        empreendimentos={empreendimentos}
                        empresas={empresas}
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteLancamento}
                        onUpdate={() => router.refresh()}
                    />
                )}
                {activeTab === 'conciliacao' && <ConciliacaoManager contas={contas} />}
                {activeTab === 'contas' && <ContasManager />}
                {activeTab === 'categorias' && <CategoriasManager />}
            </div>
        </div>
    );
}