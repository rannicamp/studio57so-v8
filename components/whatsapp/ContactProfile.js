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

// O PORQUÊ: Esta função foi adaptada para buscar DADOS COMPLETOS.
// 1. Busca dados cadastrais na tabela 'contatos' (CPF, Email, etc).
// 2. Busca dados de funil, notas, atividades e simulações.
const fetchContactProfileData = async (supabase, contatoId, organizacaoId) => {
    if (!contatoId || !organizacaoId) return null;

    // Passo 0: Buscar dados cadastrais completos do contato
    const { data: contactDetails, error: contactError } = await supabase
        .from('contatos')
        .select('*')
        .eq('id', contatoId)
        .single();

    // Passo 1: Encontrar o registro do contato no funil
    const { data: funilEntryData, error: funilError } = await supabase
        .from('contatos_no_funil')
        .select('id, corretores:corretor_id(id, nome, razao_social)')
        .eq('contato_id', contatoId)
        .single();

    if (funilError && !funilEntryData) {
        console.warn("Contato não encontrado no funil (apenas cadastral).");
    }
    
    const funilEntryId = funilEntryData?.id;

    // Passo 2: Buscar as demais informações
    const notesPromise = supabase.from('crm_notas').select('*, usuarios(nome, sobrenome)').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });
    const activitiesPromise = supabase.from('activities').select('*').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('data_inicio_prevista', { ascending: true });
    const simulationsPromise = supabase.from('simulacoes').select('id, created_at, status, valor_venda').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });
    
    // Histórico apenas se estiver no funil
    const historyPromise = funilEntryId 
        ? supabase.from('historico_movimentacao_funil').select('*, coluna_anterior:coluna_anterior_id(nome), coluna_nova:coluna_nova_id(nome), usuario:usuario_id(nome, sobrenome)').eq('contato_no_funil_id', funilEntryId).eq('organizacao_id', organizacaoId).order('data_movimentacao', { ascending: false })
        : Promise.resolve({ data: [], error: null });

    const [
        { data: notesData }, 
        { data: activitiesData }, 
        { data: simulationsData },
        { data: historyData }
    ] = await Promise.all([notesPromise, activitiesPromise, simulationsPromise, historyPromise]);

    return { 
        contactDetails: contactDetails || {}, // Dados ricos do contato
        corretor: funilEntryData?.corretores,
        notes: notesData || [], 
        activities: activitiesData || [], 
        simulations: simulationsData || [],
        history: historyData || []
    };
};

const InfoField = ({ label, value, icon }) => (
    <div className="mb-2">
        <dt className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={icon} className="w-3 h-3"/>{label}</dt>
        <dd className="mt-1 text-sm text-gray-900 break-words">{value || <span className="text-gray-400 italic">Não informado</span>}</dd>
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
    
    const { notes = [], activities = [], simulations = [], history = [], corretor, contactDetails } = profileData || {};

    // Mescla os dados básicos da conversa com os dados detalhados do banco
    // Prioriza o que veio do banco (contactDetails)
    const displayContact = { ...contact, ...contactDetails };

    if (!contact) {
        return <div className="p-4 text-center text-sm text-gray-500">Selecione uma conversa para ver o perfil.</div>;
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2 text-[#00a884]"/><p>Carregando perfil...</p></div>;
    }

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200">
            <main className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                
                {/* Cabeçalho do Perfil */}
                <div className="flex flex-col items-center pb-4 border-b">
                    <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-3xl font-bold text-white overflow-hidden mb-3 shadow-sm">
                        {displayContact.foto_url ? (
                            <img src={displayContact.foto_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            (displayContact.nome || '?').charAt(0).toUpperCase()
                        )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 text-center">{displayContact.nome}</h3>
                    <p className="text-sm text-gray-500">{displayContact.telefone || displayContact.phone_number}</p>
                </div>

                <section>
                    <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Dados Cadastrais</h4>
                    <dl className="grid grid-cols-1 gap-y-2 bg-gray-50 p-3 rounded-lg border">
                        <InfoField label="Email" value={displayContact.email} icon={faEnvelope} />
                        <InfoField label="CPF/CNPJ" value={displayContact.cpf || displayContact.cnpj} icon={faIdCard} />
                        <InfoField label="Origem" value={displayContact.origem} icon={faGlobe} />
                        <InfoField label="Corretor" value={corretor?.nome || 'Sem corretor'} icon={faUserTie} />
                    </dl>
                </section>

                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide"><FontAwesomeIcon icon={faCalculator} /> Simulações</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-gray-50 custom-scrollbar">
                        {simulations.length > 0 ? (
                            simulations.map(sim => (
                                <div key={sim.id} className="p-3 bg-white rounded border flex justify-between items-center group hover:shadow-sm transition-shadow">
                                    <div>
                                        <p className="font-semibold text-sm text-gray-800">Proposta #{sim.id.toString().slice(-4)}</p>
                                        <p className="text-xs text-gray-500">{format(new Date(sim.created_at), 'dd/MM/yyyy')}</p>
                                    </div>
                                    <Link href={`/simulador-financiamento/${sim.id}`} target="_blank" rel="noopener noreferrer" className="text-[#00a884] hover:text-[#008f6f] text-xs font-semibold border border-[#00a884] px-2 py-1 rounded hover:bg-[#00a884] hover:text-white transition-colors">
                                        <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-1"/> Abrir
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-400 text-center py-4 italic">Nenhuma simulação encontrada.</p>
                        )}
                    </div>
                </section>

                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide"><FontAwesomeIcon icon={faTasks} /> Atividades</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-gray-50 custom-scrollbar">
                        {activities.length > 0 ? activities.map(act => (
                            <div key={act.id} className="p-3 bg-white rounded border border-l-4 border-l-blue-400">
                                <p className="font-semibold text-sm text-gray-800">{act.nome}</p>
                                <div className="flex justify-between mt-1">
                                    <p className="text-xs text-gray-500">Prazo: {act.data_fim_prevista ? format(new Date(act.data_fim_prevista), 'dd/MM') : 'S/D'}</p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${act.status === 'Concluído' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{act.status}</span>
                                </div>
                            </div>
                        )) : <p className="text-xs text-gray-400 text-center py-4 italic">Nenhuma atividade pendente.</p>}
                    </div>
                </section>

                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide"><FontAwesomeIcon icon={faStickyNote} /> Notas</h4>
                    <div className="space-y-2 max-h-56 overflow-y-auto border rounded-lg p-2 bg-yellow-50/50 custom-scrollbar">
                        {notes.length > 0 ? notes.map(note => (
                            <div key={note.id} className="bg-yellow-100 p-3 rounded shadow-sm text-sm border border-yellow-200">
                                <p className="text-gray-800 whitespace-pre-wrap">{note.conteudo}</p>
                                <p className="text-[10px] text-gray-500 mt-2 text-right">{note.usuarios?.nome} • {format(new Date(note.created_at), 'dd/MM/yy HH:mm')}</p>
                            </div>
                        )) : <p className="text-xs text-gray-400 text-center py-4 italic">Nenhuma nota registrada.</p>}
                    </div>
                </section>
                
                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide"><FontAwesomeIcon icon={faHistory} /> Histórico</h4>
                    <div className="max-h-56 overflow-y-auto border rounded-lg p-0 bg-gray-50 custom-scrollbar">
                         {history.length > 0 ? (
                             <ul className="divide-y divide-gray-200">
                                 {history.map(item => (
                                     <li key={item.id} className="p-3 hover:bg-gray-100 transition-colors">
                                         <p className="text-xs text-gray-600">
                                             Movido de <strong className="text-gray-800">{item.coluna_anterior?.nome || 'Início'}</strong> para <strong className="text-[#00a884]">{item.coluna_nova?.nome}</strong>
                                         </p>
                                         <p className="text-[10px] text-gray-400 mt-1">
                                             {item.usuario?.nome || 'Sistema'} • {format(new Date(item.data_movimentacao), 'dd/MM HH:mm')}
                                         </p>
                                     </li>
                                 ))}
                             </ul>
                          ) : (
                            <p className="text-xs text-center text-gray-400 py-4 italic">Sem movimentações.</p>
                          )}
                    </div>
                </section>
            </main>
        </div>
    );
}