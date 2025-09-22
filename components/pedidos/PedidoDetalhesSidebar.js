//components\pedidos\PedidoDetalhesSidebar.js
"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPenToSquare, faCalendarAlt, faUser, faBuilding, faClipboardList, faAlignLeft, faPaperclip, faSpinner, faDollarSign, faTruck, faHandHoldingDollar } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import LancamentoFormModal from '../financeiro/LancamentoFormModal';

const InfoField = ({ icon, label, value }) => {
    if (!value) return null;
    return (
        <div>
            <dt className="text-xs font-medium text-gray-500 flex items-center gap-2">
                <FontAwesomeIcon icon={icon} />
                {label}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{value}</dd>
        </div>
    );
};

export default function PedidoDetalhesSidebar({ open, onClose, pedido, onUpdate }) {
    const router = useRouter();
    const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
    const [lancamentoInitialData, setLancamentoInitialData] = useState(null);

    if (!open || !pedido) return null;

    // ***** INÍCIO DA CORREÇÃO *****
    // Função atualizada para lidar com datas completas (com hora) e datas simples.
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';

        // Se a data incluir 'T', é um timestamp completo (com hora e fuso)
        if (dateStr.includes('T')) {
            const date = new Date(dateStr);
            // Usamos toLocaleDateString para garantir a formatação correta sem problemas de fuso horário
            return date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                timeZone: 'UTC' // Usar UTC para evitar que a data mude para o dia anterior
            });
        }

        // Se for uma data simples (YYYY-MM-DD), usamos a lógica antiga
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const [year, month, day] = parts;
            return `${day}/${month}/${year}`;
        }

        // Se o formato for inesperado, retorna a string original
        return dateStr;
    };
    // ***** FIM DA CORREÇÃO *****
    
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const totalPedido = pedido.itens?.reduce((acc, item) => acc + (item.custo_total_real || 0), 0) || 0;

    const handleEditClick = () => {
        router.push(`/pedidos/${pedido.id}`);
    };

    const handleOpenLancamentoModal = () => {
        if (!pedido.itens || pedido.itens.length === 0) {
            toast.error("Adicione itens ao pedido antes de planejar um pagamento.");
            return;
        }

        const totalPedidoValor = pedido.itens.reduce((acc, item) => acc + (parseFloat(item.custo_total_real) || 0), 0);
        
        const firstFornecedorId = pedido.itens[0].fornecedor_id;
        const allSameFornecedor = pedido.itens.every(item => item.fornecedor_id === firstFornecedorId);
        
        const notaFiscalAnexo = pedido.anexos.find(a => a.descricao && a.descricao.toLowerCase().includes('nota fiscal'));
        
        let etapaObraId = null;
        if (pedido.itens.length > 0) {
            const firstEtapaId = pedido.itens[0].etapa_id;
            if (firstEtapaId && pedido.itens.every(item => item.etapa_id === firstEtapaId)) {
                etapaObraId = firstEtapaId;
            }
        }

        const initial = {
            descricao: `Pagamento Ref. Pedido de Compra #${pedido.id} - ${pedido.titulo || ''}`.trim(),
            valor: totalPedidoValor.toFixed(2),
            data_vencimento: new Date().toISOString().split('T')[0],
            tipo: 'Despesa',
            status: 'Pendente',
            favorecido_contato_id: allSameFornecedor ? firstFornecedorId : null,
            empreendimento_id: pedido.empreendimento_id,
            empresa_id: pedido.empreendimentos?.empresa_id || null,
            etapa_obra_id: etapaObraId,
            anexo_preexistente: notaFiscalAnexo ? {
                caminho_arquivo: notaFiscalAnexo.caminho_arquivo,
                nome_arquivo: notaFiscalAnexo.nome_arquivo,
                descricao: notaFiscalAnexo.descricao,
            } : null,
        };
        
        setLancamentoInitialData(initial);
        setIsLancamentoModalOpen(true);
    };

    return (
        <>
            <LancamentoFormModal 
                isOpen={isLancamentoModalOpen}
                onClose={() => setIsLancamentoModalOpen(false)}
                onSuccess={() => {
                    toast.success("Planejamento de pagamento registrado com sucesso!");
                    setIsLancamentoModalOpen(false);
                    if (onUpdate) onUpdate();
                }}
                initialData={lancamentoInitialData}
            />

            <div className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <header className="p-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Detalhes do Pedido</h3>
                            <p className="text-xs text-gray-500">ID #{pedido.id}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                    </header>

                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        <section>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-xl font-semibold text-gray-900">{pedido.titulo || `Pedido #${pedido.id}`}</h4>
                                <button onClick={handleEditClick} className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                    <FontAwesomeIcon icon={faPenToSquare} /> Editar Completo
                                </button>
                            </div>
                            <dl className="grid grid-cols-1 gap-y-4">
                                <InfoField icon={faAlignLeft} label="Justificativa" value={pedido.justificativa} />
                                <InfoField icon={faBuilding} label="Empreendimento" value={pedido.empreendimentos?.nome} />
                                <InfoField icon={faUser} label="Solicitante" value={pedido.solicitante?.nome} />
                                <div>
                                    <dt className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={faClipboardList} /> Status</dt>
                                    <dd className="mt-1 text-sm font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded-full inline-block">{pedido.status}</dd>
                                </div>
                            </dl>
                        </section>

                        <section className="border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faCalendarAlt} /> Datas e Prazos</h4>
                            <dl className="grid grid-cols-2 gap-4">
                                <InfoField label="Data da Solicitação" value={formatDate(pedido.data_solicitacao)} />
                                <InfoField label="Entrega Prevista" value={formatDate(pedido.data_entrega_prevista)} />
                            </dl>
                        </section>
                        
                        <section className="border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faDollarSign} /> Valores</h4>
                            <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPedido)}</p>
                        </section>

                        <section className="border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <FontAwesomeIcon icon={faDollarSign} />
                                Ações Financeiras
                            </h4>
                            <button
                                onClick={handleOpenLancamentoModal}
                                className="w-full bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 flex items-center justify-center gap-2"
                            >
                                <FontAwesomeIcon icon={faHandHoldingDollar} />
                                Planejar Pagamento
                            </button>
                        </section>

                        <section className="border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faPaperclip} /> Itens do Pedido ({pedido.itens?.length || 0})</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                {pedido.itens && pedido.itens.length > 0 ? (
                                    pedido.itens.map(item => (
                                        <div key={item.id} className="p-2 bg-white rounded-md text-sm border">
                                            <p className="font-semibold">{item.descricao_item}</p>
                                            {item.fornecedor && (
                                                <p className="text-xs text-gray-500">
                                                    Fornecedor: <span className="font-medium text-gray-700">{item.fornecedor.nome || item.fornecedor.razao_social}</span>
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-600 mt-1">
                                                {item.quantidade_solicitada} {item.unidade_medida} x {formatCurrency(item.preco_unitario_real)} = <span className="font-bold">{formatCurrency(item.custo_total_real)}</span>
                                            </p>
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