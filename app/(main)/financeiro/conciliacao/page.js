// app/(main)/financeiro/conciliacao/page.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../../../utils/supabase/client';
import Link from 'next/link';
import ConciliacaoManager from '../../../../components/financeiro/ConciliacaoManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function ConciliacaoPage() {
    const supabase = createClient();
    const [contas, setContas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContas = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('contas_financeiras')
                .select('id, nome')
                .order('nome');

            if (error) {
                console.error("Erro ao buscar contas:", error);
            } else {
                setContas(data || []);
            }
            setLoading(false);
        };
        fetchContas();
    }, [supabase]);

    return (
        <div className="space-y-6">
            <Link href="/financeiro" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para o Painel Financeiro
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 uppercase">Conciliação Bancária</h1>
            <p className="text-gray-600">
                Importe seu extrato bancário em formato OFX e concilie automaticamente com os lançamentos do sistema.
            </p>
            <div className="bg-white rounded-lg shadow-lg p-6 mt-4">
                {loading ? (
                    <div className="text-center p-10">
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                        <p className="mt-2">Carregando contas...</p>
                    </div>
                ) : (
                    <ConciliacaoManager contas={contas} />
                )}
            </div>
        </div>
    );
}