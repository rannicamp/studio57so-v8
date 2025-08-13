"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle, faInfoCircle, faUserEdit, faCalendarCheck, faBusinessTime, faCalendarXmark, faPrint, faSpinner } from '@fortawesome/free-solid-svg-icons';
import KpiCard from './KpiCard';

const Toast = ({ message, type, onclose }) => {
  useEffect(() => {
    const timer = setTimeout(onclose, 4000);
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


export default function FolhaPonto({ employees, canEdit }) {
    const supabase = createClient();
    const { user, userData } = useAuth();

    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [timesheetData, setTimesheetData] = useState({});
    const [holidays, setHolidays] = useState(new Set());
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingCell, setEditingCell] = useState(null);
    const [abonoTypes, setAbonoTypes] = useState([]);
    const [abonosData, setAbonosData] = useState({});
    const [currentUser, setCurrentUser] = useState(null);
    const [jornada, setJornada] = useState(null);
    const [proprietarios, setProprietarios] =useState([]);
    const [selectedSignatoryId, setSelectedSignatoryId] = useState('');
    const [geradoPor, setGeradoPor] = useState('');
    const isUserProprietario = userData?.funcoes?.nome_funcao === 'Proprietário';
    
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    useEffect(() => {
        const fetchProprietarios = async () => {
            const { data } = await supabase
                .from('usuarios')
                .select('id, nome, sobrenome, funcoes!inner(nome_funcao)')
                .eq('funcoes.nome_funcao', 'Proprietário');
            setProprietarios(data || []);
            if (isUserProprietario) {
                setSelectedSignatoryId(user.id);
            } else if (data && data.length > 0) {
                setSelectedSignatoryId(data[0].id);
            }
        };
        fetchProprietarios();
        if (userData) {
            setGeradoPor(`${userData.nome} ${userData.sobrenome}`);
        }
    }, [supabase, user, userData, isUserProprietario]);

    const handlePrint = () => {
        window.print();
    };

    const selectedEmployeeName = employees.find(e => e.id == selectedEmployeeId)?.full_name || 'N/A';
    const selectedSignatoryName = proprietarios.find(p => p.id == selectedSignatoryId)?.nome + ' ' + proprietarios.find(p => p.id == selectedSignatoryId)?.sobrenome || 'N/A';

    const showToast = (message, type = 'info') => {
      setToast({ show: true, message, type });
    };

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
    
    const fetchAbonoTypes = useCallback(async () => {
        const { data, error } = await supabase.from('abono_tipos').select('id, descricao');
        if (error) {
            showToast('Erro ao carregar tipos de abono.', 'error');
        } else {
            setAbonoTypes(data);
        }
    }, [supabase]);

    const fetchCurrentUser = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: userData, error } = await supabase
                .from('usuarios')
                .select('id, nome, sobrenome')
                .eq('id', user.id)
                .single();
            
            if (error) {
                console.error("Erro ao buscar dados do usuário:", error);
                showToast("Não foi possível identificar o usuário logado.", "error");
            } else if (userData) {
                setCurrentUser({
                    id: userData.id,
                    nome: `${userData.nome} ${userData.sobrenome}`.trim()
                });
            }
        }
    }, [supabase]);

    const loadTimesheetData = useCallback(async () => {
        if (!selectedEmployeeId || !selectedMonth) {
            setTimesheetData({});
            setAbonosData({});
            setJornada(null);
            return;
        }
        setIsProcessing(true);

        const [year, month] = selectedMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        const { data: employeeData } = await supabase.from('funcionarios').select('jornada_id').eq('id', selectedEmployeeId).single();
        if(employeeData?.jornada_id) {
            const { data: jornadaData } = await supabase.from('jornadas').select('*, detalhes:jornada_detalhes(*)').eq('id', employeeData.jornada_id).single();
            setJornada(jornadaData);
        } else {
            setJornada(null);
        }

        const { data: pontosData, error: pontosError } = await supabase.from('pontos').select('*, editado_por_usuario_id:usuarios(nome, sobrenome)').eq('funcionario_id', selectedEmployeeId).gte('data_hora', `${startDate}T00:00:00`).lte('data_hora', `${endDate}T23:59:59`);
        if (pontosError) {
            showToast("Erro ao carregar dados do ponto.", 'error');
            setIsProcessing(false);
            return;
        }
        
        const { data: abonosDoMes, error: abonosError } = await supabase.from('abonos').select('*, criado_por_usuario_id:usuarios(nome, sobrenome)').eq('funcionario_id', selectedEmployeeId).gte('data_abono', startDate).lte('data_abono', endDate);
        if (abonosError) {
            showToast("Erro ao carregar abonos.", 'error');
        } else {
            const processedAbonos = {};
            abonosDoMes.forEach(abono => {
                processedAbonos[abono.data_abono] = abono;
            });
            setAbonosData(processedAbonos);
        }

        const processedData = {};
        pontosData.forEach(ponto => {
            if (!ponto.data_hora) return;
            const utcDate = new Date(ponto.data_hora.replace(' ', 'T') + 'Z');
            const localDateStringForGrouping = utcDate.toLocaleDateString('sv-SE');
            const localTimeStringForDisplay = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            if (!processedData[localDateStringForGrouping]) { processedData[localDateStringForGrouping] = { dateString: localDateStringForGrouping, observacoes: [] }; }
            const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
            const field = fieldMap[ponto.tipo_registro];
            if(field) {
                processedData[localDateStringForGrouping][field] = localTimeStringForDisplay;
                if (ponto.editado_manualmente && ponto.editado_por_usuario_id) {
                    processedData[localDateStringForGrouping][`${field}_manual`] = true;
                    const editorNome = `${ponto.editado_por_usuario_id.nome || ''} ${ponto.editado_por_usuario_id.sobrenome || ''}`.trim();
                    const obsText = `Campo "${ponto.tipo_registro}" editado por ${editorNome}.`;
                    if (!processedData[localDateStringForGrouping].observacoes.includes(obsText)) { processedData[localDateStringForGrouping].observacoes.push(obsText); }
                }
            }
            if(ponto.observacao) { if (!processedData[localDateStringForGrouping].observacoes.includes(ponto.observacao)) { processedData[localDateStringForGrouping].observacoes.push(ponto.observacao); } }
        });
        Object.keys(processedData).forEach(date => { processedData[date].observacao_final = processedData[date].observacoes.join(' | '); });
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
        fetchAbonoTypes();
    }, [fetchAbonoTypes]);

    const kpiData = useMemo(() => {
        if (!selectedMonth) return { dias: '0 / 0', horas: '00:00h / 00:00h', faltas: 0 };
        
        const today = new Date();
        const [year, month] = selectedMonth.split('-').map(Number);
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const lastDayOfMonth = new Date(year, month, 0);
        
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month - 1;
        const limitDate = isCurrentMonth ? today : lastDayOfMonth;

        let diasUteisAteHoje = 0;
        let cargaHorariaEsperadaMinutos = 0;
        const jornadaDetalhes = jornada?.detalhes || [];

        if (jornadaDetalhes.length > 0) {
            for (let d = new Date(firstDayOfMonth); d <= limitDate; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                const dateString = d.toISOString().split('T')[0];
                if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateString)) {
                    diasUteisAteHoje++;
                    const jornadaDoDia = jornadaDetalhes.find(j => j.dia_semana === dayOfWeek);
                    if (jornadaDoDia) {
                        const entrada = jornadaDoDia.horario_entrada ? jornadaDoDia.horario_entrada.split(':').map(Number) : [0,0];
                        const saida = jornadaDoDia.horario_saida ? jornadaDoDia.horario_saida.split(':').map(Number) : [0,0];
                        const inicioIntervalo = jornadaDoDia.horario_saida_intervalo ? jornadaDoDia.horario_saida_intervalo.split(':').map(Number) : [0,0];
                        const fimIntervalo = jornadaDoDia.horario_volta_intervalo ? jornadaDoDia.horario_volta_intervalo.split(':').map(Number) : [0,0];
                        
                        const minutosTrabalho = (saida[0]*60 + saida[1]) - (entrada[0]*60 + entrada[1]);
                        const minutosIntervalo = (fimIntervalo[0]*60 + fimIntervalo[1]) - (inicioIntervalo[0]*60 + inicioIntervalo[1]);
                        
                        cargaHorariaEsperadaMinutos += minutosTrabalho - (minutosIntervalo > 0 ? minutosIntervalo : 0);
                    }
                }
            }
        }
        const cargaHorariaEsperadaFormatada = `${Math.floor(cargaHorariaEsperadaMinutos / 60)}:${String(cargaHorariaEsperadaMinutos % 60).padStart(2, '0')}h`;

        let totalMinutesMonth = 0;
        let totalDays = 0;
        Object.values(timesheetData).forEach(dayData => {
            if (dayData.entrada && dayData.saida) {
                totalDays++;
                const totalDayStr = calculateTotalHours(dayData);
                if (totalDayStr !== '--:--') {
                    const [hours, minutes] = totalDayStr.split(':').map(Number);
                    totalMinutesMonth += (hours * 60) + minutes;
                }
            }
        });
        const horasTrabalhadasFormatada = `${Math.floor(totalMinutesMonth / 60)}:${String(Math.round(totalMinutesMonth % 60)).padStart(2, '0')}h`;

        const faltas = Math.max(0, diasUteisAteHoje - totalDays);

        return {
            dias: `${totalDays} / ${diasUteisAteHoje}`,
            horas: `${horasTrabalhadasFormatada} / ${cargaHorariaEsperadaFormatada}`,
            faltas: faltas
        };
    }, [timesheetData, selectedMonth, jornada, holidays, calculateTotalHours]);

    const handleAction = async (actionType) => {
        setIsProcessing(true);
        showToast(`Registrando ${actionType}...`, 'info');
        const now = new Date();
        const timeString = now.toTimeString().split(' ')[0];
        const localDate = new Date(`${selectedDate}T${timeString}`);
        const startOfDay = `${selectedDate}T00:00:00`;
        const endOfDay = `${selectedDate}T23:59:59.999`;
        const { data: existingRecord } = await supabase.from('pontos').select('id').eq('funcionario_id', selectedEmployeeId).eq('tipo_registro', actionType).gte('data_hora', startOfDay).lte('data_hora', endOfDay).maybeSingle();
        const recordToSave = { funcionario_id: selectedEmployeeId, data_hora: localDate.toISOString(), tipo_registro: actionType, observacao: `Registro via botão`, editado_manualmente: false, editado_por_usuario_id: null };
        let error;
        if(existingRecord) { const { error: updateError } = await supabase.from('pontos').update(recordToSave).eq('id', existingRecord.id); error = updateError;
        } else { const { error: insertError } = await supabase.from('pontos').insert(recordToSave); error = insertError; }
        if (error) { showToast(`Erro ao registrar: ${error.message}`, 'error');
        } else { showToast(`${actionType} registrado com sucesso!`, 'success'); await loadTimesheetData(); }
        setIsProcessing(false);
    };

    const handleCellEdit = (date, field) => {
        if (isProcessing || !canEdit) return;
        setEditingCell({ date, field });
    };

    const handleSaveEdit = async (e, date, field) => {
        e.preventDefault();
        if (!currentUser) { showToast("Não foi possível identificar o usuário. A edição não foi salva.", "error"); return; }
        let newValue = e.target.elements[0].value;
        setEditingCell(null);
        setIsProcessing(true);
        if (field === 'abono') {
            const abonoRecord = { funcionario_id: selectedEmployeeId, data_abono: date, tipo_abono_id: newValue ? parseInt(newValue) : null, criado_por_usuario_id: currentUser.id, horas_abonadas: 8, };
            const existingAbono = abonosData[date];
            let error;
            if (existingAbono && !newValue) { const { error: deleteError } = await supabase.from('abonos').delete().eq('id', existingAbono.id); error = deleteError;
            } else if (newValue) { const { error: upsertError } = await supabase.from('abonos').upsert(abonoRecord, { onConflict: 'funcionario_id, data_abono', ignoreDuplicates: false }); error = upsertError; }
            showToast(error ? `Erro: ${error.message}` : 'Abono salvo!', error ? 'error' : 'success');
        } else if (field === 'observacao') {
            const { data: pontoEntrada } = await supabase.from('pontos').select('id').eq('funcionario_id', selectedEmployeeId).eq('tipo_registro', 'Entrada').like('data_hora', `${date}%`).limit(1).single();
            if (pontoEntrada) {
                 const { error } = await supabase.from('pontos').update({ observacao: newValue }).eq('id', pontoEntrada.id);
                 showToast(error ? `Erro: ${error.message}` : 'Observação salva!', error ? 'error' : 'success');
            } else { showToast('Não há registro de entrada para adicionar observação.', 'info'); }
        } else {
            const tipo_registro = { 'entrada': 'Entrada', 'inicio_intervalo': 'Inicio_Intervalo', 'fim_intervalo': 'Fim_Intervalo', 'saida': 'Saida' }[field];
            const startOfDay = `${date}T00:00:00`;
            const endOfDay = `${date}T23:59:59.999`;
            let error;
            const { data: existingRecord } = await supabase.from('pontos').select('id').eq('funcionario_id', selectedEmployeeId).eq('tipo_registro', tipo_registro).gte('data_hora', startOfDay).lte('data_hora', endOfDay).maybeSingle();
            if (!newValue) {
                if (existingRecord) { const { error: deleteError } = await supabase.from('pontos').delete().eq('id', existingRecord.id); error = deleteError; showToast(error ? `Erro: ${error.message}` : 'Registro removido.', error ? 'error' : 'success'); }
            } else {
                const localDate = new Date(`${date}T${newValue}`);
                const recordData = { funcionario_id: selectedEmployeeId, tipo_registro, data_hora: localDate.toISOString(), editado_manualmente: true, editado_por_usuario_id: currentUser.id };
                if (existingRecord) { const { error: updateError } = await supabase.from('pontos').update(recordData).eq('id', existingRecord.id); error = updateError;
                } else { const { error: insertError } = await supabase.from('pontos').insert(recordData); error = insertError; }
                showToast(error ? `Erro: ${error.message}` : 'Alteração salva!', error ? 'error' : 'success');
            }
        }
        await loadTimesheetData();
        setIsProcessing(false);
    };


    return (
        <div className="printable-area space-y-6">
            {toast.show && <Toast message={toast.message} type={toast.type} onclose={() => setToast({ ...toast, show: false })} />}

            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .printable-area, .printable-area * {
                        visibility: visible;
                    }
                    .printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none !important;
                    }
                    table {
                        font-size: 10px;
                        border-collapse: collapse !important;
                    }
                    th, td {
                        border: 1px solid #ccc !important;
                        padding: 4px !important;
                    }
                }
            `}</style>
            
            <section className="bg-white p-6 rounded-lg shadow-md no-print">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
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
                    <div className="flex items-center gap-2">
                        {!isUserProprietario && (
                             <select value={selectedSignatoryId} onChange={(e) => setSelectedSignatoryId(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm">
                                <option value="">Assinatura do Responsável</option>
                                {proprietarios.map(p => <option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>)}
                             </select>
                        )}
                         <button onClick={handlePrint} disabled={!selectedEmployeeId} className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:bg-gray-400 h-fit">
                            <FontAwesomeIcon icon={faPrint} />
                        </button>
                    </div>
                </div>
            </section>
            
            {canEdit && (
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
                    <button onClick={() => handleAction('Entrada')} disabled={isProcessing || !selectedEmployeeId} className="p-3 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed">Entrada</button>
                    <button onClick={() => handleAction('Inicio_Intervalo')} disabled={isProcessing || !selectedEmployeeId} className="p-3 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed">Início Intervalo</button>
                    <button onClick={() => handleAction('Fim_Intervalo')} disabled={isProcessing || !selectedEmployeeId} className="p-3 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed">Fim Intervalo</button>
                    <button onClick={() => handleAction('Saida')} disabled={isProcessing || !selectedEmployeeId} className="p-3 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed">Saída</button>
                </section>
            )}

            <div className="hidden print:block mb-4">
                <h2 className="text-xl font-bold">Folha de Ponto - {selectedMonth}</h2>
                <p><span className="font-semibold">Funcionário:</span> {selectedEmployeeName}</p>
            </div>

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
                            <th className="border p-2">Abono</th>
                            <th className="border p-2">Observações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(!selectedEmployeeId || !selectedMonth)
                            ? (<tr><td colSpan="9" className="text-center p-4 text-gray-500">Selecione um funcionário e um mês para começar.</td></tr>)
                            : Array.from({ length: new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0).getDate() }, (_, i) => {
                                const dayOfMonth = i + 1;
                                const dateInMonth = new Date(Date.UTC(selectedMonth.split('-')[0], selectedMonth.split('-')[1] - 1, dayOfMonth));
                                const dateString = dateInMonth.toISOString().split('T')[0];
                                const dayData = timesheetData[dateString] || { dateString };
                                const abonoDoDia = abonosData[dateString];
                                const isHoliday = holidays.has(dateString);
                                const rowClass = isHoliday ? 'bg-yellow-100' : (dateInMonth.getUTCDay() === 0 || dateInMonth.getUTCDay() === 6 ? 'bg-gray-50' : '');
                                return (
                                    <tr key={dateString} className={rowClass}>
                                        <td className="border p-2 text-center">{new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                        <td className="border p-2 text-center">{weekDays[dateInMonth.getUTCDay()]} {isHoliday && '(Feriado)'}</td>
                                        {['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'].map(field => (
                                            <td key={field} onClick={() => handleCellEdit(dateString, field)} className={`border p-2 text-center ${canEdit ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}>
                                                {editingCell?.date === dateString && editingCell?.field === field ? (
                                                    <form onSubmit={(e) => handleSaveEdit(e, dateString, field)}>
                                                        <input type="time" name="time_input" defaultValue={dayData[field] || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-center bg-blue-100"/>
                                                    </form>
                                                ) : (
                                                    <span className="flex items-center justify-center">
                                                        {dayData[`${field}_manual`] && <FontAwesomeIcon icon={faUserEdit} title="Editado manualmente" className="text-blue-500 mr-2 h-3" />}
                                                        {dayData[field] || '--:--'}
                                                    </span>
                                                )}
                                            </td>
                                        ))}
                                        <td className="border p-2 text-center font-semibold">{calculateTotalHours(dayData)}</td>
                                        <td onClick={() => handleCellEdit(dateString, 'abono')} className={`border p-2 text-center min-w-[200px] ${canEdit ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}>
                                            {editingCell?.date === dateString && editingCell?.field === 'abono' ? (
                                                <form onSubmit={(e) => handleSaveEdit(e, dateString, 'abono')}>
                                                    <select name="abono_select" defaultValue={abonoDoDia?.tipo_abono_id || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-center bg-blue-100 p-1">
                                                        <option value="">Sem Abono</option>
                                                        {abonoTypes.map(type => (
                                                            <option key={type.id} value={type.id}>{type.descricao}</option>
                                                        ))}
                                                    </select>
                                                </form>
                                            ) : (abonoTypes.find(t => t.id === abonoDoDia?.tipo_abono_id)?.descricao || '--')}
                                        </td>
                                        <td onClick={() => handleCellEdit(dateString, 'observacao')} className={`border p-2 text-left min-w-[250px] text-xs ${canEdit ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}>
                                             {editingCell?.date === dateString && editingCell?.field === 'observacao' ? (
                                                <form onSubmit={(e) => handleSaveEdit(e, dateString, 'observacao')}>
                                                    <input type="text" name="obs_input" defaultValue={dayData.observacao_final || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-left bg-blue-100 p-1"/>
                                                </form>
                                            ) : (dayData.observacao_final || '--')}
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </section>
            
            <section className="bg-gray-100 p-4 rounded-lg shadow-inner mt-6">
                <h3 className="text-xl font-bold text-center mb-4">Resumo do Mês</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                    <KpiCard title="Dias (Trab. / Úteis)" value={kpiData.dias} icon={faCalendarCheck} color="blue" />
                    <KpiCard title="Horas (Trab. / Prev.)" value={kpiData.horas} icon={faBusinessTime} color="green" />
                    <KpiCard title="Faltas (no período)" value={kpiData.faltas} icon={faCalendarXmark} color="red" />
                </div>
                 <div className="hidden print:grid grid-cols-3 gap-6">
                    <div><p className="font-semibold">Dias (Trab. / Úteis):</p><p>{kpiData.dias}</p></div>
                    <div><p className="font-semibold">Horas (Trab. / Prev.):</p><p>{kpiData.horas}</p></div>
                    <div><p className="font-semibold">Faltas (no período):</p><p>{kpiData.faltas}</p></div>
                 </div>
            </section>
            
            <section className="hidden print:block mt-20 pt-10 text-center">
                <div className="flex justify-around items-start">
                    <div className="w-1/3">
                        <div className="border-t border-black w-full mx-auto"></div>
                        <p className="mt-2 text-sm font-semibold">{selectedEmployeeName}</p>
                        <p className="text-xs">Assinatura do Funcionário</p>
                    </div>
                    <div className="w-1/3">
                        <div className="border-t border-black w-full mx-auto"></div>
                        <p className="mt-2 text-sm font-semibold">{selectedSignatoryName}</p>
                        <p className="text-xs">Assinatura do Responsável</p>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-8">Documento gerado por: {geradoPor} em {new Date().toLocaleString('pt-BR')}</p>
            </section>
        </div>
    );
}