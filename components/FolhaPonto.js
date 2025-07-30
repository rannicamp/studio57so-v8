"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle, faInfoCircle, faUserEdit } from '@fortawesome/free-solid-svg-icons';

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
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingCell, setEditingCell] = useState(null);
    const [abonoTypes, setAbonoTypes] = useState([]);
    const [abonosData, setAbonosData] = useState({});

    // ***** INÍCIO DA MODIFICAÇÃO *****
    // Estado para guardar os dados do usuário logado
    const [currentUser, setCurrentUser] = useState(null);
    // ***** FIM DA MODIFICAÇÃO *****

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
    
    const fetchAbonoTypes = useCallback(async () => {
        const { data, error } = await supabase.from('abono_tipos').select('id, descricao');
        if (error) {
            showToast('Erro ao carregar tipos de abono.', 'error');
        } else {
            setAbonoTypes(data);
        }
    }, [supabase]);

    // ***** INÍCIO DA MODIFICAÇÃO *****
    // Função para buscar dados do usuário logado
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
    // ***** FIM DA MODIFICAÇÃO *****

    const loadTimesheetData = useCallback(async () => {
        if (!selectedEmployeeId || !selectedMonth) {
            setTimesheetData({});
            setAbonosData({});
            return;
        }
        setIsProcessing(true);

        const [year, month] = selectedMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        // ***** INÍCIO DA MODIFICAÇÃO: Consulta ao banco foi alterada *****
        // A consulta agora busca as colunas novas e os dados do usuário que editou
        const { data: pontosData, error: pontosError } = await supabase
            .from('pontos')
            .select('*, editado_por_usuario_id:usuarios(nome, sobrenome)') // Pega dados do usuário relacionado
            .eq('funcionario_id', selectedEmployeeId)
            .gte('data_hora', `${startDate}T00:00:00`)
            .lte('data_hora', `${endDate}T23:59:59`);
        // ***** FIM DA MODIFICAÇÃO *****
        
        if (pontosError) {
            showToast("Erro ao carregar dados do ponto.", 'error');
            setIsProcessing(false);
            return;
        }
        
        const { data: abonosDoMes, error: abonosError } = await supabase.from('abonos').select('*').eq('funcionario_id', selectedEmployeeId).gte('data_abono', startDate).lte('data_abono', endDate);

        if (abonosError) {
            showToast("Erro ao carregar abonos.", 'error');
        } else {
            const processedAbonos = {};
            abonosDoMes.forEach(abono => {
                processedAbonos[abono.data_abono] = abono;
            });
            setAbonosData(processedAbonos);
        }

        // ***** INÍCIO DA MODIFICAÇÃO: Lógica de processamento de dados foi alterada *****
        const processedData = {};
        pontosData.forEach(ponto => {
            if (!ponto.data_hora) return;
            const utcDate = new Date(ponto.data_hora.replace(' ', 'T') + 'Z');
            const localDateStringForGrouping = utcDate.toLocaleDateString('sv-SE');
            const localTimeStringForDisplay = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            if (!processedData[localDateStringForGrouping]) {
                processedData[localDateStringForGrouping] = { dateString: localDateStringForGrouping, observacoes: [] };
            }
            
            const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
            const field = fieldMap[ponto.tipo_registro];
            if(field) {
                processedData[localDateStringForGrouping][field] = localTimeStringForDisplay;
                
                // Guarda a informação se o campo foi editado manualmente
                if (ponto.editado_manualmente && ponto.editado_por_usuario_id) {
                    processedData[localDateStringForGrouping][`${field}_manual`] = true;
                    const editorNome = `${ponto.editado_por_usuario_id.nome || ''} ${ponto.editado_por_usuario_id.sobrenome || ''}`.trim();
                    const obsText = `Campo "${ponto.tipo_registro}" editado por ${editorNome}.`;
                    // Evita duplicar a mesma observação de edição
                    if (!processedData[localDateStringForGrouping].observacoes.includes(obsText)) {
                        processedData[localDateStringForGrouping].observacoes.push(obsText);
                    }
                }
            }
            
            // Adiciona a observação original do ponto, se houver
            if(ponto.observacao) {
                 if (!processedData[localDateStringForGrouping].observacoes.includes(ponto.observacao)) {
                    processedData[localDateStringForGrouping].observacoes.push(ponto.observacao);
                }
            }
        });

        // Junta todas as observações em um único texto
        Object.keys(processedData).forEach(date => {
            processedData[date].observacao_final = processedData[date].observacoes.join(' | ');
        });
        // ***** FIM DA MODIFICAÇÃO *****
        
        setTimesheetData(processedData);
        await fetchHolidays(year);
        setIsProcessing(false);

    }, [selectedEmployeeId, selectedMonth, supabase, fetchHolidays]);

    // Efeitos de carregamento inicial
    useEffect(() => { loadTimesheetData(); }, [selectedEmployeeId, selectedMonth, loadTimesheetData]);

    useEffect(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
        const currentDay = String(today.getDate()).padStart(2, '0');
        setSelectedMonth(`${currentYear}-${currentMonth}`);
        setSelectedDate(`${currentYear}-${currentMonth}-${currentDay}`);
        
        fetchAbonoTypes();
        // ***** INÍCIO DA MODIFICAÇÃO *****
        // Busca os dados do usuário logado ao carregar a página
        fetchCurrentUser();
        // ***** FIM DA MODIFICAÇÃO *****
    }, [fetchAbonoTypes, fetchCurrentUser]);

    // Resumo mensal
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

    // Ações de registro de ponto (botões)
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

        // ***** INÍCIO DA MODIFICAÇÃO: Registro de ponto agora marca como não-manual *****
        const recordToSave = {
            funcionario_id: selectedEmployeeId,
            data_hora: localDate.toISOString(),
            tipo_registro: actionType,
            observacao: `Registro via botão`,
            editado_manualmente: false, // Registros via botão não são manuais
            editado_por_usuario_id: null
        };
        // ***** FIM DA MODIFICAÇÃO *****

        const startOfDay = `${selectedDate}T00:00:00`;
        const endOfDay = `${selectedDate}T23:59:59.999`;

        // Upsert para inserir ou atualizar o registro do dia para aquele tipo
        const { error } = await supabase
            .from('pontos')
            .upsert(recordToSave, {
                onConflict: 'funcionario_id, tipo_registro, date(data_hora)',
                ignoreDuplicates: false
            });

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

    // ***** INÍCIO DA MODIFICAÇÃO: Função de salvar foi refatorada *****
    const handleSaveEdit = async (e, date, field) => {
        e.preventDefault();
        if (!currentUser) {
            showToast("Não foi possível identificar o usuário. A edição não foi salva.", "error");
            return;
        }

        let newValue = e.target.elements[0].value;
        setEditingCell(null);
        setIsProcessing(true);

        // Lógica para salvar horários
        const tipo_registro = { 'entrada': 'Entrada', 'inicio_intervalo': 'Inicio_Intervalo', 'fim_intervalo': 'Fim_Intervalo', 'saida': 'Saida' }[field];

        if (!tipo_registro) { // Se não for um campo de horário, como abono ou obs. (tratado separadamente se necessário)
            setIsProcessing(false);
            return;
        }

        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59.999`;

        if (!newValue) { // Deletar se o campo for limpo
            const { error } = await supabase.from('pontos')
                .delete()
                .eq('funcionario_id', selectedEmployeeId)
                .eq('tipo_registro', tipo_registro)
                .gte('data_hora', startOfDay)
                .lte('data_hora', endOfDay);
            showToast(error ? `Erro: ${error.message}` : 'Registro removido.', error ? 'error' : 'success');
        
        } else { // Inserir ou atualizar o horário
            const localDate = new Date(`${date}T${newValue}`);
            const record = { 
                funcionario_id: selectedEmployeeId, 
                tipo_registro, 
                data_hora: localDate.toISOString(), 
                editado_manualmente: true, // Marca como editado
                editado_por_usuario_id: currentUser.id // Guarda o ID do editor
            };
            
            const { error } = await supabase
                .from('pontos')
                .upsert(record, { 
                    onConflict: 'funcionario_id, tipo_registro, date(data_hora)',
                    ignoreDuplicates: false 
                });
            showToast(error ? `Erro: ${error.message}` : 'Alteração salva!', error ? 'error' : 'success');
        }
        
        await loadTimesheetData();
        setIsProcessing(false);
    };
    // ***** FIM DA MODIFICAÇÃO *****


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
                                        
                                        {/* ***** INÍCIO DA MODIFICAÇÃO: Lógica de exibição do horário e do marcador ***** */}
                                        {['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'].map(field => (
                                            <td key={field} onClick={() => handleCellEdit(dateString, field)} className="border p-2 text-center cursor-pointer hover:bg-blue-50">
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
                                        {/* ***** FIM DA MODIFICAÇÃO ***** */}

                                        <td className="border p-2 text-center font-semibold">{calculateTotalHours(dayData)}</td>
                                        
                                        {/* Célula de Abono (não foi modificada, mas mantida) */}
                                        <td className="border p-2 text-center min-w-[150px]">
                                             {abonoTypes.find(t => t.id === abonoDoDia?.tipo_abono_id)?.descricao || '--'}
                                        </td>
                                        
                                        {/* ***** INÍCIO DA MODIFICAÇÃO: Exibição da observação final ***** */}
                                        <td className="border p-2 text-left min-w-[250px] text-xs">
                                            {dayData.observacao_final || '--'}
                                        </td>
                                        {/* ***** FIM DA MODIFICAÇÃO ***** */}
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