"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import { useLayout } from '../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
// Este será nosso novo componente de lista, que criaremos a seguir
import ContratoList from '../../../components/contratos/ContratoList';

export default function ContratosPage() {
    const { setPageTitle } = useLayout();
    const [contratos, setContratos] = useState([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchContratos = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('contratos')
            .select(`
                *,
                contato:contato_id ( nome, razao_social ),
                produto:produto_id ( unidade, tipo ),
                empreendimento:empreendimento_id ( nome )
            `)
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

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Todos os Contratos</h1>
                {/* --- ALTERAÇÃO AQUI --- */}
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