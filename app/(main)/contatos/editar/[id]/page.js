// app/(main)/contatos/editar/[id]/page.js
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../../utils/supabase/client';
import ContatoForm from '../../../../../components/ContatoForm';
import { useLayout } from '../../../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function EditarContatoPage() {
    const { setPageTitle } = useLayout();
    const router = useRouter();
    const { id } = useParams();
    
    const [initialData, setInitialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const supabase = createClient();

    const getContato = useCallback(async (contatoId) => {
        setLoading(true);
        setError('');
        try {
            const { data, error: fetchError } = await supabase
                .from('contatos')
                .select(`
                    *,
                    telefones(*),
                    emails(*)
                `)
                .eq('id', contatoId)
                .single();

            if (fetchError) {
                // ADIÇÃO CRÍTICA AQUI: Logar o erro detalhado do fetchError
                console.error("Erro detalhado do Supabase ao buscar contato:", fetchError); 

                if (fetchError.code === 'PGRST116') {
                    setError('Contato não encontrado.');
                    setInitialData(null);
                } else {
                    // Use a mensagem de erro do Supabase se ela for amigável
                    setError(`Ocorreu um erro ao carregar os dados do contato: ${fetchError.message || 'Erro desconhecido.'}`);
                    setInitialData(null);
                }
            } else {
                setInitialData(data);
            }
        } catch (err) {
            console.error('Erro inesperado ao buscar dados do contato:', err);
            setError('Ocorreu um erro ao carregar os dados do contato. (Erro interno)');
            setInitialData(null);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        setPageTitle('Editar Contato');
        if (id) {
            getContato(id);
        }
    }, [id, getContato, setPageTitle]);

    const handleSaveSuccess = () => {
        router.push('/contatos');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <span className="ml-4 text-lg">Carregando Contato...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <h2 className="text-2xl font-bold text-red-600">Erro</h2>
                <p className="mt-2 text-red-700">{error}</p>
                <button 
                    onClick={() => router.push('/contatos')}
                    className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700"
                >
                    Voltar para Contatos
                </button>
            </div>
        );
    }

    return (
        <div>
            {initialData && <ContatoForm contactToEdit={initialData} onSaveSuccess={handleSaveSuccess} onClose={handleSaveSuccess} />}
            {!initialData && !loading && !error && (
                <div className="text-center p-10 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h2 className="text-2xl font-bold text-yellow-600">Nenhum contato para editar.</h2>
                    <button 
                        onClick={() => router.push('/contatos')}
                        className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700"
                    >
                        Voltar para Contatos
                    </button>
                </div>
            )}
        </div>
    );
}