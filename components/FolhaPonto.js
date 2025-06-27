"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';


// Componente de Notificação (Toast)
const Toast = ({ message, type, onclose }) => {
  useEffect(() => {
    const timer = setTimeout(onclose, 4000); // A notificação some após 4 segundos
    return () => clearTimeout(timer);
  }, [onclose]);

  const styles = {
    success: { bg: 'bg-green-500', icon: faCheckCircle },
    error: { bg: 'bg-red-500', icon: faExclamationCircle },
    info: { bg: 'bg-blue-500', icon: faInfoCircle },
  };

  const currentStyle = styles[type] || styles.info;

  return (
    <div className={`fixed bottom-5 right-5 flex items-center p-4 rounded-lg shadow-lg text-white ${currentStyle.bg} animate-fade-in-up z-50`}>
      <FontAwesomeIcon icon={currentStyle.icon} className="mr-3 text-xl" />
      <span>{message}</span>
    </div>
  );
};


export default function FolhaPonto({ employees }) {
    const supabase = createClient();

    // Estados da aplicação
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [timesheetData, setTimesheetData] = useState({});
    const [holidays, setHolidays] = useState(new Set());
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
    const [isProcessing, setIsProcessing] = useState(false); // Estado para controlar o processamento
    const [editingCell, setEditingCell] = useState(null);

    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const showToast = (message, type = 'info') => {
      setToast({ show: true, message, type });
    };

    // --- Funções Auxiliares de Cálculo de Horas ---
    const parseTime = (timeString, baseDate) => {
        if (!timeString || timeString === '--:--' || typeof timeString !== 'string') return null;
        const [hours, minutes] = timeString.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;
        const date = new Date(baseDate);
        date.setUTCHours(hours, minutes, 0, 0);
        return date;
    };

    const calculateTotalHours = useCallback((dayData) => {
        const dateBase = new Date(dayData.dateString + 'T00:00:00Z');
        const entrada = parseTime(dayData.entrada, dateBase);
        const saida = parseTime(dayData.saida, dateBase);
        const inicio_intervalo = parseTime(dayData.inicio_intervalo, dateBase);
        const fim_intervalo = parseTime(dayData.fim_intervalo, dateBase);

        if (!entrada || !saida) return '--:--';
        let totalMillis = saida.getTime() - entrada.getTime();
        if (inicio_intervalo && fim_intervalo && fim_intervalo.getTime() > inicio_intervalo.getTime()) {
            totalMillis -= (fim_intervalo.getTime() - inicio_intervalo.getTime());
        }
        if (totalMillis < 0) totalMillis = 0;
        const totalHours = Math.floor(totalMillis / (1000 * 60 * 60));
        const totalMinutes = Math.floor((totalMillis % (1000 * 60 * 60)) / (1000 * 60));
        return `${String(totalHours).padStart(2, '0')}:${String(totalMinutes).padStart(2, '0')}`;
    }, []);

    // --- Funções de busca de dados ---
    const fetchHolidays = useCallback(async (year) => {
        try {
            const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
            if (!response.ok) throw new Error('Falha ao buscar feriados.');
            const data = await response.json();
            const holidayDates = new Set(data.map(holiday => holiday.date));
            setHolidays(holidayDates);
        } catch (error) {
            console.error(error);
            showToast('Aviso: Não foi possível carregar a lista de feriados.', 'error');
        }
    }, []);

    const loadTimesheetData = useCallback(async () => {
        if (!selectedEmployeeId || !selectedMonth) {
            setTimesheetData({});
            return;
        }
        setIsProcessing(true);

        const [year, month] = selectedMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        const { data, error } = await supabase.from('pontos').select('*').eq('funcionario_id', selectedEmployeeId).gte('data_hora', `${startDate}T00:00:00`).lte('data_hora', `${endDate}T23:59:59`);
        
        if (error) {
            showToast("Erro ao carregar dados do ponto.", 'error');
            setIsProcessing(false);
            return;
        }

        const processedData = {};
        data.forEach(ponto => {
            if (!ponto.data_hora) return;
            const utcDate = new Date(ponto.data_hora.replace(' ', 'T') + 'Z');
            const localDateStringForGrouping = utcDate.toLocaleDateString('sv-SE');
            const localTimeStringForDisplay = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            if (!processedData[localDateStringForGrouping]) {
                processedData[localDateStringForGrouping] = { dateString: localDateStringForGrouping };
            }
            
            const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
            const field = fieldMap[ponto.tipo_registro];
            if(field) {
                processedData[localDateStringForGrouping][field] = localTimeStringForDisplay;
            }
        });
        
        setTimesheetData(processedData);
        await fetchHolidays(year);
        setIsProcessing(false);

    }, [selectedEmployeeId, selectedMonth, supabase, fetchHolidays]);

    useEffect(() => { loadTimesheetData(); }, [selectedEmployeeId, selectedMonth, loadTimesheetData]);

    useEffect(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
        const currentDay = String(today.getDate()).padStart(2, '0');
        setSelectedMonth(`${currentYear}-${currentMonth}`);
        setSelectedDate(`${currentYear}-${currentMonth}-${currentDay}`);
    }, []);

    const monthlySummary = useMemo(() => {
        let totalDays = 0;
        let totalMinutesMonth = 0;

        Object.values(timesheetData).forEach(dayData => {
            if (dayData.entrada && dayData.saida) {
                totalDays++;
                const totalDayStr = calculateTotalHours(dayData);
                if (totalDayStr && totalDayStr !== '--:--') {
                    const [hours, minutes] = totalDayStr.split(':').map(Number);
                    if (!isNaN(hours) && !isNaN(minutes)) {
                        totalMinutesMonth += (hours * 60) + minutes;
                    }
                }
            }
        });
        const totalHoursMonth = Math.floor(totalMinutesMonth / 60);
        const remainingMinutesMonth = totalMinutesMonth % 60;
        const formattedTotalHours = `${String(totalHoursMonth).padStart(2, '0')}:${String(remainingMinutesMonth).padStart(2, '0')}`;
        
        return { totalDays, formattedTotalHours };
    }, [timesheetData, calculateTotalHours]);


    const handleAction = async (actionType) => {
        if (!selectedEmployeeId || !selectedDate) {
            showToast("Selecione um funcionário e uma data.", 'error');
            return;
        }
        
        setIsProcessing(true);
        showToast(`Registrando ${actionType}...`, 'info');
        
        const now = new Date();
        const timeString = now.toTimeString().split(' ')[0];
        const localDate = new Date(`${selectedDate}T${timeString}`);

        const recordToSave = {
            funcionario_id: selectedEmployeeId,
            data_hora: localDate.toISOString(),
            tipo_registro: actionType,
            observacao: `Registro via botão ${actionType}`
        };

        const startOfDay = `${selectedDate}T00:00:00`;
        const endOfDay = `${selectedDate}T23:59:59.999`;

        const { data: existing, error: findError } = await supabase.from('pontos').select('id').eq('funcionario_id', selectedEmployeeId).eq('tipo_registro', actionType).gte('data_hora', startOfDay).lte('data_hora', endOfDay);

        if (findError) {
            showToast(`Erro ao verificar registro: ${findError.message}`, 'error');
            setIsProcessing(false);
            return;
        }

        let error;
        if (existing && existing.length > 0) {
            const { error: updateError } = await supabase.from('pontos').update(recordToSave).eq('id', existing[0].id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('pontos').insert(recordToSave);
            error = insertError;
        }

        if (error) {
            showToast(`Erro ao registrar: ${error.message}`, 'error');
        } else {
            showToast(`${actionType} registrado com sucesso!`, 'success');
            await loadTimesheetData();
        }
        setIsProcessing(false);
    };

    const handleCellEdit = (date, field) => {
        if (isProcessing) return;
        setEditingCell({ date, field });
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        const { date, field } = editingCell;
        let newTime = e.target.elements.time_input.value;
        setEditingCell(null);
        
        setIsProcessing(true);

        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59.999`;
        const tipo_registro = { 'entrada': 'Entrada', 'inicio_intervalo': 'Inicio_Intervalo', 'fim_intervalo': 'Fim_Intervalo', 'saida': 'Saida' }[field];
        
        if (!newTime) {
            showToast('Deletando registro...', 'info');
            const { error } = await supabase.from('pontos').delete().eq('funcionario_id', selectedEmployeeId).eq('tipo_registro', tipo_registro).gte('data_hora', startOfDay).lte('data_hora', endOfDay);
            if (error) {
                showToast(`Erro ao deletar: ${error.message}`, 'error');
            } else {
                showToast('Registro removido.', 'success');
                await loadTimesheetData();
            }
            setIsProcessing(false);
            return;
        }

        showToast('Salvando alteração...', 'info');
        
        const localDate = new Date(`${date}T${newTime}`);
        const recordToUpdate = { data_hora: localDate.toISOString(), observacao: 'Editado Manualmente' };
        const recordToInsert = { ...recordToUpdate, funcionario_id: selectedEmployeeId, tipo_registro: tipo_registro };
        const { data: existing, error: findError } = await supabase.from('pontos').select('id').eq('funcionario_id', selectedEmployeeId).eq('tipo_registro', tipo_registro).gte('data_hora', startOfDay).lte('data_hora', endOfDay);

        let error;
        if (existing && existing.length > 0) {
            const { error: updateError } = await supabase.from('pontos').update(recordToUpdate).eq('id', existing[0].id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('pontos').insert(recordToInsert);
            error = insertError;
        }
        
        if (error) {
            showToast(`Erro ao salvar: ${error.message}`, 'error');
        } else {
            showToast('Alteração salva com sucesso!', 'success');
            await loadTimesheetData();
        }
        setIsProcessing(false);
    };

    return (
        <div className="space-y-6">
            {toast.show && <Toast message={toast.message} type={toast.type} onclose={() => setToast({ ...toast, show: false })} />}

            <section className="bg-white p-6 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label htmlFor="employee-select" className="block text-sm font-medium text-gray-700">Funcionário</label>
                        <select id="employee-select" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                            <option value="">-- Selecione --</option>
                            {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.full_name}</option>))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="month-select" className="block text-sm font-medium text-gray-700">Mês/Ano</label>
                        <input type="month" id="month-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label htmlFor="date-select" className="block text-sm font-medium text-gray-700">Data para Ações</label>
                        <input type="date" id="date-select" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                </div>
            </section>
            
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button onClick={() => handleAction('Entrada')} disabled={isProcessing || !selectedEmployeeId} className="p-3 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed">Entrada</button>
                <button onClick={() => handleAction('Inicio_Intervalo')} disabled={isProcessing || !selectedEmployeeId} className="p-3 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed">Início Intervalo</button>
                <button onClick={() => handleAction('Fim_Intervalo')} disabled={isProcessing || !selectedEmployeeId} className="p-3 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed">Fim Intervalo</button>
                <button onClick={() => handleAction('Saida')} disabled={isProcessing || !selectedEmployeeId} className="p-3 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed">Saída</button>
            </section>

            <section className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
                <table className="min-w-full border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border p-2">Data</th>
                            <th className="border p-2">Dia</th>
                            <th className="border p-2">Entrada</th>
                            <th className="border p-2">Início Int.</th>
                            <th className="border p-2">Fim Int.</th>
                            <th className="border p-2">Saída</th>
                            <th className="border p-2">Total Horas</th>
                            <th className="border p-2">Obs.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(!selectedEmployeeId || !selectedMonth)
                            ? (<tr><td colSpan="8" className="text-center p-4 text-gray-500">Selecione um funcionário e um mês para começar.</td></tr>)
                            : Array.from({ length: new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0).getDate() }, (_, i) => {
                                const dayOfMonth = i + 1;
                                const dateInMonth = new Date(Date.UTC(selectedMonth.split('-')[0], selectedMonth.split('-')[1] - 1, dayOfMonth));
                                const dateString = dateInMonth.toISOString().split('T')[0];
                                const dayData = timesheetData[dateString] || { dateString };
                                const isHoliday = holidays.has(dateString);
                                const rowClass = isHoliday ? 'bg-yellow-100' : (dateInMonth.getUTCDay() === 0 || dateInMonth.getUTCDay() === 6 ? 'bg-gray-50' : '');

                                return (
                                    <tr key={dateString} className={rowClass}>
                                        <td className="border p-2 text-center">{new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                        <td className="border p-2 text-center">{weekDays[dateInMonth.getUTCDay()]} {isHoliday && '(Feriado)'}</td>
                                        {['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'].map(field => (
                                            <td key={field} onClick={() => handleCellEdit(dateString, field)} className="border p-2 text-center cursor-pointer hover:bg-blue-50">
                                                {editingCell?.date === dateString && editingCell?.field === field ? (
                                                    <form onSubmit={handleSaveEdit}>
                                                        <input type="time" name="time_input" defaultValue={dayData[field] || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-center bg-blue-100"/>
                                                    </form>
                                                ) : (dayData[field] || '--:--')}
                                            </td>
                                        ))}
                                        <td className="border p-2 text-center font-semibold">{calculateTotalHours(dayData)}</td>
                                        <td className="border p-2 text-center">{dayData.obs || ''}</td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </section>
            
            <section className="bg-gray-100 p-4 rounded-lg shadow-inner">
                <h3 className="text-xl font-bold text-center mb-2">Resumo do Mês</h3>
                <div className="flex justify-around text-center">
                    <div>
                        <p className="text-gray-600">Dias Trabalhados</p>
                        <p className="text-2xl font-bold">{monthlySummary.totalDays}</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Total de Horas</p>
                        <p className="text-2xl font-bold">{monthlySummary.formattedTotalHours}</p>
                    </div>
                </div>
            </section>
        </div>
    );
}