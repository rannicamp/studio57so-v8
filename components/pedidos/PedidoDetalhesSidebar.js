// components/pedidos/PedidoDetalhesSidebar.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPenToSquare, faCalendarAlt, faUser, faBuilding, faClipboardList, faAlignLeft, faPaperclip, faSpinner, faDollarSign } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';

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

    if (!open || !pedido) return null;

    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const totalPedido = pedido.itens?.reduce((acc, item) => acc + (item.custo_total_real || 0), 0) || 0;

    const handleEditClick = () => {
        router.push(`/pedidos/${pedido.id}`);
    };

    return (
        <div className={`fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Detalhes do Pedido</h3>
                        <p className="text-xs text-gray-500">ID #{pedido.id}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                            <InfoField label="Data da Solicitação" value={formatDate(pedido.data_solicitacao)} icon={faCalendarAlt} />
                            <InfoField label="Entrega Prevista" value={formatDate(pedido.data_entrega_prevista)} icon={faCalendarAlt} />
                        </dl>
                    </section>
                    
                     <section className="border-t pt-4">
                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faDollarSign} /> Valores</h4>
                         <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPedido)}</p>
                    </section>

                    <section className="border-t pt-4">
                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faPaperclip} /> Itens do Pedido ({pedido.itens?.length || 0})</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2 bg-gray-50">
                            {pedido.itens && pedido.itens.length > 0 ? (
                                pedido.itens.map(item => (
                                    <div key={item.id} className="p-2 bg-white rounded-md text-sm border">
                                        <p className="font-semibold">{item.descricao_item}</p>
                                        <p className="text-xs text-gray-600">
                                            {item.quantidade_solicitada} {item.unidade_medida} x {formatCurrency(item.preco_unitario_real)} = <span className="font-bold">{formatCurrency(item.custo_total_real)}</span>
                                        </p>
                                    </div>
                                ))
                            ) : <p className="text-xs text-gray-500 text-center py-4">Nenhum item adicionado.</p>}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}