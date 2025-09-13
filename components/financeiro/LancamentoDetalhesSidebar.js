// components/financeiro/LancamentoDetalhesSidebar.js
"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faStickyNote, faBuilding, faFileInvoice, faCalendarAlt, faDollarSign, 
    faTags, faUser, faLandmark, faFileLines, faEye, faSpinner, faQuestionCircle, 
    faReceipt, faArrowUp, faArrowDown, faCheckCircle, faExclamationTriangle, faClock 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// =================================================================================
// ATUALIZAÇÃO DA REGRA DE DATAS
// O PORQUÊ: Corrigimos esta função para seguir nossa regra de ouro. Agora, ela
// trata a data como texto, dividindo 'YYYY-MM-DD' e remontando como 'DD/MM/YYYY',
// o que elimina completamente o risco de erros de fuso horário.
// =================================================================================
const formatDateString = (dateStr) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Não definido';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const InfoField = ({ label, value, icon, valueClassName = '' }) => (
    <div>
        <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase">
            <FontAwesomeIcon icon={icon} className="w-4" />
            {label}
        </dt>
        <dd className={`mt-1 text-sm text-gray-800 ${valueClassName}`}>{value || 'N/A'}</dd>
    </div>
);

const AnexosSection = ({ anexos }) => {
    const supabase = createClient();
    const [loadingUrl, setLoadingUrl] = useState(null);

    const handleViewAnexo = async (caminho_arquivo) => {
        if (!caminho_arquivo) return;
        setLoadingUrl(caminho_arquivo);
        try {
            const { data, error } = await supabase.storage.from('documentos-financeiro').createSignedUrl(caminho_arquivo, 3600);
            if (error) throw error;
            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank');
            }
        } catch (error) {
            toast.error("Erro ao gerar link do anexo.");
            console.error(error);
        } finally {
            setLoadingUrl(null);
        }
    };

    if (!anexos || anexos.length === 0) {
        return <InfoField label="Anexos" value="Nenhum anexo encontrado." icon={faFileLines} />;
    }

    return (
        <div>
            <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase">
                <FontAwesomeIcon icon={faFileLines} className="w-4" />
                Anexos
            </dt>
            <div className="mt-2 space-y-2">
                {anexos.map(anexo => (
                    <button 
                        key={anexo.id}
                        onClick={() => handleViewAnexo(anexo.caminho_arquivo)}
                        disabled={loadingUrl === anexo.caminho_arquivo}
                        className="w-full flex items-center gap-3 p-2 bg-gray-100 rounded-md hover:bg-gray-200 text-left text-sm"
                    >
                        {loadingUrl === anexo.caminho_arquivo 
                            ? <FontAwesomeIcon icon={faSpinner} spin className="text-gray-500 w-4" />
                            : <FontAwesomeIcon icon={faEye} className="text-gray-500 w-4" />
                        }
                        <div className="flex-1 truncate">
                            <p className="font-semibold text-gray-800">{anexo.nome_arquivo}</p>
                            {anexo.descricao && <p className="text-xs text-gray-600 truncate">{anexo.descricao}</p>}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default function LancamentoDetalhesSidebar({ open, onClose, lancamento }) {

    if (!open || !lancamento) return null;

    const getStatusInfo = (item) => {
        if (item.status === 'Pago' || item.conciliado) return { text: 'Pago', icon: faCheckCircle, className: 'text-green-600' };
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date((item.data_vencimento || item.data_transacao) + 'T00:00:00Z');

        if (dueDate < today) return { text: 'Atrasado', icon: faExclamationTriangle, className: 'text-red-600' };
        return { text: 'Pendente', icon: faClock, className: 'text-yellow-600' };
    };

    const statusInfo = getStatusInfo(lancamento);
    const tipoInfo = lancamento.tipo === 'Receita' 
        ? { icon: faArrowUp, className: 'text-green-600' } 
        : { icon: faArrowDown, className: 'text-red-600' };

    return (
        <div 
            className="fixed top-0 right-0 h-full w-full md:w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out"
            style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
        >
            <div className="flex flex-col h-full">
                <header className="p-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <div className='flex-1 overflow-hidden'>
                        <h3 className="text-base font-bold text-gray-800 truncate" title={lancamento.descricao}>{lancamento.descricao}</h3>
                        <p className="text-xs text-gray-500">ID: {lancamento.id}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 ml-4"><FontAwesomeIcon icon={faTimes} /></button>
                </header>
                
                <main className="flex-1 overflow-y-auto p-4 space-y-6">
                    <section>
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                           <div className="md:col-span-2">
                                <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase">
                                    <FontAwesomeIcon icon={faDollarSign} className="w-4" />
                                    Valor
                                </dt>
                                <dd className={`mt-1 text-2xl font-bold ${tipoInfo.className}`}>
                                    {formatCurrency(lancamento.valor)}
                                </dd>
                           </div>

                            <InfoField label="Tipo" value={lancamento.tipo} icon={tipoInfo.icon} valueClassName={tipoInfo.className} />
                            <InfoField label="Status" value={statusInfo.text} icon={statusInfo.icon} valueClassName={statusInfo.className} />
                            <InfoField label="Data de Vencimento" value={formatDateString(lancamento.data_vencimento)} icon={faCalendarAlt} />
                            <InfoField label="Data de Pagamento" value={formatDateString(lancamento.data_pagamento)} icon={faCalendarAlt} />
                            <InfoField label="Conta" value={lancamento.conta?.nome} icon={faFileInvoice} />
                            <InfoField label="Categoria" value={lancamento.categoria?.nome} icon={faTags} />
                            <div className="md:col-span-2">
                                <InfoField label="Favorecido" value={lancamento.favorecido?.nome || lancamento.favorecido?.razao_social} icon={faUser} />
                            </div>
                            <InfoField label="Empresa" value={lancamento.conta?.empresa?.nome_fantasia || lancamento.conta?.empresa?.razao_social} icon={faBuilding} />
                            <InfoField label="Empreendimento" value={lancamento.empreendimento?.nome} icon={faLandmark} />
                            <div className="md:col-span-2">
                                <InfoField label="Observações" value={lancamento.observacao} icon={faStickyNote} />
                            </div>
                        </dl>
                    </section>

                    <section className="pt-4 border-t">
                        <AnexosSection anexos={lancamento.anexos} />
                    </section>
                </main>
            </div>
        </div>
    );
}