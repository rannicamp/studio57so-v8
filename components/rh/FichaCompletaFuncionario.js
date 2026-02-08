//components\FichaCompletaFuncionario.js

"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUserCircle, faSpinner, faUpload, faEye, faTrash, faFilePdf, faFileImage, faFileWord, faFile,
    faAddressCard, faFileContract, faFileLines, faCheckCircle, faTimesCircle, faDollarSign,
    faCalendarCheck, faCalendarXmark, faBusinessTime, faPenToSquare, faSort, faSortUp, faSortDown,
    faFileInvoiceDollar, faPrint
} from '@fortawesome/free-solid-svg-icons';
import KpiCard from '@/components/shared/KpiCard';
import { toast } from 'sonner';

// --- HELPERS DE FORMATAÇÃO DE DATA ---
const formatSimpleDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
        return 'N/A';
    }
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
};

const formatTimestamp = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
};


// --- SUB-COMPONENTES ---

const InfoField = ({ label, value, fullWidth = false }) => (
    <div className={fullWidth ? "md:col-span-2" : ""}>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || 'N/A'}</dd>
    </div>
);

const CadastroChecklist = ({ employee, documents }) => {
    const checklistItems = useMemo(() => {
        const items = [];
        const uploadedSiglas = (documents || []).map(doc => doc.tipo?.sigla?.toUpperCase()).filter(Boolean);
        const requiredItems = [
            { label: 'Nome Completo', type: 'field', key: 'full_name' }, { label: 'CPF', type: 'field', key: 'cpf' },
            { label: 'Cargo', type: 'field', key: 'contract_role' }, { label: 'Data de Admissão', type: 'field', key: 'admission_date' },
            { label: 'Telefone de Contato', type: 'field', key: 'phone' }, { label: 'Endereço (CEP)', type: 'field', key: 'cep' },
            { label: 'Documento de Identidade', type: 'document', siglas: ['RG', 'CNH'] }, { label: 'Carteira de Trabalho', type: 'document', siglas: ['CTPS'] },
            { label: 'Comprovante de Residência', type: 'document', siglas: ['CRES'] }, { label: 'ASO Admissional', type: 'document', siglas: ['AAD', 'ASO'] },
            { label: 'Contrato de Experiência', type: 'document', siglas: ['CTE'] }, { label: 'Recebimento de Uniforme', type: 'document', siglas: ['REU', 'CRE'] },
            { label: 'Controle de EPI', type: 'document', siglas: ['EPI', 'CIE'] }, { label: 'Termo de Vale Transporte (VT)', type: 'document', siglas: ['VT', 'TRN', 'VTN'] },
        ];
        requiredItems.forEach(item => {
            let isCompleted = false;
            if (item.type === 'field') { isCompleted = !!employee[item.key]; }
            else if (item.type === 'document') { isCompleted = item.siglas.some(requiredSigla => uploadedSiglas.includes(requiredSigla.toUpperCase())); }
            items.push({ label: item.label, isCompleted });
        });
        return items;
    }, [employee, documents]);

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Checklist de Itens do Cadastro</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {checklistItems.map((item, index) => (
                    <div key={index} className="flex items-center p-3 bg-white border rounded-md">
                        <FontAwesomeIcon icon={item.isCompleted ? faCheckCircle : faTimesCircle} className={`w-5 h-5 mr-3 flex-shrink-0 ${item.isCompleted ? 'text-green-500' : 'text-red-500'}`} />
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DocumentosSection = ({ documentos: initialDocuments, employeeId, employeeName, organizacaoId, user, onUpdate }) => {
    const supabase = createClient();
    const [documentos, setDocumentos] = useState(initialDocuments || []);
    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [newFile, setNewFile] = useState(null);
    const [newFileType, setNewFileType] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);

    useEffect(() => {
        setDocumentos(initialDocuments || []);
    }, [initialDocuments]);

    useEffect(() => {
        const fetchTipos = async () => {
            setLoading(true);
            const { data } = await supabase.from('documento_tipos').select('*').eq('organizacao_id', organizacaoId).order('sigla');
            setTiposDocumento(data || []);
            setLoading(false);
        };
        if (organizacaoId) fetchTipos();
    }, [supabase, organizacaoId]);

    const getFileIcon = (fileName) => {
        if (!fileName) return faFile;
        const extension = fileName.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) return faFileImage;
        if (extension === 'pdf') return faFilePdf;
        if (['doc', 'docx'].includes(extension)) return faFileWord;
        return faFile;
    };

    const handleUpload = async () => {
        if (!newFile || !newFileType) {
            toast.error('Por favor, selecione um arquivo e um tipo de documento.');
            return;
        }
        setIsUploading(true);

        const tipoSelecionado = tiposDocumento.find(t => t.id == newFileType);
        const sigla = tipoSelecionado?.sigla || 'DOC';
        const fileExtension = newFile.name.split('.').pop();
        const newFileName = `documentos/${employeeId}/${sigla}_${employeeName.replace(/ /g, '_')}.${fileExtension}`;

        const { error: uploadError } = await supabase.storage.from('funcionarios-documentos').upload(newFileName, newFile, { upsert: true });

        if (uploadError) {
            toast.error('Erro no upload: ' + uploadError.message);
        } else {
            const { error: insertError } = await supabase.from('documentos_funcionarios').insert({
                funcionario_id: employeeId,
                nome_documento: tipoSelecionado.descricao,
                caminho_arquivo: newFileName,
                tipo_documento_id: newFileType,
                criado_por_usuario_id: user.id,
                organizacao_id: organizacaoId
            });

            if (insertError) {
                toast.error(`Erro ao salvar registro: ${insertError.message}`);
                await supabase.storage.from('funcionarios-documentos').remove([newFileName]);
            } else {
                toast.success('Documento enviado com sucesso!');
                setNewFile(null);
                setNewFileType('');
                if (fileInputRef.current) fileInputRef.current.value = "";
                onUpdate();
            }
        }
        setIsUploading(false);
    };

    const handleView = async (filePath) => {
        const { data } = await supabase.storage.from('funcionarios-documentos').createSignedUrl(filePath, 3600);
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
        else toast.error('Não foi possível gerar a URL do documento.');
    };

    const handleDelete = async (doc) => {
        const deleteAction = async () => {
            const { error: storageError } = await supabase.storage.from('funcionarios-documentos').remove([doc.caminho_arquivo]);
            if (storageError) throw new Error(`Erro no storage: ${storageError.message}`);

            const { error: dbError } = await supabase.from('documentos_funcionarios').delete().eq('id', doc.id);
            if (dbError) throw new Error(`Erro no banco: ${dbError.message}`);

            onUpdate();
        };

        toast.warning(`Tem certeza que deseja excluir o documento "${doc.nome_documento}"?`, {
            action: {
                label: 'Confirmar Exclusão',
                onClick: () => toast.promise(deleteAction(), {
                    loading: 'Excluindo documento...',
                    success: 'Documento excluído com sucesso!',
                    error: (err) => `Erro ao excluir: ${err.message}`
                })
            },
            cancel: {
                label: 'Cancelar'
            },
            duration: 10000,
        });
    };

    return (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Arquivo</label>
                        <input ref={fileInputRef} type="file" onChange={(e) => setNewFile(e.target.files[0])} className="mt-1 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Tipo de Documento</label>
                        <select value={newFileType} onChange={(e) => setNewFileType(e.target.value)} className="mt-1 block w-full p-2 border rounded-md">
                            <option value="">Selecione...</option>
                            {tiposDocumento.map(tipo => (<option key={tipo.id} value={tipo.id}>{tipo.sigla} - {tipo.descricao}</option>))}
                        </select>
                    </div>
                </div>
                <div className="text-right mt-4">
                    <button onClick={handleUpload} disabled={isUploading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                        {isUploading ? <><FontAwesomeIcon icon={faSpinner} spin className="mr-2"/>Enviando...</> : <><FontAwesomeIcon icon={faUpload} className="mr-2"/>Enviar Documento</>}
                    </button>
                </div>
            </div>
            <div className="space-y-3">
                {loading ? <p>Carregando...</p> : documentos.length === 0 ? <p className="text-center text-gray-500 py-4">Nenhum documento anexado.</p> :
                    documentos.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md bg-white">
                            <div className="flex items-center gap-3">
                                <FontAwesomeIcon icon={getFileIcon(doc.caminho_arquivo)} className="text-2xl text-gray-500" />
                                <div>
                                    <p className="font-semibold">{doc.nome_documento}</p>
                                    <p className="text-xs text-gray-500">Enviado em: {formatTimestamp(doc.data_upload)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={() => handleView(doc.caminho_arquivo)} className="text-blue-500 hover:text-blue-700"><FontAwesomeIcon icon={faEye} title="Visualizar"/></button>
                                <button onClick={() => handleDelete(doc)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} title="Excluir"/></button>
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
    );
};

const FinanceiroSection = ({ lancamentos, onEditLancamento }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'descending' });

    const sortedLancamentos = useMemo(() => {
        let sortableItems = [...lancamentos].map(lanc => ({
            ...lanc,
            data_ordenacao: lanc.status === 'Pago' ? lanc.data_pagamento : lanc.data_vencimento || lanc.data_transacao
        }));

        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let valA, valB;
                if (['data_vencimento', 'data_pagamento'].includes(sortConfig.key)) {
                    valA = new Date(a.data_ordenacao);
                    valB = new Date(b.data_ordenacao);
                } else if (sortConfig.key === 'categoria.nome') {
                    valA = a.categoria?.nome || '';
                    valB = b.categoria?.nome || '';
                } else {
                    valA = a[sortConfig.key] || '';
                    valB = b[sortConfig.key] || '';
                }

                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [lancamentos, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return faSort;
        return sortConfig.direction === 'ascending' ? faSortUp : faSortDown;
    };

    const SortableHeader = ({ label, sortKey, className = '' }) => (
        <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${className}`}>
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2">
                {label}
                <FontAwesomeIcon icon={getSortIcon(sortKey)} className="text-gray-400" />
            </button>
        </th>
    );

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    
    if (lancamentos.length === 0) {
        return <p className="text-center text-gray-500 py-4">Nenhum lançamento financeiro encontrado para este funcionário.</p>;
    }

    return (
        <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                    <tr>
                        <SortableHeader label="Data" sortKey="data_vencimento" />
                        <SortableHeader label="Descrição" sortKey="descricao" />
                        <SortableHeader label="Categoria" sortKey="categoria.nome" />
                        <SortableHeader label="Valor" sortKey="valor" />
                        <th className="px-4 py-2 text-center text-xs font-bold uppercase">Status</th>
                        <th className="px-4 py-2 text-center text-xs font-bold uppercase">Ações</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y">
                    {sortedLancamentos.map(lanc => {
                        const dataExibida = lanc.status === 'Pago' ? lanc.data_pagamento : lanc.data_vencimento || lanc.data_transacao;
                        return (
                            <tr key={lanc.id}>
                                <td className="px-4 py-2 whitespace-nowrap">{formatSimpleDate(dataExibida)}</td>
                                <td className="px-4 py-2">{lanc.descricao}</td>
                                <td className="px-4 py-2">{lanc.categoria?.nome || 'N/A'}</td>
                                <td className={`px-4 py-2 text-right font-semibold ${lanc.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(lanc.valor)}</td>
                                <td className="px-4 py-2 text-center">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${lanc.status === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {lanc.status}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <button onClick={() => onEditLancamento(lanc)} title="Editar Lançamento" className="text-blue-600 hover:text-blue-800">
                                        <FontAwesomeIcon icon={faPenToSquare} />
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};

const PrintConfirmationModal = ({ isOpen, onClose, onConfirmComBonus, onConfirmSemBonus }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4 no-print">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md text-center">
                <h3 className="text-xl font-bold mb-4">Opções de Impressão</h3>
                <p className="text-gray-600 mb-6">Como você deseja imprimir o contracheque?</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button 
                        onClick={onConfirmSemBonus}
                        className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition-colors w-full"
                    >
                        Versão Oficial (Sem Bônus)
                    </button>
                    <button 
                        onClick={onConfirmComBonus}
                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors w-full"
                    >
                        Versão Completa (Com Bônus)
                    </button>
                </div>
                <button 
                    onClick={onClose}
                    className="mt-6 text-sm text-gray-500 hover:text-gray-700"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
};


// =================================================================================
// INÍCIO DA CORREÇÃO
// O PORQUÊ: O componente do contracheque precisa saber a qual organização
// o funcionário pertence para gerar o contracheque corretamente e evitar o erro.
// Adicionamos `organizacaoId` como uma nova propriedade (prop) para o componente.
// =================================================================================
const ContrachequeSection = ({ employee, salarioAtual, organizacaoId }) => {
// =================================================================================
// FIM DA CORREÇÃO
// =================================================================================
    const supabase = createClient();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [contracheque, setContracheque] = useState(null);
    const [loading, setLoading] = useState(true);
    const [printView, setPrintView] = useState(null);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    
    const valorLiquidoOficial = useMemo(() => {
        if (!contracheque || !salarioAtual) return 0;
        return (salarioAtual.salario_base || 0) - (contracheque.desconto_inss || 0);
    }, [contracheque, salarioAtual]);

    const custoTotalEmpresa = useMemo(() => {
        if (!contracheque || !salarioAtual) return 0;
        const baseCalculo = salarioAtual.salario_base || 0;
        return (baseCalculo * 0.20) + (baseCalculo * 0.03) + (baseCalculo * 0.058) + (contracheque.valor_fgts || 0);
    }, [contracheque, salarioAtual]);

    const fetchContracheque = useCallback(async (month) => {
        // =================================================================================
        // INÍCIO DA CORREÇÃO
        // O PORQUÊ: Adicionamos uma verificação de segurança. Se o `organizacaoId` não
        // estiver disponível, a função não tenta gerar o contracheque, evitando o erro.
        // Em seguida, passamos o `p_organizacao_id` na chamada da função do banco de dados,
        // garantindo que ele saiba para qual organização o contracheque deve ser criado.
        // =================================================================================
        if (!employee || !month || !organizacaoId) return;
        setLoading(true);
        const { data, error } = await supabase.rpc('gerar_ou_atualizar_contracheque', { 
            p_funcionario_id: employee.id, 
            p_mes_referencia: month,
            p_organizacao_id: organizacaoId
        });
        // =================================================================================
        // FIM DA CORREÇÃO
        // =================================================================================
        if (error) { toast.error(`Erro ao gerar contracheque: ${error.message}`); setContracheque(null); } 
        else { setContracheque(data[0]); }
        setLoading(false);
    }, [supabase, employee, organizacaoId]); // Adicionamos 'organizacaoId' às dependências

    useEffect(() => { fetchContracheque(selectedMonth); }, [selectedMonth, fetchContracheque]);
    useEffect(() => { if (printView) { const timer = setTimeout(() => { window.print(); setPrintView(null); }, 100); return () => clearTimeout(timer); } }, [printView]);
    
    const handlePrintRequest = () => setIsPrintModalOpen(true);
    const handleConfirmComBonus = () => { setPrintView('comBonus'); setIsPrintModalOpen(false); };
    const handleConfirmSemBonus = () => { setPrintView('semBonus'); setIsPrintModalOpen(false); };

    return (
        <div className={`printable-contracheque ${printView === 'semBonus' ? 'print-sem-bonus' : ''}`}>
            <PrintConfirmationModal 
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                onConfirmComBonus={handleConfirmComBonus}
                onConfirmSemBonus={handleConfirmSemBonus}
            />
            <div className="space-y-4">
                <div className="flex items-center justify-between no-print">
                    <div className="flex items-center gap-4"><label className="font-semibold">Mês:</label><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="p-2 border rounded-md" /></div>
                    <button onClick={handlePrintRequest} className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faPrint} /> Imprimir</button>
                </div>

                {loading ? ( <div className="text-center p-8"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> ) : !contracheque ? ( <p className="text-center p-8 text-gray-500">Dados não disponíveis.</p> ) : (
                    <div className="space-y-6">
                        <div className="border rounded-lg p-4 md:p-8 bg-white shadow-lg contracheque-body">
                            <div className="print-header">
                                <div className="flex justify-between items-start border-b pb-4"><h4 className="font-bold text-lg">{employee.cadastro_empresa?.razao_social}</h4><div className="text-center"><h5 className="font-bold">Demonstrativo de Pagamento</h5><p className="text-sm">Período: 01/{selectedMonth.slice(5, 7)}/{selectedMonth.slice(0, 4)} a {new Date(selectedMonth.slice(0, 4), selectedMonth.slice(5, 7), 0).getDate()}/{selectedMonth.slice(5, 7)}/{selectedMonth.slice(0, 4)}</p></div></div>
                                <div className="flex justify-between items-start border-b py-2"><p className="text-sm"><span className="font-bold">Cód. {employee.id}</span> - {employee.full_name}</p><p className="text-sm">Cargo: {employee.contract_role}</p></div>
                            </div>
                            <table className="w-full mt-4 text-sm">
                                <thead><tr className="border-b"><th className="text-left font-semibold p-2">Cód.</th><th className="text-left font-semibold p-2 w-1/2">Descrição</th><th className="text-center font-semibold p-2">Referência</th><th className="text-right font-semibold p-2">Vencimentos</th><th className="text-right font-semibold p-2">Descontos</th></tr></thead>
                                <tbody>
                                    <tr className="border-b"><td className="p-2">001</td><td className="p-2">Salário Base</td><td className="text-center p-2">220:00</td><td className="text-right p-2">{formatCurrency(salarioAtual.salario_base)}</td><td className="text-right p-2"></td></tr>
                                    <tr className="border-b print-bonus-item"><td className="p-2">002</td><td className="p-2">Bônus (Ref. Diárias)</td><td className="text-center p-2">{contracheque.dias_trabalhados} dias</td><td className="text-right p-2">{formatCurrency(contracheque.bonus)}</td><td className="text-right p-2"></td></tr>
                                    <tr className="border-b print-bonus-item"><td className="p-2">003</td><td className="p-2">Adicionais</td><td className="text-center p-2">--</td><td className="text-right p-2">{formatCurrency(contracheque.adicionais)}</td><td className="text-right p-2"></td></tr>
                                    <tr className="border-b print-bonus-item"><td className="p-2">606</td><td className="p-2">Adiantamento / Outros Descontos</td><td className="text-center p-2">--</td><td className="text-right p-2"></td><td className="text-right p-2">{formatCurrency(contracheque.outros_descontos)}</td></tr>
                                    <tr className="border-b"><td className="p-2">903</td><td className="p-2">INSS Folha</td><td className="text-center p-2">{contracheque.faixa_inss}%</td><td className="text-right p-2"></td><td className="text-right p-2">{formatCurrency(contracheque.desconto_inss)}</td></tr>
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold print-bonus-item"><td colSpan="3" className="text-right p-2">Totais:</td><td className="text-right p-2">{formatCurrency((salarioAtual.salario_base || 0) + (contracheque.bonus || 0) + (contracheque.adicionais || 0))}</td><td className="text-right p-2">{formatCurrency((contracheque.desconto_inss || 0) + (contracheque.outros_descontos || 0))}</td></tr>
                                    <tr className="font-bold hidden print-sem-bonus-only"><td colSpan="3" className="text-right p-2">Totais:</td><td className="text-right p-2">{formatCurrency(salarioAtual.salario_base)}</td><td className="text-right p-2">{formatCurrency(contracheque.desconto_inss)}</td></tr>
                                </tfoot>
                            </table>
                            <div className="mt-6 flex justify-between items-end">
                                <table className="w-full text-xs">
                                    <thead><tr className="border-t border-b"><th className="p-1 text-left font-semibold">Salário Base</th><th className="p-1 text-left font-semibold">Base Cálc. INSS</th><th className="p-1 text-left font-semibold print-bonus-item">Base Cálc. FGTS</th><th className="p-1 text-left font-semibold">F.G.T.S do mês</th><th className="p-1 text-left font-semibold">Base Cálc. IRRF</th></tr></thead>
                                    <tbody><tr><td className="p-1">{formatCurrency(salarioAtual.salario_base)}</td><td className="p-1">{formatCurrency(salarioAtual.salario_base)}</td><td className="p-1 print-bonus-item">{formatCurrency(contracheque.base_calculo_fgts)}</td><td className="p-1">{formatCurrency(contracheque.valor_fgts)}</td><td className="p-1">{formatCurrency(contracheque.base_calculo_irrf)}</td></tr></tbody>
                                </table>
                                <div className="text-right pl-4">
                                    <p className="text-sm">Valor Líquido</p>
                                    <p className="font-bold text-lg print-bonus-item">{formatCurrency(contracheque.valor_liquido)}</p>
                                    <p className="font-bold text-lg hidden print-sem-bonus-only">{formatCurrency(valorLiquidoOficial)}</p>
                                </div>
                            </div>
                            <div className="hidden print:block mt-24">{/* ...assinatura... */}</div>
                        </div>
                        
                        <div className="no-print border rounded-lg p-4 bg-gray-50 shadow-md">
                            <h4 className="font-semibold text-lg text-gray-800 mb-3 border-b pb-2">Custo Total da Empresa</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-600">INSS Patronal (20%):</span> <span className="font-medium">{formatCurrency((salarioAtual.salario_base || 0) * 0.20)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">RAT (3%):</span> <span className="font-medium">{formatCurrency((salarioAtual.salario_base || 0) * 0.03)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Terceiros (5.8%):</span> <span className="font-medium">{formatCurrency((salarioAtual.salario_base || 0) * 0.058)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">FGTS (8%):</span> <span className="font-medium">{formatCurrency(contracheque.valor_fgts)}</span></div>
                                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                                    <span className="text-gray-800">Custo Total (Encargos):</span>
                                    <span className="text-blue-700">{formatCurrency(custoTotalEmpresa)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


// Componente Principal
export default function FichaCompletaFuncionario({ employee, allDocuments, allPontos, allAbonos, onUpdate, onEditLancamento }) {
    const [activeTab, setActiveTab] = useState('pessoal');
    const [lancamentos, setLancamentos] = useState([]);
    const [holidays, setHolidays] = useState(new Set());
    const supabase = createClient();
    const { user } = useAuth(); 
    const organizacaoId = user?.organizacao_id; 
    
    const [loadingSalario, setLoadingSalario] = useState(true);
    const [salarioAtual, setSalarioAtual] = useState({ salario_base: null, valor_diaria: null });
    
    useEffect(() => {
        const fetchSalarioAtual = async () => {
            if (employee?.id && organizacaoId) {
                setLoadingSalario(true);
                const { data, error } = await supabase
                    .from('historico_salarial')
                    .select('salario_base, valor_diaria')
                    .eq('funcionario_id', employee.id)
                    .eq('organizacao_id', organizacaoId)
                    .order('data_inicio_vigencia', { ascending: false })
                    .limit(1)
                    .single();
                
                if (data) {
                    setSalarioAtual(data);
                } else {
                    const fallbackSalary = {
                        salario_base: parseFloat(String(employee.base_salary || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || 0,
                        valor_diaria: parseFloat(String(employee.daily_value || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || 0
                    };
                    setSalarioAtual(fallbackSalary);
                }
                setLoadingSalario(false);
            }
        };
        fetchSalarioAtual();
    }, [employee, supabase, organizacaoId, onUpdate]);

    useEffect(() => {
        const fetchHolidaysForYear = async () => {
            const year = new Date().getFullYear();
            try {
                const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
                if (!response.ok) return;
                const data = await response.json();
                setHolidays(new Set(data.map(h => h.date)));
            } catch (error) { console.error("Erro ao buscar feriados:", error); }
        };
        fetchHolidaysForYear();
    }, []);
    
    const kpiData = useMemo(() => {
        const valorDiaria = salarioAtual.valor_diaria || 0;

        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        let diasUteisAteHoje = 0;
        let cargaHorariaEsperadaMinutos = 0;
        const jornadaDetalhes = employee.jornada?.detalhes || [];

        if (jornadaDetalhes.length > 0) {
            for (let d = new Date(firstDayOfMonth); d <= today; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                const dateString = d.toISOString().split('T')[0];
                if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateString)) {
                    diasUteisAteHoje++;
                    const jornadaDoDia = jornadaDetalhes.find(j => j.dia_semana === dayOfWeek);
                    if (jornadaDoDia) {
                        const entrada = jornadaDoDia.horario_entrada ? jornadaDoDia.horario_entrada.split(':').map(Number) : [0,0];
                        const saida = jornadaDoDia.horario_saida ? jornadaDoDia.horario_saida.split(':').map(Number) : [0,0];
                        const inicioIntervalo = jornadaDoDia.horario_saida_intervalo ? jornadaDoDia.horario_saida_intervalo.split(':').map(Number) : [0,0];
                        const fimIntervalo = jornadaDoDia.horario_volta_intervalo ? jornadaDoDia.horario_volta_intervalo.split(':').map(Number) : [0,0];
                        
                        const minutosTrabalho = (saida[0]*60 + saida[1]) - (entrada[0]*60 + entrada[1]);
                        const minutosIntervalo = (fimIntervalo[0]*60 + fimIntervalo[1]) - (inicioIntervalo[0]*60 + inicioIntervalo[1]);
                        
                        cargaHorariaEsperadaMinutos += minutosTrabalho - (minutosIntervalo > 0 ? minutosIntervalo : 0);
                    }
                }
            }
        }
        const cargaHorariaEsperadaFormatada = `${Math.floor(cargaHorariaEsperadaMinutos / 60)}:${String(cargaHorariaEsperadaMinutos % 60).padStart(2, '0')}h`;

        const pontosDoMes = allPontos.filter(ponto => {
            const pontoDate = new Date(ponto.data_hora);
            return pontoDate.getMonth() === currentMonth && pontoDate.getFullYear() === currentYear;
        });
        
        const pontosPorDia = pontosDoMes.reduce((acc, ponto) => {
            const dia = ponto.data_hora.split('T')[0];
            if (!acc[dia]) acc[dia] = [];
            acc[dia].push(new Date(ponto.data_hora));
            return acc;
        }, {});

        const diasTrabalhados = Object.keys(pontosPorDia).length;
        let totalMinutosTrabalhados = 0;

        for (const dia in pontosPorDia) {
            const registros = pontosPorDia[dia].sort((a, b) => a - b);
            if (registros.length >= 2) {
                let diff = registros[registros.length - 1] - registros[0];
                if (registros.length >= 4) { diff -= (registros[2] - registros[1]); }
                totalMinutosTrabalhados += diff / (1000 * 60);
            }
        }
        const horasTrabalhadasFormatada = `${Math.floor(totalMinutosTrabalhados / 60)}:${String(Math.round(totalMinutosTrabalhados % 60)).padStart(2, '0')}h`;
        const faltas = Math.max(0, diasUteisAteHoje - diasTrabalhados);
        
        const valorAPagar = diasTrabalhados * valorDiaria;

        return {
            dias: `${diasTrabalhados} / ${diasUteisAteHoje}`,
            horas: `${horasTrabalhadasFormatada} / ${cargaHorariaEsperadaFormatada}`,
            faltas: faltas,
            valorAPagar: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorAPagar),
        };

    }, [employee, allPontos, holidays, salarioAtual]);
    
    const fetchLancamentos = useCallback(async () => {
        if (!employee.contato_id || !organizacaoId) {
            setLancamentos([]);
            return;
        }
        const { data } = await supabase
            .from('lancamentos')
            .select('*, categoria:categorias_financeiras(nome)')
            .eq('favorecido_contato_id', employee.contato_id)
            .eq('organizacao_id', organizacaoId)
            .order('data_vencimento', { ascending: false }); 
        
        setLancamentos(data || []);
    }, [employee, supabase, organizacaoId]);

    useEffect(() => { if (activeTab === 'financeiro') { fetchLancamentos(); } }, [activeTab, fetchLancamentos]);
    
    const TabButton = ({ tabName, label, icon }) => ( 
        <button onClick={() => setActiveTab(tabName)} className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${activeTab === tabName ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
            <FontAwesomeIcon icon={icon} /> {label} 
        </button> 
    );
    
    const formatCurrency = (value) => value != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) : 'N/A';
    
    return (
        <div className="space-y-8">
            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .printable-contracheque, .printable-contracheque * { visibility: visible; }
                    .printable-contracheque { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
                    .no-print { display: none !important; }
                    .print-sem-bonus .print-bonus-item { display: none; }
                    .print-sem-bonus .print-sem-bonus-only { display: block !important; }
                }
            `}</style>

            <div className="flex flex-col md:flex-row gap-6 items-start no-print">
                {employee.foto_url ? ( <img src={employee.foto_url} alt="Foto do Funcionário" className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg" /> ) : ( <FontAwesomeIcon icon={faUserCircle} className="w-28 h-28 text-gray-300" /> )}
                <div className="flex-grow">
                    <h2 className="text-3xl font-bold text-gray-900">{employee.full_name}</h2>
                    <p className="text-lg text-gray-600">{employee.contract_role}</p>
                    <span className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ employee.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}> {employee.status} </span>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
                <KpiCard title="Valor a Pagar (Mês)" value={kpiData.valorAPagar} icon={faDollarSign} color="purple" />
                <KpiCard title="Dias (Trab. / Úteis)" value={kpiData.dias} icon={faCalendarCheck} color="blue" />
                <KpiCard title="Horas (Trab. / Prev.)" value={kpiData.horas} icon={faBusinessTime} color="green" />
                <KpiCard title="Faltas (no período)" value={kpiData.faltas} icon={faCalendarXmark} color="red" />
            </div>

            <div className="border-t pt-6">
                <div className="flex items-center border-b mb-6 no-print">
                    <nav className="flex space-x-2" aria-label="Tabs">
                        <TabButton tabName="pessoal" label="Dados Pessoais" icon={faAddressCard} />
                        <TabButton tabName="contracheque" label="Contracheque" icon={faFileInvoiceDollar} />
                        <TabButton tabName="documentos" label="Documentos" icon={faFileLines} />
                        <TabButton tabName="financeiro" label="Financeiro" icon={faDollarSign} />
                        <TabButton tabName="checklist" label="Checklist" icon={faCheckCircle} />
                    </nav>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    {activeTab === 'pessoal' && (
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <InfoField label="Salário Base" value={loadingSalario ? '...' : formatCurrency(salarioAtual.salario_base)} />
                            <InfoField label="Valor Diária" value={loadingSalario ? '...' : formatCurrency(salarioAtual.valor_diaria)} />
                            <InfoField label="CPF" value={employee.cpf} />
                            <InfoField label="RG" value={employee.rg} />
                            <InfoField label="Data de Nascimento" value={formatSimpleDate(employee.birth_date)} />
                            <InfoField label="Estado Civil" value={employee.estado_civil} />
                            <InfoField label="Telefone" value={employee.phone} />
                            <InfoField label="Email" value={employee.email} />
                            <InfoField label="Empresa Contratante" value={employee.cadastro_empresa?.razao_social} />
                            <InfoField label="Empreendimento Atual" value={employee.empreendimentos?.nome} />
                            <InfoField label="Data de Admissão" value={formatSimpleDate(employee.admission_date)}/>
                            <InfoField label="Endereço" value={`${employee.address_street || ''}, ${employee.address_number || ''} - ${employee.neighborhood || ''}, ${employee.city || ''}`} fullWidth={true}/>
                            <InfoField label="Observações" value={employee.observations} fullWidth={true} />
                        </dl>
                    )}
                    {/*
                    // =================================================================================
                    // INÍCIO DA CORREÇÃO
                    // O PORQUÊ: Aqui passamos a propriedade `organizacaoId` que acabamos de
                    // adicionar ao componente `ContrachequeSection`.
                    // =================================================================================
                    */}
                    {activeTab === 'contracheque' && <ContrachequeSection employee={employee} salarioAtual={salarioAtual} organizacaoId={organizacaoId} />}
                    {/* =================================================================================
                    // FIM DA CORREÇÃO
                    // =================================================================================
                    */}
                    {activeTab === 'documentos' && ( <DocumentosSection documentos={allDocuments} employeeId={employee.id} employeeName={employee.full_name} organizacaoId={employee.organizacao_id} user={user} onUpdate={onUpdate} /> )}
                    {activeTab === 'financeiro' && ( <FinanceiroSection lancamentos={lancamentos} onEditLancamento={onEditLancamento} /> )}
                    {activeTab === 'checklist' && ( <CadastroChecklist employee={employee} documents={allDocuments} /> )}
                </div>
            </div>
        </div>
    );
}