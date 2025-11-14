// components/pedidos/PedidoDetalhesSidebar.js
"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faPenToSquare, faCalendarAlt, faUser, faBuilding, faClipboardList, 
    faAlignLeft, faPaperclip, faSpinner, faDollarSign, faHandHoldingDollar, 
    faFloppyDisk, faBan, faExternalLinkAlt, 
    faCheckCircle // <-- ÍCONE DE CHECK ADICIONADO
} from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import LancamentoFormModal from '../financeiro/LancamentoFormModal';
import { createClient } from '@/utils/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Componente de Leitura
const InfoField = ({ icon, label, value }) => {
    if (!value && value !== 0) return null;
    return (
        <div>
            <dt className="text-xs font-medium text-gray-500 flex items-center gap-2">
                <FontAwesomeIcon icon={icon} className="w-3 h-3" />
                {label}
            </dt>
            <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{value}</dd>
        </div>
    );
};

// Componente de Edição
const EditField = ({ label, name, value, onChange, type = 'text', children }) => (
    <div>
        <label htmlFor={name} className="block text-xs font-medium text-gray-700">{label}</label>
        {type === 'textarea' ? (
            <textarea
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                rows="4"
                className="mt-1 w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
        ) : type === 'select' ? (
            <select
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                className="mt-1 w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
                {children}
            </select>
        ) : (
            <input
                type={type}
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                className="mt-1 w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
        )}
    </div>
);


export default function PedidoDetalhesSidebar({ 
    isOpen, 
    onClose, 
    pedido, 
    onUpdate, 
    solicitantes = [], 
    empreendimentos = [],
    onEditCompleto
}) {
    const router = useRouter();
    const supabase = createClient();
    const queryClient = useQueryClient();

    const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
    const [lancamentoInitialData, setLancamentoInitialData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editableData, setEditableData] = useState(null);

    useEffect(() => {
        if (pedido) {
            setEditableData(pedido);
            setIsEditing(false);
        }
    }, [pedido]);

    const updatePedidoMutation = useMutation({
        mutationFn: async (updatedData) => {
            const { data, error } = await supabase
                .from('pedidos_compra')
                .update(updatedData)
                .eq('id', pedido.id)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            toast.success("Pedido atualizado com sucesso!");
            setIsEditing(false);
            setEditableData(data);
            if (onUpdate) onUpdate();
            queryClient.invalidateQueries({ queryKey: ['pedido', pedido.id] });
        },
        onError: (error) => {
            toast.error(`Erro ao salvar: ${error.message}`);
        }
    });

    if (!isOpen || !pedido || !editableData) return null;

    // =================================================================================
    // VARIÁVEL DE CONTROLE DO BOTÃO
    // =================================================================================
    const jaLancado = pedido.lancamentos && pedido.lancamentos.length > 0;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            if (dateStr.includes('T')) {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return 'Data inválida';
                return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
            }
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return dateStr;
        } catch (error) { return 'Erro na data'; }
    };

    const formatCurrency = (value) => {
         if (value === null || value === undefined || isNaN(Number(value))) return 'R$ 0,00';
         return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
     };

    const totalPedidoReal = pedido.itens?.reduce((acc, item) => acc + (Number(item.custo_total_real) || 0), 0) || 0;
    const totalPedidoEstimado = pedido.itens?.reduce((acc, item) => {
        const valorEstimado = Number(item.custo_total_estimado) || Number(item.custo_total_real) || 0;
        return acc + valorEstimado;
    }, 0) || 0;

    const handleEditCompletoClick = () => {
        if (onEditCompleto) {
            onEditCompleto(pedido);
        } else {
            router.push(`/pedidos/${pedido.id}`);
        }
    };

    const handleOpenLancamentoModal = () => {
        if (!pedido.itens || pedido.itens.length === 0) { toast.error("Adicione itens ao pedido antes de planejar um pagamento."); return; }
        const totalPedidoValor = pedido.itens.reduce((acc, item) => acc + (parseFloat(item.custo_total_real) || 0), 0);
        if (totalPedidoValor <= 0) { toast.error("O valor total deve ser maior que zero."); return; }
        
        const firstFornecedorId = pedido.itens[0].fornecedor_id;
        const allSameFornecedor = pedido.itens.every(item => item.fornecedor_id === firstFornecedorId);
        const notaFiscalAnexo = pedido.anexos?.find(a => a.descricao && a.descricao.toLowerCase().includes('nota fiscal'));
        let etapaObraId = null;
        if (pedido.itens.length > 0) {
            const firstEtapaId = pedido.itens[0].etapa_id;
            if (firstEtapaId && pedido.itens.every(item => item.etapa_id === firstEtapaId)) etapaObraId = firstEtapaId;
        }
        const empresaIdCorreta = pedido.empreendimentos?.empresa_proprietaria_id || null;

        const initial = {
            descricao: `Pagamento Ref. Pedido de Compra #${pedido.id} - ${pedido.titulo || ''}`.trim(),
            valor: totalPedidoValor.toFixed(2),
            data_vencimento: new Date().toISOString().split('T')[0],
            tipo: 'Despesa',
            status: 'Pendente',
            favorecido_contato_id: allSameFornecedor ? firstFornecedorId : null,
            empreendimento_id: pedido.empreendimento_id,
            empresa_id: empresaIdCorreta,
            etapa_obra_id: etapaObraId,
            anexo_preexistente: notaFiscalAnexo ? { caminho_arquivo: notaFiscalAnexo.caminho_arquivo, nome_arquivo: notaFiscalAnexo.nome_arquivo, descricao: notaFiscalAnexo.descricao } : null,
             pedido_compra_id: pedido.id
        };
        setLancamentoInitialData(initial);
        setIsLancamentoModalOpen(true);
    };

    const handleQuickEditToggle = () => {
        if (isEditing) setEditableData(pedido);
        setIsEditing(!isEditing);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditableData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveClick = (e) => {
        e.preventDefault();
        const dataToSave = {
            titulo: editableData.titulo,
            empreendimento_id: editableData.empreendimento_id,
            solicitante_id: editableData.solicitante_id,
            data_entrega_prevista: editableData.data_entrega_prevista || null,
            turno_entrega: editableData.turno_entrega || null,
            observacoes: editableData.observacoes || null,
        };
        updatePedidoMutation.mutate(dataToSave);
    };


    return (
        <>
            <LancamentoFormModal isOpen={isLancamentoModalOpen} onClose={() => setIsLancamentoModalOpen(false)} onSuccess={() => { toast.success("Pagamento registrado!"); setIsLancamentoModalOpen(false); if (onUpdate) onUpdate(); }} initialData={lancamentoInitialData} />

            <div className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <header className="p-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Detalhes do Pedido</h3>
                            <p className="text-xs text-gray-500">ID #{pedido.id}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                    </header>

                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        {isEditing ? (
                            <form onSubmit={handleSaveClick} className="space-y-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xl font-semibold text-gray-900">Editando Pedido</h4>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={handleQuickEditToggle} className="text-sm font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1"><FontAwesomeIcon icon={faBan} /> Cancelar</button>
                                        <button type="submit" disabled={updatePedidoMutation.isPending} className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"><FontAwesomeIcon icon={updatePedidoMutation.isPending ? faSpinner : faFloppyDisk} spin={updatePedidoMutation.isPending} /> Salvar</button>
                                    </div>
                                </div>
                                <EditField label="Título do Pedido" name="titulo" value={editableData.titulo} onChange={handleInputChange} />
                                <EditField label="Empreendimento" name="empreendimento_id" value={editableData.empreendimento_id} onChange={handleInputChange} type="select">
                                    <option value="">Selecione...</option>
                                    {empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                </EditField>
                                <EditField label="Solicitante" name="solicitante_id" value={editableData.solicitante_id} onChange={handleInputChange} type="select">
                                    <option value="">Selecione...</option>
                                    {solicitantes.map(s => <option key={s.id} value={s.id}>{s.nome} {s.sobrenome}</option>)}
                                </EditField>
                                <EditField label="Observações do Solicitante" name="observacoes" value={editableData.observacoes} onChange={handleInputChange} type="textarea" />
                                <hr />
                                <EditField label="Entrega Prevista" name="data_entrega_prevista" value={editableData.data_entrega_prevista?.split('T')[0] || ''} onChange={handleInputChange} type="date" />
                                <EditField label="Turno de Entrega" name="turno_entrega" value={editableData.turno_entrega} onChange={handleInputChange} type="select">
                                    <option value="">Nenhum</option>
                                    <option value="Manhã">Manhã</option>
                                    <option value="Tarde">Tarde</option>
                                    <option value="Noite">Noite</option>
                                </EditField>
                            </form>
                        ) : (
                            <section>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xl font-semibold text-gray-900">{pedido.titulo || `Pedido #${pedido.id}`}</h4>
                                    <div className="flex gap-3">
                                        <button onClick={handleQuickEditToggle} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-200" title="Editar campos principais">
                                            <FontAwesomeIcon icon={faPenToSquare} /> Editar Rápido
                                        </button>
                                        <button onClick={handleEditCompletoClick} className="text-xs font-semibold text-gray-700 hover:text-gray-900 flex items-center gap-1 bg-gray-100 px-2 py-1 rounded border border-gray-300" title="Abrir formulário completo com itens e anexos">
                                            <FontAwesomeIcon icon={faExternalLinkAlt} /> Abrir Completo
                                        </button>
                                    </div>
                                </div>
                                <dl className="grid grid-cols-1 gap-y-4">
                                    <InfoField icon={faAlignLeft} label="Justificativa" value={pedido.justificativa} />
                                    <InfoField icon={faAlignLeft} label="Observações do Solicitante" value={pedido.observacoes} />
                                    <InfoField icon={faBuilding} label="Empreendimento" value={pedido.empreendimentos?.nome} />
                                    <InfoField icon={faUser} label="Solicitante" value={pedido.solicitante?.nome} />
                                    <div>
                                        <dt className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={faClipboardList} /> Status</dt>
                                        <dd className="mt-1 text-sm font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded-full inline-block">{pedido.status}</dd>
                                    </div>
                                </dl>
                            </section>
                        )}

                        <section className="border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faCalendarAlt} /> Datas e Prazos</h4>
                            <dl className="grid grid-cols-2 gap-4">
                                <InfoField label="Data da Solicitação" value={formatDate(pedido.data_solicitacao)} />
                                <InfoField label="Entrega Prevista" value={formatDate(pedido.data_entrega_prevista)} />
                                <InfoField label="Turno de Entrega" value={pedido.turno_entrega || 'N/A'} />
                            </dl>
                        </section>

                        <section className="border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faDollarSign} /> Valores</h4>
                             <div className="flex flex-col space-y-1">
                                 <p className="text-xs text-gray-500">Valor Estimado: <span className="text-base font-semibold text-gray-800">{formatCurrency(totalPedidoEstimado)}</span></p>
                                 <p className="text-lg font-bold text-green-700">Valor Real: {formatCurrency(totalPedidoReal)}</p>
                             </div>
                        </section>

                         {/* =================================================================================
                         * BOTÃO DE AÇÃO FINANCEIRA ATUALIZADO
                         * ================================================================================= */}
                         {['Entregue', 'Realizado'].includes(pedido.status) && totalPedidoReal > 0 && (
                            <section className="border-t pt-4">
                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faHandHoldingDollar} />
                                    Ações Financeiras
                                </h4>
                                <button
                                    onClick={handleOpenLancamentoModal}
                                    disabled={jaLancado}
                                    className={`
                                        w-full text-white px-4 py-2 rounded-md shadow-sm flex items-center justify-center gap-2
                                        ${jaLancado 
                                            ? 'bg-gray-400 cursor-not-allowed' 
                                            : 'bg-green-600 hover:bg-green-700'
                                        }
                                    `}
                                >
                                    <FontAwesomeIcon icon={jaLancado ? faCheckCircle : faHandHoldingDollar} />
                                    {jaLancado ? 'Pagamento Planejado' : 'Planejar Pagamento'}
                                </button>
                                {jaLancado && (
                                    <p className="text-xs text-center text-gray-500 mt-2">
                                        Este pedido já foi lançado no financeiro.
                                    </p>
                                )}
                            </section>
                         )}

                        <section className="border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faPaperclip} /> Itens do Pedido ({pedido.itens?.length || 0})</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                {pedido.itens && pedido.itens.length > 0 ? (
                                    pedido.itens.map(item => (
                                        <div key={item.id} className="p-2 bg-white rounded-md text-sm border">
                                            <p className="font-semibold">{item.descricao_item}</p>
                                            {item.fornecedor && <p className="text-xs text-gray-500">Fornecedor: <span className="font-medium text-gray-700">{item.fornecedor.nome || item.fornecedor.razao_social}</span></p>}
                                            {item.etapa && <p className="text-xs text-gray-500">Etapa: <span className="font-medium text-gray-700">{item.etapa.nome}</span></p>}
                                            <p className="text-xs text-gray-600 mt-1">{item.quantidade_solicitada} {item.unidade_medida}{item.preco_unitario_real ? ` x ${formatCurrency(item.preco_unitario_real)} = ` : ' (aguardando preço)'}{item.custo_total_real ? <span className="font-bold">{formatCurrency(item.custo_total_real)}</span> : ''}</p>
                                        </div>
                                    ))
                                ) : <p className="text-xs text-gray-500 text-center py-4">Nenhum item adicionado.</p>}
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </>
    );
}