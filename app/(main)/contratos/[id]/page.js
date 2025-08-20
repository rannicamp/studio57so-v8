"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '../../../../utils/supabase/client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import FichaContrato from '../../../../components/contratos/FichaContrato'; // <<< MUDANÇA IMPORTANTE AQUI

export default function ContratoPage() {
    const params = useParams();
    const supabase = createClient();
    
    const [contrato, setContrato] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchContratoData = useCallback(async () => {
        if (!params.id) return;
        setLoading(true);
        
        const { data, error } = await supabase
            .from('contratos')
            .select(`
                *,
                contato:contato_id (*),
                produto:produto_id (*),
                empreendimento:empreendimento_id (nome),
                contrato_parcelas (*),
                contrato_permutas (*)
            `)
            .eq('id', params.id)
            .maybeSingle();

        if (error) {
            console.error("Erro ao buscar dados do contrato:", error);
            setError('Não foi possível carregar os dados do contrato.');
        } else if (!data) {
            setError('Contrato não encontrado.');
        } else {
            setContrato(data);
        }
        setLoading(false);
    }, [params.id, supabase]);

    useEffect(() => {
        fetchContratoData();
    }, [fetchContratoData]);

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
                <p className="mt-2">Carregando dados do contrato...</p>
            </div>
        );
    }

    if (error || !contrato) {
        return <p className="text-center text-red-500 p-10">{error || 'Contrato não encontrado.'}</p>;
    }

    return (
        <div className="space-y-6">
            <Link href="/contratos" className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2 font-semibold">
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para Lista de Contratos
            </Link>
            
            <FichaContrato initialContratoData={contrato} onUpdate={fetchContratoData} />
        </div>
    );
}