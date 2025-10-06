// components/whatsapp/ContactProfile.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faStickyNote, faTasks, faSpinner, faPlus, faPhone, 
    faEnvelope, faIdCard, faGlobe, faPen, faTrash, faCheckCircle, 
    faSave, faBullhorn, faUserTie, faCalculator, faExternalLinkAlt,
    faHistory
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// O PORQUÊ: Esta função foi adaptada do CrmDetalhesSidebar.
// Agora, ela primeiro busca o 'funilEntry' usando o 'contatoId' que recebemos
// da caixa de entrada, para então buscar todas as outras informações relacionadas.
const fetchContactProfileData = async (supabase, contatoId, organizacaoId) => {
    if (!contatoId || !organizacaoId) return null;

    // Passo 1: Encontrar o registro do contato no funil
    const { data: funilEntryData, error: funilError } = await supabase
        .from('contatos_no_funil')
        .select('id, corretores:corretor_id(id, nome, razao_social)')
        .eq('contato_id', contatoId)
        .single();

    if (funilError || !funilEntryData) {
        // Não é um erro fatal, o contato pode não estar no funil ainda.
        console.warn("Contato não encontrado no funil, buscando apenas dados básicos.", funilError?.message);
    }
    
    const funilEntryId = funilEntryData?.id;

    // Passo 2: Buscar as demais informações (notas, atividades, etc.)
    const notesPromise = supabase.from('crm_notas').select('*, usuarios(nome, sobrenome)').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });
    const activitiesPromise = supabase.from('activities').select('*').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('data_inicio_prevista', { ascending: true });
    const simulationsPromise = supabase.from('simulacoes').select('id, created_at, status, valor_venda').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });
    
    // O histórico só é buscado se o contato estiver no funil
    const historyPromise = funilEntryId 
        ? supabase.from('historico_movimentacao_funil').select('*, coluna_anterior:coluna_anterior_id(nome), coluna_nova:coluna_nova_id(nome), usuario:usuario_id(nome, sobrenome)').eq('contato_no_funil_id', funilEntryId).eq('organizacao_id', organizacaoId).order('data_movimentacao', { ascending: false })
        : Promise.resolve({ data: [], error: null });

    const [
        { data: notesData, error: notesError }, 
        { data: activitiesData, error: activitiesError }, 
        { data: simulationsData, error: simulationsError },
        { data: historyData, error: historyError }
    ] = await Promise.all([notesPromise, activitiesPromise, simulationsPromise, historyPromise]);

    if (notesError || activitiesError || simulationsError || historyError) {
        console.error({ notesError, activitiesError, simulationsError, historyError });
        throw new Error("Erro ao carregar detalhes do contato.");
    }

    return { 
        corretor: funilEntryData?.corretores,
        notes: notesData || [], 
        activities: activitiesData || [], 
        simulations: simulationsData || [],
        history: historyData || []
    };
};

const InfoField = ({ label, value, icon }) => (
    <div>
        <dt className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={icon} />{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || 'N/A'}</dd>
    </div>
);

export default function ContactProfile({ contact }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { data: profileData, isLoading } = useQuery({
        queryKey: ['contactProfileData', contact?.contato_id, organizacaoId],
        queryFn: () => fetchContactProfileData(supabase, contact?.contato_id, organizacaoId),
        enabled: !!contact && !!organizacaoId,
    });
    
    const { notes = [], activities = [], simulations = [], history = [], corretor } = profileData || {};

    if (!contact) {
        return <div className="p-4 text-center text-sm text-gray-500">Selecione uma conversa para ver o perfil.</div>;
    }

    if (isLoading) {
        return <div className="p-4 text-center"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <main className="flex-1 overflow-y-auto p-4 space-y-6">
                <section>
                    <h4 className="font-semibold text-gray-700 mb-3">Detalhes do Contato</h4>
                    <dl className="grid grid-cols-1 gap-y-4">
                        <InfoField label="Telefone" value={contact.telefone} icon={faPhone} />
                        <InfoField label="Email" value={contact.email} icon={faEnvelope} />
                        <InfoField label="CPF/CNPJ" value={contact.cpf || contact.cnpj} icon={faIdCard} />
                        <InfoField label="Origem" value={contact.origem} icon={faGlobe} />
                        <InfoField label="Corretor" value={corretor?.nome || 'Não associado'} icon={faUserTie} />
                    </dl>
                </section>

                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faCalculator} /> Simulações</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
                        {simulations.length > 0 ? (
                            simulations.map(sim => (
                                <div key={sim.id} className="p-2 bg-white rounded-md text-sm border flex justify-between items-center group">
                                    <p className="font-semibold">Proposta #{sim.id}</p>
                                    <Link href={`/simulador-financiamento/${sim.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs font-semibold">
                                        <FontAwesomeIcon icon={faExternalLinkAlt} /> Visualizar
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-500 text-center py-4">Nenhuma simulação encontrada.</p>
                        )}
                    </div>
                </section>

                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faTasks} />Atividades</h4>
                     <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
                        {activities.length > 0 ? activities.map(act => (
                            <div key={act.id} className="p-2 bg-white rounded-md text-sm border">
                                <p className="font-semibold">{act.nome}</p>
                                <p className="text-xs text-gray-500">Prazo: {act.data_fim_prevista}</p>
                            </div>
                        )) : <p className="text-xs text-gray-500 text-center py-4">Nenhuma atividade agendada.</p>}
                    </div>
                </section>

                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faStickyNote} />Notas</h4>
                    <div className="space-y-2 max-h-56 overflow-y-auto border rounded-md p-2 bg-gray-50">
                        {notes.length > 0 ? notes.map(note => (
                            <div key={note.id} className="bg-white p-2 rounded border text-sm">
                                <p className="text-gray-800 whitespace-pre-wrap">{note.conteudo}</p>
                                <p className="text-xs text-gray-500 mt-1">{note.usuarios?.nome} - {format(new Date(note.created_at), 'dd/MM/yy', { locale: ptBR })}</p>
                            </div>
                        )) : <p className="text-xs text-gray-500 text-center py-4">Nenhuma nota adicionada.</p>}
                    </div>
                </section>
                
                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faHistory} /> Histórico de Movimentações</h4>
                    <div className="max-h-56 overflow-y-auto border rounded-md p-4 bg-gray-50">
                         {history.length > 0 ? (
                             history.map(item => (
                                 <div key={item.id} className="text-sm py-2 border-b last:border-b-0">
                                     <p className="text-gray-600">
                                         Movido de <strong>{item.coluna_anterior?.nome || 'Início'}</strong> para <strong>{item.coluna_nova?.nome}</strong>
                                     </p>
                                     <p className="text-xs text-gray-500">
                                         por {item.usuario?.nome || 'Sistema'} em {format(new Date(item.data_movimentacao), 'dd/MM/yy HH:mm')}
                                     </p>
                                 </div>
                             ))
                         ) : (
                            <p className="text-xs text-center text-gray-500 py-4">Nenhuma movimentação registrada.</p>
                         )}
                    </div>
                </section>
            </main>
        </div>
    );
}