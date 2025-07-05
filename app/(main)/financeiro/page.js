"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { createClient } from '../../../utils/supabase/client';
import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import ContasManager from '../../../components/financeiro/ContasManager';
import CategoriasManager from '../../../components/financeiro/CategoriasManager';
import ConciliacaoManager from '../../../components/financeiro/ConciliacaoManager';
import LancamentoFormModal from '../../../components/financeiro/LancamentoFormModal';
import LancamentoImporter from '../../../components/financeiro/LancamentoImporter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faFileImport } from '@fortawesome/free-solid-svg-icons';

export default function FinanceiroPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();

    const [activeTab, setActiveTab] = useState('lancamentos');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const [contas, setContas] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [lancamentos, setLancamentos] = useState([]);
    
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isImporterOpen, setIsImporterOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [
            { data: lancamentosData, error: lancamentosError },
            { data: contasData, error: contasError },
            { data: categoriasData, error: categoriasError },
            { data: empreendimentosData, error: empreendimentosError }
        ] = await Promise.all([
            supabase.from('lancamentos').select('*, conta:contas_financeiras(nome, instituicao), categoria:categorias_financeiras(nome), favorecido:favorecido_contato_id(nome, razao_social), empreendimento:empreendimento_id(nome)').order('data_vencimento', { ascending: false, nullsFirst: false }),
            supabase.from('contas_financeiras').select('*').order('nome'),
            supabase.from('categorias_financeiras').select('*').order('nome'),
            supabase.from('empreendimentos').select('*').order('nome')
        ]);
        if (lancamentosError || contasError || categoriasError || empreendimentosError) {
            setMessage("Ocorreu um erro ao carregar os dados financeiros.");
        } else {
            setLancamentos(lancamentosData || []);
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

    const handleSaveLancamento = async (formData) => {
        const isEditing = Boolean(formData.id);
        const { novo_favorecido, anexo, ...baseFormData } = formData;
        let finalFormData = { ...baseFormData };

        if (novo_favorecido && novo_favorecido.nome) {
            const { data: novoContato, error: contatoError } = await supabase.from('contatos').insert({ nome: novo_favorecido.nome, tipo_contato: novo_favorecido.tipo_contato, personalidade_juridica: 'Pessoa Física' }).select().single();
            if (contatoError) { setMessage(`Erro ao criar novo contato: ${contatoError.message}`); return false; }
            finalFormData.favorecido_contato_id = novoContato.id;
        }
        
        try {
            // ... (A lógica de salvar parcelado, transferência e simples permanece a mesma)

            setMessage(`Ação realizada com sucesso!`);
            fetchData();
            return true;
        } catch (error) {
            setMessage(`Erro: ${error.message}`);
            return false;
        }
    };
    
    const handleDeleteLancamento = async (id) => {
        if (!window.confirm("Tem certeza que deseja excluir este lançamento?")) return;
        const { error } = await supabase.from('lancamentos').delete().eq('id', id);
        if(error) {
            setMessage('Erro ao excluir: ' + error.message);
        } else {
            setMessage('Lançamento excluído.');
            fetchData();
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
            <LancamentoImporter 
                isOpen={isImporterOpen} 
                onClose={() => setIsImporterOpen(false)} 
                onImportComplete={fetchData} 
            />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Painel Financeiro</h1>
                {activeTab === 'lancamentos' && (
                    <div className="flex items-center gap-2">
                         <button onClick={() => setIsImporterOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2">
                             <FontAwesomeIcon icon={faFileImport} /> Importar CSV
                         </button>
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
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteLancamento}
                    />
                )}
                {activeTab === 'conciliacao' && <ConciliacaoManager contas={contas} />}
                {activeTab === 'contas' && <ContasManager />}
                {activeTab === 'categorias' && <CategoriasManager />}
            </div>
        </div>
    );
}