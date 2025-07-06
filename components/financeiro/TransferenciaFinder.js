"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExchangeAlt, faEye } from '@fortawesome/free-solid-svg-icons';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR') : 'N/A';

export default function TransferenciaFinder() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [possibleTransfers, setPossibleTransfers] = useState([]);
    const [message, setMessage] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);

    useEffect(() => {
        const findTransfers = async () => {
            setLoading(true);
            setMessage('');
            const { data, error } = await supabase
                .from('lancamentos')
                .select('*, conta:conta_id(nome)')
                .in('tipo', ['Receita', 'Despesa'])
                .order('data_transacao', { ascending: false });

            if (error) {
                setMessage('Erro ao buscar lançamentos: ' + error.message);
                setLoading(false);
                return;
            }

            const groups = new Map();
            data.forEach(lancamento => {
                const key = `${lancamento.data_transacao}_${Math.abs(lancamento.valor).toFixed(2)}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(lancamento);
            });

            const potentialGroups = [];
            groups.forEach((lancamentosDoGrupo, key) => {
                const contasUnicas = new Set(lancamentosDoGrupo.map(l => l.conta_id));
                if (lancamentosDoGrupo.length > 1 && contasUnicas.size > 1) {
                    potentialGroups.push({
                        key,
                        data: lancamentosDoGrupo[0].data_transacao,
                        valor: Math.abs(lancamentosDoGrupo[0].valor),
                        lancamentos: lancamentosDoGrupo
                    });
                }
            });

            setPossibleTransfers(potentialGroups);
            setLoading(false);
        };

        findTransfers();
    }, [supabase]);

    const handleViewDetails = (group) => {
        setSelectedGroup(group);
    }

    if (loading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando e analisando lançamentos...</div>;
    }

    return (
        <div className="space-y-6">
            {message && <p className="text-center font-semibold text-red-600">{message}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-lg max-h-[70vh] overflow-y-auto">
                    <div className="sticky top-0 bg-gray-100 p-4 border-b">
                        <h3 className="font-bold text-lg uppercase">Grupos Suspeitos ({possibleTransfers.length})</h3>
                        <p className="text-xs text-gray-600">Grupos de lançamentos com mesmo valor e data em contas diferentes.</p>
                    </div>
                    {possibleTransfers.length === 0 ? (
                        <p className="p-6 text-center text-gray-500">Nenhuma possível transferência encontrada.</p>
                    ) : (
                        possibleTransfers.map(group => (
                            <div key={group.key} onClick={() => handleViewDetails(group)} className={`p-4 border-b cursor-pointer hover:bg-blue-50 ${selectedGroup?.key === group.key ? 'bg-blue-100' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{formatDate(group.data)}</p>
                                        <p className="font-bold text-xl">{formatCurrency(group.valor)}</p>
                                    </div>
                                    <span className="text-sm bg-gray-200 px-2 py-1 rounded-full">{group.lancamentos.length} Lanç.</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                <div className="border rounded-lg bg-gray-50">
                     <div className="sticky top-0 bg-gray-100 p-4 border-b">
                        <h3 className="font-bold text-lg uppercase">Detalhes do Grupo Selecionado</h3>
                     </div>
                    {selectedGroup ? (
                        <div className="p-4 space-y-3">
                           {selectedGroup.lancamentos.map(lancamento => (
                               <div key={lancamento.id} className={`p-3 rounded-md border-l-4 ${lancamento.tipo === 'Receita' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                                   <p className="font-bold">{lancamento.descricao}</p>
                                   <p className="text-sm"><span className="font-semibold">Conta:</span> {lancamento.conta.nome}</p>
                                   <p className="text-sm"><span className="font-semibold">Tipo:</span> {lancamento.tipo}</p>
                                   <p className="text-sm"><span className="font-semibold">Valor:</span> {formatCurrency(lancamento.valor)}</p>
                               </div>
                           ))}
                        </div>
                    ) : (
                        <p className="p-6 text-center text-gray-500">Selecione um grupo à esquerda para ver os detalhes.</p>
                    )}
                </div>
            </div>
        </div>
    );
}