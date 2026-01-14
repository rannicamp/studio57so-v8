// components/contatos/ContatoDetalhesSidebar.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
    faUser, faBuilding, faEnvelope, faPhone, faMapMarkerAlt, faCalendarAlt, 
    faEdit, faSpinner, faPlus, faTrash, faIdCard, faBriefcase, faMoneyBillWave
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IMaskInput } from 'react-imask';
import { formatPhoneNumber } from '@/utils/formatters';

// FUNÇÕES AUXILIARES
const formatDateString = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch (error) {
        return dateStr;
    }
};

const formatCurrency = (value) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const InfoRow = ({ icon, label, value }) => (
    value ? (
        <div className="flex items-start text-sm text-gray-700">
            <FontAwesomeIcon icon={icon} className="w-4 mt-1 text-gray-400" />
            <div className="ml-3">
                <p className="font-semibold text-gray-800">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
            </div>
        </div>
    ) : null
);

const EditableArrayField = ({ items, onUpdate, onAdd, onRemove, type, contactId, queryClient }) => {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [editIndex, setEditIndex] = useState(null);
    const [editValue, setEditValue] = useState('');

    const mutation = useMutation({
        mutationFn: async ({ action, payload }) => {
            if (action === 'update') {
                const { error } = await supabase.from(type).update({ [type === 'emails' ? 'email' : 'telefone']: payload.value }).eq('id', payload.id);
                if (error) throw error;
            } else if (action === 'add') {
                const { error } = await supabase.from(type).insert({ 
                    contato_id: contactId, 
                    [type === 'emails' ? 'email' : 'telefone']: payload.value,
                    organizacao_id: organizacaoId 
                });
                if (error) throw error;
            } else if (action === 'delete') {
                const { error } = await supabase.from(type).delete().eq('id', payload.id);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success(`${type === 'emails' ? 'E-mail' : 'Telefone'} salvo com sucesso!`);
            queryClient.invalidateQueries(['contactDetails', contactId]);
            setEditIndex(null);
            setEditValue('');
        },
        onError: (error) => {
            toast.error(`Erro: ${error.message}`);
        }
    });

    const handleSave = (id = null) => {
        if (!editValue.trim()) {
            toast.warning("O campo não pode estar vazio.");
            return;
        }
        const action = id ? 'update' : 'add';
        const payload = id ? { id, value: editValue } : { value: editValue };
        mutation.mutate({ action, payload });
    };

    const handleEnter = (e, id = null) => {
        if (e.key === 'Enter') {
            handleSave(id);
        }
    };

    return (
        <div className="space-y-2">
            {items.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between text-sm group">
                    {editIndex === index ? (
                        <div className="flex-grow">
                            {type === 'telefones' ? (
                                <IMaskInput
                                    mask="(00) 00000-0000"
                                    value={editValue}
                                    onAccept={(value) => setEditValue(value)}
                                    onKeyDown={(e) => handleEnter(e, item.id)}
                                    className="w-full p-1 border rounded"
                                    autoFocus
                                />
                            ) : (
                                <input
                                    type="email"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => handleEnter(e, item.id)}
                                    className="w-full p-1 border rounded"
                                    autoFocus
                                />
                            )}
                        </div>
                    ) : (
                        <span className="text-gray-800">{type === 'telefones' ? formatPhoneNumber(item.telefone) : item.email}</span>
                    )}

                    <div className="flex items-center">
                        {editIndex === index ? (
                            <>
                                <button onClick={() => handleSave(item.id)} className="text-green-500 hover:text-green-700 p-1">Salvar</button>
                                <button onClick={() => setEditIndex(null)} className="text-red-500 hover:text-red-700 p-1">Cancelar</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => { setEditIndex(index); setEditValue(type === 'emails' ? item.email : item.telefone); }} className="text-blue-500 hover:text-blue-700 p-1 opacity-0 group-hover:opacity-100">
                                    <FontAwesomeIcon icon={faEdit} size="xs" />
                                </button>
                                <button onClick={() => mutation.mutate({ action: 'delete', payload: { id: item.id }})} className="text-red-500 hover:text-red-700 p-1 opacity-0 group-hover:opacity-100">
                                    <FontAwesomeIcon icon={faTrash} size="xs" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ))}
            {editIndex === 'new' ? (
                 <div className="flex-grow">
                    {type === 'telefones' ? (
                        <IMaskInput
                            mask="(00) 00000-0000"
                            value={editValue}
                            onAccept={(value) => setEditValue(value)}
                            onKeyDown={handleEnter}
                            className="w-full p-1 border rounded"
                            autoFocus
                            onBlur={() => {setEditIndex(null); setEditValue('');}}
                        />
                    ) : (
                        <input
                            type="email"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleEnter}
                            className="w-full p-1 border rounded"
                            autoFocus
                             onBlur={() => {setEditIndex(null); setEditValue('');}}
                        />
                    )}
                </div>
            ) : (
                 <button onClick={() => setEditIndex('new')} className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 mt-2">
                    <FontAwesomeIcon icon={faPlus} /> Adicionar
                </button>
            )}
        </div>
    );
};


// COMPONENTE PRINCIPAL
export default function ContatoDetalhesSidebar({ contactId, onClose }) {
    const supabase = createClient();
    const queryClient = useQueryClient();

    const fetchContactDetails = async () => {
        const { data, error } = await supabase
            .from('contatos')
            .select(`
                *,
                telefones (id, telefone),
                emails (id, email),
                conjuge:conjuge_id (id, nome, razao_social)
            `)
            .eq('id', contactId)
            .single();
        if (error) throw new Error(error.message);
        return data;
    };

    const { data: contato, isLoading, error } = useQuery({
        queryKey: ['contactDetails', contactId],
        queryFn: fetchContactDetails,
        enabled: !!contactId,
    });

    const isPessoaFisica = contato?.personalidade_juridica === 'Pessoa Física';
    
    return (
        <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out" style={{ transform: contactId ? 'translateX(0)' : 'translateX(100%)' }}>
            <div className="flex flex-col h-full">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Detalhes do Contato</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading && <div className="text-center"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>}
                    {error && <div className="text-center text-red-500">Erro ao carregar contato: {error.message}</div>}
                    {contato && (
                        <div className="space-y-6">
                            <div className="flex items-center">
                                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                                    {isPessoaFisica ? contato.nome?.charAt(0) : contato.razao_social?.charAt(0)}
                                </div>
                                <div className="ml-4">
                                    <h3 className="text-2xl font-bold text-gray-900 leading-tight">{isPessoaFisica ? contato.nome : contato.razao_social}</h3>
                                    <p className="text-sm text-gray-500">{isPessoaFisica ? contato.cargo : contato.nome_fantasia}</p>
                                    
                                    {/* MUDANÇA AQUI: Renda familiar logo abaixo do nome */}
                                    {contato.renda_familiar && (
                                        <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                                            <FontAwesomeIcon icon={faMoneyBillWave} className="mr-1" />
                                            {formatCurrency(contato.renda_familiar)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-semibold text-gray-600">Informações Principais</h4>
                                <InfoRow icon={isPessoaFisica ? faIdCard : faBuilding} label={isPessoaFisica ? "CPF" : "CNPJ"} value={isPessoaFisica ? contato.cpf : contato.cnpj} />
                                <InfoRow icon={faBriefcase} label="Tipo" value={contato.tipo_contato} />
                                {contato.conjuge && <InfoRow icon={faUser} label="Cônjuge" value={contato.conjuge.nome || contato.conjuge.razao_social} />}
                            </div>
                            
                            <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-semibold text-gray-600">Contato</h4>
                                <div className="flex items-start text-sm">
                                    <FontAwesomeIcon icon={faPhone} className="w-4 mt-1 text-gray-400" />
                                    <div className="ml-3">
                                        <EditableArrayField items={contato.telefones} type="telefones" contactId={contactId} queryClient={queryClient} />
                                    </div>
                                </div>
                                 <div className="flex items-start text-sm">
                                    <FontAwesomeIcon icon={faEnvelope} className="w-4 mt-1 text-gray-400" />
                                    <div className="ml-3">
                                         <EditableArrayField items={contato.emails} type="emails" contactId={contactId} queryClient={queryClient} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-semibold text-gray-600">Endereço</h4>
                                <InfoRow icon={faMapMarkerAlt} label="Endereço Completo" value={[contato.address_street, contato.address_number, contato.neighborhood, contato.city, contato.state].filter(Boolean).join(', ')} />
                            </div>

                            {isPessoaFisica && (
                                <div className="space-y-4 pt-4 border-t">
                                    <h4 className="font-semibold text-gray-600">Dados Adicionais</h4>
                                    <InfoRow icon={faCalendarAlt} label="Data de Nascimento" value={formatDateString(contato.birth_date)} />
                                    <InfoRow icon={faUser} label="Estado Civil" value={contato.estado_civil} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}