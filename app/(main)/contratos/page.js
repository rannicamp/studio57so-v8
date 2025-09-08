"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import { useLayout } from '../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFileInvoiceDollar, faStore, faArrowUpRightDots, faCalendarCheck } from '@fortawesome/free-solid-svg-icons';
import ContratoList from '../../../components/contratos/ContratoList';
import KpiCard from '../../../components/KpiCard';

export default function ContratosPage() {
    const { setPageTitle } = useLayout();
    const [contratos, setContratos] = useState([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        console.log("LOG: A página /contratos foi carregada corretamente.");
    }, []);

    const fetchContratos = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('contratos')
            .select(`
                *,
                contato:contato_id ( nome, razao_social ),
                produto:produto_id ( unidade, tipo ),
                empreendimento:empreendimento_id ( nome ),
                corretor:corretor_id ( nome ) 
            `) // Adicionado corretor aqui
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Erro ao buscar contratos:", error);
        } else {
            setContratos(data || []);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        setPageTitle("Gestão de Contratos");
        fetchContratos();
    }, [setPageTitle, fetchContratos]);

    const totalVendido = contratos.reduce((acc, contrato) => acc + (contrato.valor_final_venda || 0), 0);
    const unidadesVendidas = contratos.length;
    const ticketMedio = unidadesVendidas > 0 ? totalVendido / unidadesVendidas : 0;
    
    const ultimaVenda = contratos.length > 0
        ? new Date(Math.max(...contratos.map(c => new Date(c.created_at))))
        : null;

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard 
                    title="Valor Total (VGV)" 
                    value={`R$ ${totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                    icon={faFileInvoiceDollar} 
                />
                <KpiCard 
                    title="Unidades Vendidas" 
                    value={unidadesVendidas} 
                    icon={faStore} 
                />
                <KpiCard 
                    title="Ticket Médio" 
                    value={`R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                    icon={faArrowUpRightDots} 
                />
                <KpiCard 
                    title="Última Venda" 
                    value={ultimaVenda ? new Date(ultimaVenda).toLocaleDateString('pt-BR') : 'N/A'} 
                    icon={faCalendarCheck} 
                />
            </div>

            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Todos os Contratos</h1>
                <Link href="/contratos/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
                    + Novo Contrato
                </Link>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
                <ContratoList initialContratos={contratos} onActionComplete={fetchContratos} />
            </div>
        </div>
    );
}