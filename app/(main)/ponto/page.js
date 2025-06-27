"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';

export default function FolhaPonto({ employees }) {
    const supabase = createClient();

    // Estados da aplicação
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [timesheetData, setTimesheetData] = useState({});
    const [holidays, setHolidays] = useState(new Set());
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [editingCell, setEditingCell] = useState(null); // { date: 'YYYY-MM-DD', field: 'entrada' }

    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    // --- Funções Auxiliares ---
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
            setMessage('Aviso: Não foi possível carregar a lista de feriados.');
        }
    }, []);

    const loadTimesheetData = useCallback(async () => {
        if (!selectedEmployeeId || !selectedMonth) {
            setTimesheetData({});
            return;
        }
        setIsLoading(true);
        setMessage('Carregando registros...');

        const [year, month] = selectedMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data, error } = await supabase.from('pontos').select('*').eq('funcionario_id', selectedEmployeeId).gte('data_hora', `${startDate}T00:00:00`).lte('data_hora', `${endDate}T23:59:59`);
        
        if (error) {
            setMessage("Erro ao carregar dados do ponto.");
            setIsLoading(false);
            return;
        }

        const processedData = {};
        data.forEach(ponto => {
            const dateObj = new Date(ponto.data_hora);
            const dateString = dateObj.toISOString().split('T')[0];
            if (!processedData[dateString]) processedData[dateString] = { dateString };
            
            const timeString = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
            const field = fieldMap[ponto.tipo_registro];
            if(field) processedData[dateString][field] = timeString;
        });
        
        setTimesheetData(processedData);
        await fetchHolidays(year);
        setIsLoading(false);
        setMessage('');

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
        if (!selectedEmployeeId || !selectedDate) { alert("Selecione um funcionário e uma data."); return; }
        
        setIsLoading(true);
        setMessage(`Registrando ${actionType}...`);
        const now = new Date();
        const data_hora = new Date(`${selectedDate}T${now.toTimeString().split(' ')[0]}`);

        // Lógica de Upsert para evitar duplicados ao clicar no botão
        const { data: existing, error: findError } = await supabase
            .from('pontos')
            .select('id')
            .eq('funcionario_id', selectedEmployeeId)
            .eq('tipo_registro', actionType)
            .like('data_hora', `${selectedDate}%`);

        if (findError) {
            setMessage(`Erro ao verificar registro: ${findError.message}`);
            setIsLoading(false);
            return;
        }

        const recordToSave = {
            funcionario_id: selectedEmployeeId,
            data_hora: data_hora.toISOString(),
            tipo_registro: actionType,
            observacao: `Registro via botão ${actionType}`
        };

        let error;
        if (existing && existing.length > 0) {
            // Atualiza o registro existente do mesmo tipo no mesmo dia
            const { error: updateError } = await supabase.from('pontos').update(recordToSave).eq('id', existing[0].id);
            error = updateError;
        } else {
            // Insere um novo registro
            const { error: insertError } = await supabase.from('pontos').insert(recordToSave);
            error = insertError;
        }

        if (error) setMessage(`Erro ao registrar: ${error.message}`);
        else {
            setMessage(`${actionType} registrado com sucesso!`);
            await loadTimesheetData();
        }
        setIsLoading(false);
    };

    const handleCellEdit = (date, field) => {
        if (isLoading) return;
        setEditingCell({ date, field });
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        const { date, field } = editingCell;
        const input = e.target.elements.time_input;
        const newTime = input.value;
        setEditingCell(null);
        
        if (!newTime) { // Se o campo for limpo
            // Lógica para deletar o ponto específico
            setMessage('Deletando registro...');
            setIsLoading(true);
            const tipo_registro = { 'entrada': 'Entrada', 'inicio_intervalo': 'Inicio_Intervalo', 'fim_intervalo': 'Fim_Intervalo', 'saida': 'Saida' }[field];
            const { error } = await supabase.from('pontos')
                .delete()
                .eq('funcionario_id', selectedEmployeeId)
                .eq('tipo_registro', tipo_registro)
                .like('data_hora', `${date}%`);
             if (error) setMessage(`Erro ao deletar: ${error.message}`);
             else {
                 setMessage('Registro removido.');
                 await loadTimesheetData();
             }
             setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setMessage('Salvando alteração...');
        
        const typeMap = { 'entrada': 'Entrada', 'inicio_intervalo': 'Inicio_Intervalo', 'fim_intervalo': 'Fim_Intervalo', 'saida': 'Saida' };
        const tipo_registro = typeMap[field];
        
        const data_hora = new Date(`${date}T${newTime}`);

         const { data: existing, error: findError } = await supabase.from('pontos').select('id').eq('funcionario_id', selectedEmployeeId).eq('tipo_registro', tipo_registro).like('data_hora', `${date}%`);

        let error;
        if (existing && existing.length > 0) {
            const { error: updateError } = await supabase.from('pontos').update({ data_hora: data_hora.toISOString(), observacao: 'Editado Manualmente' }).eq('id', existing[0].id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('pontos').insert({ funcionario_id: selectedEmployeeId, data_hora: data_hora.toISOString(), tipo_registro: tipo_registro, observacao: 'Editado Manualmente' });
            error = insertError;
        }
        
        if (error) setMessage(`Erro ao salvar: ${error.message}`);
        else {
            setMessage('Alteração salva com sucesso!');
            await loadTimesheetData();
        }
        setIsLoading(false);
    };

    return (
        <div className="space-y-6">
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
                <button onClick={() => handleAction('Entrada')} disabled={isLoading || !selectedEmployeeId} className="p-3 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400">Entrada</button>
                <button onClick={() => handleAction('Inicio_Intervalo')} disabled={isLoading || !selectedEmployeeId} className="p-3 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:bg-gray-400">Início Intervalo</button>
                <button onClick={() => handleAction('Fim_Intervalo')} disabled={isLoading || !selectedEmployeeId} className="p-3 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:bg-gray-400">Fim Intervalo</button>
                <button onClick={() => handleAction('Saida')} disabled={isLoading || !selectedEmployeeId} className="p-3 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400">Saída</button>
            </section>

             {message && <div className="p-4 rounded-md text-center font-semibold bg-blue-100 text-blue-800">{message}</div>}

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
                        {
                            (!selectedEmployeeId || !selectedMonth)
                            ? <tr><td colSpan="8" className="text-center p-4 text-gray-500">Selecione um funcionário e um mês para começar.</td></tr>
                            : isLoading
                            ? <tr><td colSpan="8" className="text-center p-4 text-gray-500">Carregando...</td></tr>
                            : Array.from({ length: new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0).getDate() }, (_, i) => i + 1).map(day => {
                                const currentDate = new Date(Date.UTC(selectedMonth.split('-')[0], selectedMonth.split('-')[1] - 1, day));
                                const dateString = currentDate.toISOString().split('T')[0];
                                const dayData = timesheetData[dateString] || { dateString };
                                const isHoliday = holidays.has(dateString);
                                const rowClass = isHoliday ? 'bg-yellow-100' : (currentDate.getUTCDay() === 0 || currentDate.getUTCDay() === 6 ? 'bg-gray-50' : '');

                                return (
                                    <tr key={dateString} className={rowClass}>
                                        <td className="border p-2 text-center">{new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td className="border p-2 text-center">{weekDays[currentDate.getUTCDay()]} {isHoliday && '(Feriado)'}</td>
                                        {['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'].map(field => (
                                            <td key={field} onClick={() => handleCellEdit(dateString, field)} className="border p-2 text-center cursor-pointer hover:bg-blue-50">
                                                {editingCell?.date === dateString && editingCell?.field === field ? (
                                                    <form onSubmit={handleSaveEdit}>
                                                        <input type="time" name="time_input" defaultValue={dayData[field] || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-center"/>
                                                    </form>
                                                ) : (dayData[field] || '--:--')}
                                            </td>
                                        ))}
                                        <td className="border p-2 text-center font-semibold">{calculateTotalHours(dayData)}</td>
                                        <td className="border p-2 text-center">{dayData.obs || ''}</td>
                                    </tr>
                                );
                            })
                        }
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