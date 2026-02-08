"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faChevronDown, faChevronUp, faTrash, faSave, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

const weekDays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const JornadaForm = ({ jornada, onSave, onDelete }) => {
    const supabase = createClient();
    const [isExpanded, setIsExpanded] = useState(false);
    const [formData, setFormData] = useState(jornada);

    const handleHeaderChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    const handleDetailChange = (dia, field, value) => {
        const detalhes = formData.detalhes.map(d => d.dia_semana === dia ? { ...d, [field]: value || null } : d);
        setFormData(prev => ({ ...prev, detalhes }));
    };

    const handleSave = async () => {
        const promise = async () => {
            const { id, nome_jornada, carga_horaria_semanal, tolerancia_minutos, organizacao_id } = formData;

            // Por que: Adicionamos o filtro de organizacao_id para garantir que o usuário só possa editar uma jornada da sua própria organização.
            const { error: jornadaError } = await supabase.from('jornadas').update({ nome_jornada, carga_horaria_semanal, tolerancia_minutos }).eq('id', id).eq('organizacao_id', organizacao_id);
            if (jornadaError) throw new Error(`Erro ao salvar jornada: ${jornadaError.message}`);
            
            const { error: detalhesError } = await supabase.from('jornada_detalhes').upsert(formData.detalhes.map(({ id, ...rest }) => rest), { onConflict: 'jornada_id, dia_semana' });
            if (detalhesError) throw new Error(`Erro ao salvar detalhes: ${detalhesError.message}`);
            
            return formData;
        };

        toast.promise(promise(), {
            loading: 'Salvando jornada...',
            success: (updatedData) => {
                onSave(updatedData);
                return 'Jornada salva com sucesso!';
            },
            error: (err) => err.message
        });
    };
    
    const handleDelete = () => {
        // Por que: Substituímos o window.confirm por um toast de confirmação mais moderno.
        toast.warning(`Tem certeza que deseja excluir a jornada "${formData.nome_jornada}"?`, {
            action: {
                label: "Confirmar Exclusão",
                onClick: () => onDelete(formData.id)
            },
            cancel: {
                label: "Cancelar"
            }
        });
    };

    return (
        <div className="border rounded-lg mb-4">
            <div className="bg-gray-50 p-4 flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <h3 className="font-bold text-lg">{formData.nome_jornada} ({formData.carga_horaria_semanal}h/semana)</h3>
                <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
            </div>
            {isExpanded && (
                <div className="p-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4">
                        <div><label className="block text-sm font-medium">Nome da Jornada</label><input value={formData.nome_jornada} onChange={e => handleHeaderChange('nome_jornada', e.target.value)} className="mt-1 p-2 w-full border rounded-md"/></div>
                        <div><label className="block text-sm font-medium">Carga Horária Semanal</label><input type="number" value={formData.carga_horaria_semanal} onChange={e => handleHeaderChange('carga_horaria_semanal', e.target.value)} className="mt-1 p-2 w-full border rounded-md"/></div>
                        <div><label className="block text-sm font-medium">Tolerância (minutos)</label><input type="number" value={formData.tolerancia_minutos} onChange={e => handleHeaderChange('tolerancia_minutos', e.target.value)} className="mt-1 p-2 w-full border rounded-md"/></div>
                    </div>
                    <div className="overflow-x-auto"><p className="text-md font-semibold mb-2">Horários Padrão (Dias Úteis)</p><table className="min-w-full"><thead><tr><th className="py-2 text-left">Dia</th><th className="text-left">Entrada</th><th className="text-left">Saída Almoço</th><th className="text-left">Volta Almoço</th><th className="text-left">Saída</th></tr></thead><tbody>{formData.detalhes.filter(d => d.dia_semana > 0 && d.dia_semana < 6).sort((a,b) => a.dia_semana - b.dia_semana).map(d => (<tr key={d.dia_semana}><td className="font-medium pr-4 py-1">{weekDays[d.dia_semana]}</td><td><input type="time" value={d.horario_entrada || ''} onChange={e => handleDetailChange(d.dia_semana, 'horario_entrada', e.target.value)} className="p-1 border rounded w-full"/></td><td><input type="time" value={d.horario_saida_intervalo || ''} onChange={e => handleDetailChange(d.dia_semana, 'horario_saida_intervalo', e.target.value)} className="p-1 border rounded w-full"/></td><td><input type="time" value={d.horario_volta_intervalo || ''} onChange={e => handleDetailChange(d.dia_semana, 'horario_volta_intervalo', e.target.value)} className="p-1 border rounded w-full"/></td><td><input type="time" value={d.horario_saida || ''} onChange={e => handleDetailChange(d.dia_semana, 'horario_saida', e.target.value)} className="p-1 border rounded w-full"/></td></tr>))}</tbody></table></div>
                    <div className="mt-4 border-t pt-4"><label className="font-medium">Regra para Fim de Semana e Feriados</label><p className="p-2 bg-blue-50 text-blue-800 rounded-md mt-2">Qualquer trabalho em Sábados, Domingos e Feriados será considerado 100% como Hora Extra.</p></div>
                    <div className="flex justify-end gap-4 mt-4">
                        <button onClick={handleDelete} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 font-semibold flex items-center gap-2"><FontAwesomeIcon icon={faTrash} /> Excluir</button>
                        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-semibold flex items-center gap-2"><FontAwesomeIcon icon={faSave} /> Salvar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function JornadaManager({ initialJornadas }) {
    const supabase = createClient();
    const { userData } = useAuth();
    const [jornadas, setJornadas] = useState(initialJornadas);

    const handleAddNewJornada = async () => {
        // Por que: Substituímos o prompt por um formulário dentro de um toast, uma UX muito superior.
        const AddJornadaForm = ({ toastId }) => {
            const [nome, setNome] = useState('');
            const handleSubmit = (e) => {
                e.preventDefault();
                if (!nome.trim()) {
                    toast.error("O nome da jornada não pode ser vazio.");
                    return;
                }
                toast.dismiss(toastId); // Fecha o toast com o formulário
                createNewJornada(nome.trim());
            };
            return (
                <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2">
                    <label className="font-semibold">Nome da nova jornada:</label>
                    <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="p-2 border rounded" autoFocus />
                    <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Criar Jornada</button>
                </form>
            );
        };
        toast.custom((t) => <AddJornadaForm toastId={t} />, { duration: Infinity }); // Mantém o toast aberto
    };

    const createNewJornada = (nome) => {
        const promise = async () => {
            const orgId = userData?.organizacao_id;
            if (!orgId) throw new Error("Organização não encontrada. Faça login novamente.");
            
            // Por que: Adicionamos o organizacao_id para garantir que a nova jornada seja criada na organização correta.
            const { data: newJornada, error } = await supabase.from('jornadas').insert({ 
                nome_jornada: nome, 
                carga_horaria_semanal: 44, 
                tolerancia_minutos: 5,
                organizacao_id: orgId 
            }).select().single();

            if (error) throw error;
            
            const detalhes = weekDays.map((_, i) => ({ jornada_id: newJornada.id, dia_semana: i }));
            const { error: detalhesError } = await supabase.from('jornada_detalhes').insert(detalhes);
            if (detalhesError) throw new Error(`Jornada criada, mas houve um erro nos detalhes: ${detalhesError.message}`);
            
            return { ...newJornada, detalhes };
        };

        toast.promise(promise(), {
            loading: 'Criando nova jornada...',
            success: (novaJornadaComDetalhes) => {
                setJornadas(prev => [...prev, novaJornadaComDetalhes].sort((a, b) => a.nome_jornada.localeCompare(b.nome_jornada)));
                return 'Jornada criada com sucesso!';
            },
            error: (err) => err.message
        });
    };
    
    const handleDeleteJornada = async (id) => {
        const promise = async () => {
            const orgId = userData?.organizacao_id;
            if (!orgId) throw new Error("Organização não encontrada.");
            
            // Por que: Adicionamos o filtro de organizacao_id para garantir que um usuário só possa excluir jornadas da sua própria organização.
            const { error } = await supabase.from('jornadas').delete().eq('id', id).eq('organizacao_id', orgId);
            if(error) throw error;
        };

        toast.promise(promise(), {
            loading: 'Excluindo jornada...',
            success: () => {
                setJornadas(prev => prev.filter(j => j.id !== id));
                return 'Jornada excluída com sucesso!';
            },
            error: (err) => `Erro ao excluir: ${err.message}`
        });
    };
    
    const handleUpdateJornadaState = (updated) => setJornadas(prev => prev.map(j => j.id === updated.id ? updated : j));
    
    return (
        <div>
            <div className="mb-6 text-right"><button onClick={handleAddNewJornada} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-semibold flex items-center gap-2 float-right"><FontAwesomeIcon icon={faPlus} /> Nova Jornada</button></div>
            <div className="mt-16">{jornadas.length > 0 ? jornadas.map(j => (<JornadaForm key={j.id} jornada={j} onSave={handleUpdateJornadaState} onDelete={handleDeleteJornada} /> )) : <p className="text-center text-gray-500">Nenhuma jornada cadastrada.</p>}</div>
        </div>
    );
}