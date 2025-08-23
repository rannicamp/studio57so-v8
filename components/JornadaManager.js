"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faChevronDown, faChevronUp, faTrash, faSave, faSpinner } from '@fortawesome/free-solid-svg-icons';

const weekDays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const JornadaForm = ({ jornada, onSave, onDelete, showToast }) => {
    const supabase = createClient();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState(jornada);

    const handleHeaderChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    const handleDetailChange = (dia, field, value) => {
        const detalhes = formData.detalhes.map(d => d.dia_semana === dia ? { ...d, [field]: value || null } : d);
        setFormData(prev => ({ ...prev, detalhes }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        showToast('Salvando jornada...', 'info');
        const { id, nome_jornada, carga_horaria_semanal, tolerancia_minutos } = formData;
        await supabase.from('jornadas').update({ nome_jornada, carga_horaria_semanal, tolerancia_minutos }).eq('id', id);
        await supabase.from('jornada_detalhes').upsert(formData.detalhes.map(({ id, ...rest }) => rest), { onConflict: 'jornada_id, dia_semana' });
        showToast('Jornada salva com sucesso!', 'success');
        onSave(formData);
        setIsSaving(false);
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
                    <div className="flex justify-end gap-4 mt-4"><button onClick={() => onDelete(formData.id)} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 font-semibold flex items-center gap-2"><FontAwesomeIcon icon={faTrash} /> Excluir</button><button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-semibold flex items-center gap-2">{isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />} {isSaving ? 'Salvando...' : 'Salvar'}</button></div>
                </div>
            )}
        </div>
    );
};

export default function JornadaManager({ initialJornadas }) {
    const supabase = createClient();
    const [jornadas, setJornadas] = useState(initialJornadas);
    const [toastMessage, setToastMessage] = useState(null);
    const showToast = (message, type) => { setToastMessage({ text: message, type }); setTimeout(() => setToastMessage(null), 4000); };
    const handleAddNewJornada = async () => {
        const nome = prompt("Nome da nova jornada?"); if (!nome) return;
        const { data: newJornada, error } = await supabase.from('jornadas').insert({ nome_jornada: nome, carga_horaria_semanal: 44, tolerancia_minutos: 5 }).select().single();
        if(error) { showToast('Erro: ' + error.message, 'error'); return; }
        const detalhes = weekDays.map((_, i) => ({ jornada_id: newJornada.id, dia_semana: i }));
        await supabase.from('jornada_detalhes').insert(detalhes);
        setJornadas(prev => [...prev, { ...newJornada, detalhes }].sort((a, b) => a.nome_jornada.localeCompare(b.nome_jornada)));
        showToast('Jornada criada!', 'success');
    };
    const handleDeleteJornada = async (id) => { if (!window.confirm("Tem certeza?")) return; await supabase.from('jornadas').delete().eq('id', id); setJornadas(prev => prev.filter(j => j.id !== id)); showToast('Jornada excluída.', 'success'); };
    const handleUpdateJornadaState = (updated) => setJornadas(prev => prev.map(j => j.id === updated.id ? updated : j));
    return (
        <div>
            {toastMessage && ( <div className={`p-3 mb-4 text-center rounded-md font-semibold ${toastMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{toastMessage.text}</div> )}
            <div className="mb-6 text-right"><button onClick={handleAddNewJornada} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-semibold flex items-center gap-2 float-right"><FontAwesomeIcon icon={faPlus} /> Nova Jornada</button></div>
            <div className="mt-16">{jornadas.length > 0 ? jornadas.map(j => (<JornadaForm key={j.id} jornada={j} onSave={handleUpdateJornadaState} onDelete={handleDeleteJornada} showToast={showToast} /> )) : <p className="text-center text-gray-500">Nenhuma jornada cadastrada.</p>}</div>
        </div>
    );
}