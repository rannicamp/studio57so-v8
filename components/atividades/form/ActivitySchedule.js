// Caminho: components/atividades/form/ActivitySchedule.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faCalendarAlt, faRedo, faCalculator, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// --- UTILITÁRIO JS RÁPIDO (Fallback Seguro) ---
// Usa UTC ao meio-dia para evitar erros de fuso horário (-1 dia)
function addBusinessDaysSafe(startDate, days) {
    if (!startDate) return '';
    const numDays = parseFloat(days);
    if (isNaN(numDays) || numDays <= 1) return startDate;
    
    // Divide a string YYYY-MM-DD
    const parts = startDate.split('-');
    // Cria data em UTC ao meio-dia (12:00) para evitar problemas de fuso
    let current = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    
    let daysToAdd = Math.ceil(numDays) - 1;
    
    while (daysToAdd > 0) {
        current.setUTCDate(current.getUTCDate() + 1);
        const day = current.getUTCDay(); // 0 = Domingo, 6 = Sábado
        if (day !== 0 && day !== 6) {
            daysToAdd--;
        }
    }
    
    // Se cair no sábado/domingo após o loop, avança
    while (current.getUTCDay() === 0 || current.getUTCDay() === 6) {
        current.setUTCDate(current.getUTCDate() + 1);
    }
    
    return current.toISOString().split('T')[0];
}

export default function ActivitySchedule({ formData, setFormData }) {
    const supabase = createClient();
    const { user } = useAuth();
    
    // Estado para data calculada pelo servidor (considerando feriados)
    const [serverEndDate, setServerEndDate] = useState(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Identifica se é Evento (Horas) ou Atividade (Dias)
    const isEvent = formData.tipo_atividade === 'Evento';

    // --- CÁLCULO PRECISO NO SERVIDOR (RPC) ---
    const calculateEndDate = useCallback(async () => {
        // Se for evento, data fim = data inicio
        if (isEvent) {
            setServerEndDate(formData.data_inicio_prevista);
            return;
        }

        if (!formData.data_inicio_prevista || !formData.duracao_dias || !user?.organizacao_id) {
            setServerEndDate(null);
            return;
        }

        setIsCalculating(true);
        try {
            const { data, error } = await supabase.rpc('calcular_termino_atividade', {
                p_data_inicio: formData.data_inicio_prevista,
                p_dias_uteis: formData.duracao_dias,
                p_organizacao_id: user.organizacao_id
            });

            if (!error && data) {
                setServerEndDate(data);
                // Opcional: Atualizar o formData automaticamente? 
                // Por enquanto deixamos apenas visual para não causar loops, 
                // mas você pode descomentar abaixo se quiser salvar a data calculada:
                // setFormData(prev => ({ ...prev, data_fim_prevista: data }));
            } else {
                // Fallback para JS se der erro
                setServerEndDate(addBusinessDaysSafe(formData.data_inicio_prevista, formData.duracao_dias));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsCalculating(false);
        }
    }, [formData.data_inicio_prevista, formData.duracao_dias, isEvent, user?.organizacao_id, supabase]);

    // Dispara cálculo quando muda data ou duração (com debounce nativo do useEffect)
    useEffect(() => {
        const timer = setTimeout(() => {
            calculateEndDate();
        }, 500); // Espera 500ms após parar de digitar
        return () => clearTimeout(timer);
    }, [calculateEndDate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        if ((name === 'duracao_dias' || name === 'duracao_horas') && (!value || parseFloat(value) <= 0)) {
            setFormData(prev => ({ ...prev, [name]: 1 }));
        }
    };

    const handleTypeToggle = (type) => {
        if (type === 'atividade') {
            setFormData(prev => ({ 
                ...prev, 
                duracao_horas: null, 
                hora_inicio: null, 
                duracao_dias: 1,
                tipo_atividade: 'Tarefa'
            }));
        } else {
            setFormData(prev => ({ 
                ...prev, 
                duracao_horas: 1, 
                hora_inicio: '09:00', 
                duracao_dias: 0,
                tipo_atividade: 'Evento'
            }));
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm space-y-4">
            
            <div className="flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                <h3 className="text-xs font-bold text-gray-500 uppercase">Cronograma</h3>
            </div>

            {/* Toggle Tipo */}
            <div className="flex p-1 bg-gray-100 rounded-lg">
                <button 
                    type="button" 
                    onClick={() => handleTypeToggle('atividade')} 
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${!isEvent ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Atividade (Dias)
                </button>
                <button 
                    type="button" 
                    onClick={() => handleTypeToggle('evento')} 
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${isEvent ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Evento (Horas)
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Campos para ATIVIDADE (Dias) */}
                {!isEvent ? (
                    <>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Início Previsto</label>
                            <input 
                                type="date" 
                                name="data_inicio_prevista" 
                                value={formData.data_inicio_prevista || ''} 
                                onChange={handleChange} 
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Duração (Dias Úteis)</label>
                            <input 
                                type="number" 
                                name="duracao_dias" 
                                min="0.5" 
                                step="0.5" 
                                value={formData.duracao_dias} 
                                onChange={handleChange} 
                                onBlur={handleBlur}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-2">
                                Previsão de Término
                                {isCalculating && <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />}
                            </label>
                            <div className={`w-full p-2 text-sm bg-gray-100 border border-gray-200 rounded-lg font-mono flex items-center gap-2 ${serverEndDate ? 'text-gray-800' : 'text-gray-400'}`}>
                                <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-400"/>
                                {serverEndDate 
                                    ? new Date(serverEndDate.replace(/-/g, '/')).toLocaleDateString('pt-BR') 
                                    : '--/--/----'
                                }
                                <span className="text-[9px] text-gray-400 ml-auto bg-white px-2 py-0.5 rounded border">
                                    {isCalculating ? 'Calculando...' : 'Considera Feriados'}
                                </span>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Campos para EVENTO (Horas) */
                    <>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                            <input 
                                type="date" 
                                name="data_inicio_prevista" 
                                value={formData.data_inicio_prevista || ''} 
                                onChange={handleChange} 
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hora Início</label>
                            <input 
                                type="time" 
                                name="hora_inicio" 
                                value={formData.hora_inicio || ''} 
                                onChange={handleChange} 
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Duração (Horas)</label>
                            <input 
                                type="number" 
                                name="duracao_horas" 
                                min="0.5" 
                                step="0.5" 
                                value={formData.duracao_horas || ''} 
                                onChange={handleChange} 
                                onBlur={handleBlur}
                                placeholder="Ex: 1.5 para 1h30"
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Seção de Recorrência */}
            <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                    <input 
                        type="checkbox" 
                        id="is_recorrente" 
                        name="is_recorrente" 
                        checked={formData.is_recorrente} 
                        onChange={handleChange} 
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                    />
                    <label htmlFor="is_recorrente" className="text-sm font-semibold text-gray-700 flex items-center gap-2 cursor-pointer select-none">
                        <FontAwesomeIcon icon={faRedo} className="text-gray-400 text-xs" />
                        Repetir esta atividade?
                    </label>
                </div>

                {formData.is_recorrente && (
                    <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200">
                        <div>
                            <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Intervalo</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    name="recorrencia_intervalo" 
                                    value={formData.recorrencia_intervalo} 
                                    onChange={handleChange} 
                                    onBlur={(e) => {
                                        if(!e.target.value || e.target.value < 1) setFormData(prev => ({...prev, recorrencia_intervalo: 1}))
                                    }}
                                    min="1" 
                                    className="w-16 p-2 text-sm border border-blue-200 rounded-lg text-center"
                                />
                                <select 
                                    name="recorrencia_tipo" 
                                    value={formData.recorrencia_tipo} 
                                    onChange={handleChange} 
                                    className="flex-1 p-2 text-sm border border-blue-200 rounded-lg bg-white"
                                >
                                    <option value="diaria">Dia(s)</option>
                                    <option value="semanal">Semana(s)</option>
                                    <option value="mensal">Mês(es)</option>
                                    <option value="anual">Ano(s)</option>
                                </select>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Repetir até (Opcional)</label>
                            <input 
                                type="date" 
                                name="recorrencia_fim" 
                                value={formData.recorrencia_fim || ''} 
                                onChange={handleChange} 
                                className="w-full p-2 text-sm border border-blue-200 rounded-lg"
                            />
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}