// app/(main)/funil/page.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import FunilKanban from '@/components/crm/FunilKanban';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function FunilPage() {
    const { setPageTitle } = useLayout();
    const [contatos, setContatos] = useState([]);
    const [statusColumns, setStatusColumns] = useState([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Busca as colunas do funil
            const { data: statusData, error: statusError } = await supabase
                .from('crm_status')
                .select('*')
                .order('ordem', { ascending: true });
            if (statusError) throw statusError;
            setStatusColumns(statusData || []);

            // Busca os contatos do funil
            const { data: contatosData, error: contatosError } = await supabase
                .from('crm_contatos')
                .select(`*, responsavel:id_responsavel (id_usuario, nome_usuario)`);
            if (contatosError) throw contatosError;
            setContatos(contatosData || []);

        } catch (error) {
            console.error('Erro ao carregar dados do funil:', error);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        setPageTitle("Funil de Vendas");
        fetchData();
    }, [setPageTitle, fetchData]);

    const handleStatusChange = async (contatoId, newStatus) => {
        const { error } = await supabase
            .from('crm_contatos')
            .update({ cod_status: newStatus })
            .eq('id', contatoId);
        
        if (error) {
            console.error('Erro ao atualizar status do contato:', error);
            // Poderíamos adicionar um toast de erro aqui
        } else {
            // Atualiza a lista na tela para refletir a mudança
            setContatos(prevContatos => prevContatos.map(c => 
                c.id === contatoId ? { ...c, cod_status: newStatus } : c
            ));
        }
    };

    return (
        <div className="h-full w-full">
            {loading ? (
                <div className="flex justify-center items-center h-full">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                </div>
            ) : (
                <FunilKanban
                    contatos={contatos}
                    statusColumns={statusColumns}
                    onStatusChange={handleStatusChange}
                />
            )}
        </div>
    );
}