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
                // Se o erro for "PGRST116", significa que o contato não foi encontrado
                if (fetchError.code === 'PGRST116') {
                    setError('Contato não encontrado.');
                    setInitialData(null);
                } else {
                    throw fetchError; // Lança outros erros para serem pegos pelo catch
                }
            } else {
                setInitialData(data);
            }
        } catch (err) {
            console.error('Erro ao buscar dados do contato:', err);
            setError('Ocorreu um erro ao carregar os dados do contato.');
            setInitialData(null);
        } finally {
            // **A CORREÇÃO ESTÁ AQUI**: Garante que o "carregando" sempre termine.
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        setPageTitle('Editar Contato');
        if (id) {
            getContato(id);
        }
    }, [id, getContato, setPageTitle]);

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
            {initialData && <ContatoForm initialData={initialData} onActionComplete={() => getContato(id)} />}
        </div>
    );
}