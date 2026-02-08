// Caminho: components/atividades/form/ActivitySchedule.js
"use client";

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faCalendarAlt, faRedo } from '@fortawesome/free-solid-svg-icons';

// --- UTILITÁRIO: Cálculo de Dias Úteis ---
function addBusinessDays(startDate, days) {
    // Se não tiver dias ou data, retorna a própria data ou vazio
    if (!startDate) return '';
    
    // Converte para número para garantir, se for inválido ou <= 0, assume 1 para cálculo visual
    const numDays = parseFloat(days);
    if (isNaN(numDays) || numDays <= 1) return startDate;
    
    let currentDate = new Date(startDate.replace(/-/g, '/'));
    let daysToAdd = Math.ceil(numDays) - 1;
    
    while (daysToAdd > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Domingo, 6 = Sábado
            daysToAdd--;
        }
    }
    // Se cair no fim de semana após o cálculo, avança para segunda
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return currentDate.toISOString().split('T')[0];
}

export default function ActivitySchedule({ formData, setFormData }) {

    // Identifica se é Evento (Horas) ou Atividade (Dias) baseado nos dados
    const isEvent = formData.duracao_horas !== null && formData.duracao_horas !== undefined;

    // Cálculo automático da data fim (apenas visual, mas útil para o usuário)
    const dataFimCalculada = useMemo(() => {
        if (isEvent) return formData.data_inicio_prevista; // Evento começa e termina no mesmo dia (geralmente)
        return addBusinessDays(formData.data_inicio_prevista, formData.duracao_dias);
    }, [formData.data_inicio_prevista, formData.duracao_dias, isEvent]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    // NOVO: Validação ao sair do campo (onBlur)
    // Isso permite deixar vazio enquanto digita, e corrige só no final
    const handleBlur = (e) => {
        const { name, value } = e.target;
        
        // Se o campo for duração e estiver vazio ou negativo, reseta para 1
        if ((name === 'duracao_dias' || name === 'duracao_horas') && (!value || parseFloat(value) <= 0)) {
            setFormData(prev => ({ ...prev, [name]: 1 }));
        }
    };

    const handleTypeToggle = (type) => {
        if (type === 'atividade') {
            // Limpa dados de hora e define padrão de dia
            setFormData(prev => ({ 
                ...prev, 
                duracao_horas: null, 
                hora_inicio: null, 
                duracao_dias: 1,
                tipo_atividade: 'Tarefa'
            }));
        } else {
            // Define padrão de evento
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
                                // CORREÇÃO: Removemos o "|| 1" daqui para permitir edição livre
                                value={formData.duracao_dias} 
                                onChange={handleChange} 
                                // CORREÇÃO: Adicionamos onBlur para garantir valor válido ao sair
                                onBlur={handleBlur}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Previsão de Término (Calculada)</label>
                            <div className="w-full p-2 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-600 font-mono">
                                {dataFimCalculada ? new Date(dataFimCalculada).toLocaleDateString('pt-BR') : '--/--/----'}
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
                                // CORREÇÃO AQUI TAMBÉM
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
                                    value={formData.recorrencia_intervalo} // Remove || 1
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