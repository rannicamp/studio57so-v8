"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPenToSquare, faCalendarAlt, faUser, faBuilding, faClipboardList, faAlignLeft, faPaperclip, faSpinner, faDollarSign, faTruck, faHandHoldingDollar } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import LancamentoFormModal from '../financeiro/LancamentoFormModal';

const InfoField = ({ icon, label, value }) => {
    if (!value && value !== 0) return null; // Permite exibir 0
    return (
        <div>
            <dt className="text-xs font-medium text-gray-500 flex items-center gap-2">
                <FontAwesomeIcon icon={icon} className="w-3 h-3" />
                {label}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{value}</dd>
        </div>
    );
};

export default function PedidoDetalhesSidebar({ isOpen, onClose, pedido, onUpdate }) {
    const router = useRouter();
    const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
    const [lancamentoInitialData, setLancamentoInitialData] = useState(null);

    if (!isOpen || !pedido) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            // Se for timestamp completo (com T e Z ou offset)
            if (dateStr.includes('T') && (dateStr.includes('Z') || dateStr.match(/[+-]\d{2}:\d{2}$/))) {
                const date = new Date(dateStr);
                 // Adiciona verificação para data inválida
                if (isNaN(date.getTime())) return 'Data inválida';
                return date.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    timeZone: 'UTC' // Importante para evitar problemas de fuso
                });
            }
            // Se for apenas YYYY-MM-DD
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                 const [year, month, day] = parts;
                 // Verifica se são números válidos
                 if (!isNaN(parseInt(year)) && !isNaN(parseInt(month)) && !isNaN(parseInt(day))) {
                     return `${day}/${month}/${year}`;
                 }
            }
            // Se não for nenhum dos formatos esperados, retorna a string original
            return dateStr;
        } catch (error) {
            console.error("Erro ao formatar data:", dateStr, error);
            return 'Erro na data';
        }
    };

    const formatCurrency = (value) => {
         if (value === null || value === undefined || isNaN(Number(value))) {
             return 'R$ 0,00'; // Ou 'N/A', dependendo do contexto
         }
         return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
     };


    // Calcula o total real (baseado no preço real)
     const totalPedidoReal = pedido.itens?.reduce((acc, item) => acc + (Number(item.custo_total_real) || 0), 0) || 0;

    // Calcula o total estimado (baseado no preço estimado, se houver, senão usa o real)
    const totalPedidoEstimado = pedido.itens?.reduce((acc, item) => {
        const valorEstimado = Number(item.custo_total_estimado) || Number(item.custo_total_real) || 0;
        return acc + valorEstimado;
    }, 0) || 0;


    const handleEditClick = () => {
        router.push(`/pedidos/${pedido.id}`);
    };

    const handleOpenLancamentoModal = () => {
        if (!pedido.itens || pedido.itens.length === 0) {
            toast.error("Adicione itens ao pedido antes de planejar um pagamento.");
            return;
        }

         // Usa o total REAL para o lançamento
        const totalPedidoValor = pedido.itens.reduce((acc, item) => acc + (parseFloat(item.custo_total_real) || 0), 0);

        if (totalPedidoValor <= 0) {
            toast.error("O valor total do pedido (real) deve ser maior que zero para planejar um pagamento.");
            return;
        }

        const firstFornecedorId = pedido.itens[0].fornecedor_id;
        const allSameFornecedor = pedido.itens.every(item => item.fornecedor_id === firstFornecedorId);

        const notaFiscalAnexo = pedido.anexos?.find(a => a.descricao && a.descricao.toLowerCase().includes('nota fiscal'));

        let etapaObraId = null;
        if (pedido.itens.length > 0) {
            const firstEtapaId = pedido.itens[0].etapa_id;
            // Garante que todas as etapas sejam iguais E que a primeira etapa exista
            if (firstEtapaId && pedido.itens.every(item => item.etapa_id === firstEtapaId)) {
                etapaObraId = firstEtapaId;
            }
        }

        // ***** INÍCIO DA CORREÇÃO *****
        // O 'porquê': Usa 'empresa_proprietaria_id' que agora é buscado na query principal.
        const empresaIdCorreta = pedido.empreendimentos?.empresa_proprietaria_id || null;
        // ***** FIM DA CORREÇÃO *****

        const initial = {
            descricao: `Pagamento Ref. Pedido de Compra #${pedido.id} - ${pedido.titulo || ''}`.trim(),
            valor: totalPedidoValor.toFixed(2),
            data_vencimento: new Date().toISOString().split('T')[0], // Sugere data atual
            tipo: 'Despesa',
            status: 'Pendente',
            favorecido_contato_id: allSameFornecedor ? firstFornecedorId : null,
            empreendimento_id: pedido.empreendimento_id,
            empresa_id: empresaIdCorreta, // Usa a variável corrigida
            etapa_obra_id: etapaObraId,
            anexo_preexistente: notaFiscalAnexo ? {
                caminho_arquivo: notaFiscalAnexo.caminho_arquivo,
                nome_arquivo: notaFiscalAnexo.nome_arquivo,
                descricao: notaFiscalAnexo.descricao,
            } : null,
            // Adiciona o ID do pedido ao lançamento para referência futura, se necessário
             pedido_compra_id: pedido.id
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
                    if (onUpdate) onUpdate(); // Atualiza a lista/kanban
                }}
                initialData={lancamentoInitialData}
            />

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

                         {/* Apenas mostra o botão se o status permitir e tiver valor real > 0 */}
                         {['Entregue', 'Realizado'].includes(pedido.status) && totalPedidoReal > 0 && (
                            <section className="border-t pt-4">
                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faHandHoldingDollar} />
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
                         )}

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
                                            {item.etapa && (
                                                <p className="text-xs text-gray-500">
                                                    Etapa: <span className="font-medium text-gray-700">{item.etapa.nome}</span>
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-600 mt-1">
                                                 {item.quantidade_solicitada} {item.unidade_medida}
                                                 {item.preco_unitario_real ? ` x ${formatCurrency(item.preco_unitario_real)} = ` : ' (aguardando preço)'}
                                                 {item.custo_total_real ? <span className="font-bold">{formatCurrency(item.custo_total_real)}</span> : ''}
                                            </p>
                                            {item.custo_total_estimado && item.custo_total_real !== item.custo_total_estimado && (
                                                <p className="text-xs text-gray-500 italic"> (Estimado: {formatCurrency(item.custo_total_estimado)}) </p>
                                            )}
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