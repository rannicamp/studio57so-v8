// Este é um novo arquivo que você precisa criar.
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import { useLayout } from '../../../contexts/LayoutContext';
import WhatsAppChatManager from '../../../components/WhatsAppChatManager'; // Nosso novo componente
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function WhatsAppPage() {
    const { setPageTitle } = useLayout();
    const [contatos, setContatos] = useState([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    // Função para buscar contatos que têm pelo menos um telefone
    const getContatosComTelefone = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('contatos')
            .select('*, telefones!inner(telefone)') // !inner garante que só virão contatos que têm telefone
            .order('nome');

        if (error) {
            console.error("Erro ao buscar contatos com telefone:", error);
        } else {
            setContatos(data || []);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        setPageTitle('WhatsApp Chat');
        getContatosComTelefone();
    }, [setPageTitle, getContatosComTelefone]);

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
                <p className="mt-3 text-gray-600">Carregando contatos...</p>
            </div>
        )
    }

    return (
        <div>
            <WhatsAppChatManager contatos={contatos} />
        </div>
    );
}