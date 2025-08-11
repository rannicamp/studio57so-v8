"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../utils/supabase/client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import ContratoManager from '../../../../components/contratos/ContratoManager'; // Vamos criar este componente a seguir

export default function ContratoPage() {
    const params = useParams();
    const router = useRouter();
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
                contato:contato_id (*, telefones(telefone), emails(email)),
                produto:produto_id (*),
                empreendimento:empreendimento_id (nome)
            `)
            .eq('id', params.id)
            .single();

        if (error) {
            console.error("Erro ao buscar dados do contrato:", error);
            setError('Não foi possível carregar os dados do contrato.');
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

    if (error) {
        return <p className="text-center text-red-500 p-10">{error}</p>;
    }

    return (
        <div className="space-y-6">
            <Link href="/crm" className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2 font-semibold">
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para o Funil
            </Link>
            
            {contrato ? (
                <ContratoManager initialContratoData={contrato} />
            ) : (
                <p>Contrato não encontrado.</p>
            )}
        </div>
    );
}