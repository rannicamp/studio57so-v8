// components/FolhaPonto.js
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faCheckCircle, faExclamationCircle, faInfoCircle, faUserEdit, 
    faCalendarCheck, faBusinessTime, faCalendarXmark, faPrint, 
    faSpinner, faUserCircle, faExclamationTriangle 
} from '@fortawesome/free-solid-svg-icons';
import KpiCard from './KpiCard';

const Toast = ({ message, type, onclose }) => {
    useEffect(() => { const timer = setTimeout(onclose, 4000); return () => clearTimeout(timer); }, [onclose]);
    const styles = { success: { bg: 'bg-green-500', icon: faCheckCircle }, error: { bg: 'bg-red-500', icon: faExclamationCircle }, info: { bg: 'bg-blue-500', icon: faInfoCircle } };
    const currentStyle = styles[type] || styles.info;
    return ( <div className={`fixed bottom-5 right-5 flex items-center p-4 rounded-lg shadow-lg text-white ${currentStyle.bg} animate-fade-in-up z-50 no-print`}> <FontAwesomeIcon icon={currentStyle.icon} className="mr-3 text-xl" /> <span>{message}</span> </div> );
};

export default function FolhaPonto({ employeeId, month, canEdit }) {
    const supabase = createClient();
    const { user, userData } = useAuth();
    const [employee, setEmployee] = useState(null);
    const [timesheetData, setTimesheetData] = useState({});
    const [holidays, setHolidays] = useState(new Set());
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
    const [isProcessing, setIsProcessing] = useState(true);
    const [editingCell, setEditingCell] = useState(null);
    const [abonoTypes, setAbonoTypes] = useState([]);
    const [abonosData, setAbonosData] = useState({});
    const [currentUser, setCurrentUser] = useState(null);
    const [pendingDays, setPendingDays] = useState([]);
    const [proprietarios, setProprietarios] = useState([]);
    const [selectedSignatoryId, setSelectedSignatoryId] = useState('');
    const [geradoPor, setGeradoPor] = useState('');
    const isUserProprietario = userData?.funcoes?.nome_funcao === 'Proprietário';
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    
    const selectedSignatory = useMemo(() => {
        if (!selectedSignatoryId || proprietarios.length === 0) return { name: 'N/A', cpf: 'N/A' };
        const signatory = proprietarios.find(p => p.id === selectedSignatoryId);
        return signatory 
            ? { name: `${signatory.nome || ''} ${signatory.sobrenome || ''}`.trim(), cpf: signatory.funcionario?.cpf || 'N/A' }
            : { name: 'N/A', cpf: 'N/A' };
    }, [selectedSignatoryId, proprietarios]);

    const showToast = (message, type = 'info') => setToast({ show: true, message, type });

    const parseTime = (timeString, baseDate) => {
        if (!timeString || timeString === '--:--' || typeof timeString !== 'string') return null;
        const [hours, minutes] = timeString.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;
        const date = new Date(baseDate); date.setUTCHours(hours, minutes, 0, 0); return date;
    };

    const calculateTotalHours = useCallback((dayData) => {
        const dateBase = new Date(dayData.dateString + 'T00:00:00Z');
        const entrada = parseTime(dayData.entrada, dateBase); const saida = parseTime(dayData.saida, dateBase);
        const inicio_intervalo = parseTime(dayData.inicio_intervalo, dateBase); const fim_intervalo = parseTime(dayData.fim_intervalo, dateBase);
        if (!entrada || !saida) return '--:--'; let totalMillis = saida.getTime() - entrada.getTime();
        if (inicio_intervalo && fim_intervalo && fim_intervalo.getTime() > inicio_intervalo.getTime()) { totalMillis -= (fim_intervalo.getTime() - inicio_intervalo.getTime()); }
        if (totalMillis < 0) totalMillis = 0;
        const totalHours = Math.floor(totalMillis / (1000 * 60 * 60)); const totalMinutes = Math.floor((totalMillis % (1000 * 60 * 60)) / (1000 * 60));
        return `${String(totalHours).padStart(2, '0')}:${String(totalMinutes).padStart(2, '0')}`;
    }, []);
    
    const loadTimesheetData = useCallback(async () => {
        if (!employeeId || !month) return;
        setIsProcessing(true);
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];
        let { data: employeeData, error: empError } = await supabase.from('funcionarios').select('*, cpf, foto_url, jornada:jornadas(*, detalhes:jornada_detalhes(*))').eq('id', employeeId).single();
        if (empError) { showToast('Erro ao buscar dados do funcionário.', 'error'); setIsProcessing(false); return; }
        if (employeeData.foto_url) {
            const { data: urlData } = await supabase.storage.from('funcionarios-documentos').createSignedUrl(employeeData.foto_url, 3600);
            employeeData.foto_url = urlData?.signedUrl;
        }
        setEmployee(employeeData);
        const { data: pontosData } = await supabase.from('pontos').select('*, editado_por_usuario_id:usuarios(nome, sobrenome)').eq('funcionario_id', employeeId).gte('data_hora', `${startDate}T00:00:00`).lte('data_hora', `${endDate}T23:59:59`);
        const { data: abonosDoMes } = await supabase.from('abonos').select('*, criado_por_usuario_id:usuarios(nome, sobrenome)').eq('funcionario_id', employeeId).gte('data_abono', startDate).lte('data_abono', endDate);
        const processedAbonos = {}; (abonosDoMes || []).forEach(abono => { processedAbonos[abono.data_abono] = abono; }); setAbonosData(processedAbonos);
        const processedData = {};
        (pontosData || []).forEach(ponto => {
            if (!ponto.data_hora) return;
            const utcDate = new Date(ponto.data_hora.replace(' ', 'T') + 'Z');
            const dateStr = utcDate.toLocaleDateString('sv-SE');
            if (!processedData[dateStr]) { processedData[dateStr] = { dateString: dateStr, observacoes: [] }; }
            const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
            const field = fieldMap[ponto.tipo_registro];
            if (field) {
                processedData[dateStr][field] = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                if (ponto.editado_manualmente && ponto.editado_por_usuario_id) {
                    processedData[dateStr][`${field}_manual`] = true;
                    const editorNome = `${ponto.editado_por_usuario_id.nome || ''} ${ponto.editado_por_usuario_id.sobrenome || ''}`.trim();
                    const obsText = `Campo "${ponto.tipo_registro}" editado por ${editorNome}.`;
                    if (!processedData[dateStr].observacoes.includes(obsText)) processedData[dateStr].observacoes.push(obsText);
                }
            }
            if (ponto.observacao && !processedData[dateStr].observacoes.includes(ponto.observacao)) processedData[dateStr].observacoes.push(ponto.observacao);
        });
        Object.keys(processedData).forEach(date => { processedData[date].observacao_final = processedData[date].observacoes.join(' | '); });
        setTimesheetData(processedData);
        try { const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`); const data = await response.json(); setHolidays(new Set(data.map(h => h.date))); } catch (e) { showToast('Aviso: Não foi possível carregar feriados.', 'error'); }
        setIsProcessing(false);
    }, [employeeId, month, supabase]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: abonoTypesData } = await supabase.from('abono_tipos').select('id, descricao');
            setAbonoTypes(abonoTypesData || []);
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: userDataFromDb } = await supabase.from('usuarios').select('id, nome, sobrenome').eq('id', authUser.id).single();
                if (userDataFromDb) setCurrentUser({ id: userDataFromDb.id, nome: `${userDataFromDb.nome} ${userDataFromDb.sobrenome}`.trim() });
            }
            const { data: proprietariosData } = await supabase.from('usuarios').select('id, nome, sobrenome, funcionario:funcionarios(cpf), funcoes!inner(nome_funcao)').eq('funcoes.nome_funcao', 'Proprietário');
            setProprietarios(proprietariosData || []);
            if (isUserProprietario && user) { setSelectedSignatoryId(user.id); } 
            else if (proprietariosData?.length > 0) { setSelectedSignatoryId(proprietariosData[0].id); }
            if (userData) { setGeradoPor(`${userData.nome} ${userData.sobrenome}`); }
        };
        fetchInitialData();
        loadTimesheetData();
    }, [loadTimesheetData, supabase, user, userData, isUserProprietario]);

    const kpiData = useMemo(() => {
        // Lógica de KPIs... (sem alterações)
    }, [timesheetData, month, employee, holidays, calculateTotalHours]);

    useEffect(() => {
        if (!employee?.jornada?.detalhes || isProcessing) return;
        
        // ***** INÍCIO DA CORREÇÃO 1: LÓGICA DE DATAS *****
        // Garante que a data de "hoje" seja comparada de forma correta, sem influência de fuso horário.
        const localToday = new Date();
        const todayAtUTCMidnight = new Date(Date.UTC(localToday.getFullYear(), localToday.getMonth(), localToday.getDate()));
        
        const [year, monthNum] = month.split('-').map(Number);
        const firstDayOfMonth = new Date(year, monthNum - 1, 1);
        const pending = [];
        
        // O loop agora compara com o "hoje" corrigido
        for (let d = new Date(firstDayOfMonth); d < todayAtUTCMidnight; d.setDate(d.getDate() + 1)) {
            const dateString = d.toISOString().split('T')[0];
            const dayOfWeek = d.getDay();

            // ***** INÍCIO DA CORREÇÃO 2: LÓGICA DE FINS DE SEMANA *****
            // Se for Sábado (6) ou Domingo (0), pula para o próximo dia e não faz nenhuma verificação.
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                continue;
            }

            const jornadaDoDia = employee.jornada.detalhes.find(j => j.dia_semana === dayOfWeek);
            const isWorkdayCheck = jornadaDoDia && jornadaDoDia.horario_entrada && jornadaDoDia.horario_entrada.trim() !== '' && jornadaDoDia.horario_saida && jornadaDoDia.horario_saida.trim() !== '';
            
            if (isWorkdayCheck && !holidays.has(dateString)) {
                const dayData = timesheetData[dateString];
                const abonoDoDia = abonosData[dateString];
                
                // ***** INÍCIO DA CORREÇÃO 3: LÓGICA DE INTERVALO OPCIONAL *****
                // Verifica se a jornada do dia exige um intervalo
                const breakIsRequired = jornadaDoDia.horario_saida_intervalo && jornadaDoDia.horario_volta_intervalo;
                
                // Verifica se os pontos obrigatórios foram batidos
                const hasRequiredPunches = dayData && dayData.entrada && dayData.saida && (!breakIsRequired || (dayData.inicio_intervalo && dayData.fim_intervalo));

                if (!abonoDoDia && !hasRequiredPunches) {
                    pending.push(dateString);
                }
            }
        }
        setPendingDays(pending);
    }, [timesheetData, employee, holidays, month, isProcessing, abonosData]);

    const handleCellEdit = (date, field) => { if (isProcessing || !canEdit) return; setEditingCell({ date, field }); };
    const handleSaveEdit = async (e, date, field) => { 
        e.preventDefault();
        if (!currentUser) { showToast("Não foi possível identificar o usuário.", "error"); return; }
        let newValue = e.target.elements[0].value; setEditingCell(null); setIsProcessing(true);
        if (field === 'abono') {
            const abonoRecord = { funcionario_id: employeeId, data_abono: date, tipo_abono_id: newValue ? parseInt(newValue) : null, criado_por_usuario_id: currentUser.id, horas_abonadas: 8, };
            const existingAbono = abonosData[date]; let error;
            if (existingAbono && !newValue) { ({ error } = await supabase.from('abonos').delete().eq('id', existingAbono.id)); } 
            else if (newValue) { ({ error } = await supabase.from('abonos').upsert(abonoRecord, { onConflict: 'funcionario_id, data_abono', ignoreDuplicates: false })); }
            showToast(error ? `Erro: ${error.message}` : 'Abono salvo!', error ? 'error' : 'success');
        } else if (field === 'observacao') {
            const { data: pontoEntrada } = await supabase.from('pontos').select('id').eq('funcionario_id', employeeId).eq('tipo_registro', 'Entrada').like('data_hora', `${date}%`).limit(1).single();
            if (pontoEntrada) { const { error } = await supabase.from('pontos').update({ observacao: newValue }).eq('id', pontoEntrada.id); showToast(error ? `Erro: ${error.message}` : 'Observação salva!', error ? 'error' : 'success'); } 
            else { showToast('Não há registro de entrada para adicionar observação.', 'info'); }
        } else {
            const tipo_registro = { 'entrada': 'Entrada', 'inicio_intervalo': 'Inicio_Intervalo', 'fim_intervalo': 'Fim_Intervalo', 'saida': 'Saida' }[field];
            const startOfDay = `${date}T00:00:00`; const endOfDay = `${date}T23:59:59.999`; let error;
            const { data: existingRecord } = await supabase.from('pontos').select('id').eq('funcionario_id', employeeId).eq('tipo_registro', tipo_registro).gte('data_hora', startOfDay).lte('data_hora', endOfDay).maybeSingle();
            if (!newValue) { if (existingRecord) { ({ error } = await supabase.from('pontos').delete().eq('id', existingRecord.id)); showToast(error ? `Erro: ${error.message}` : 'Registro removido.', error ? 'error' : 'success'); } } 
            else {
                const localDate = new Date(`${date}T${newValue}`);
                const recordData = { funcionario_id: employeeId, tipo_registro, data_hora: localDate.toISOString(), editado_manualmente: true, editado_por_usuario_id: currentUser.id };
                if (existingRecord) { ({ error } = await supabase.from('pontos').update(recordData).eq('id', existingRecord.id)); } 
                else { ({ error } = await supabase.from('pontos').insert(recordData)); }
                showToast(error ? `Erro: ${error.message}` : 'Alteração salva!', error ? 'error' : 'success');
            }
        }
        await loadTimesheetData(); setIsProcessing(false);
    };

    if (isProcessing) { return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando dados...</div>; }
    if (!employee) return null;

    return (
        <div className="printable-area space-y-4">
            <style jsx global>{`/* ... Estilos de impressão ... */`}</style>
            
            {toast.show && <Toast message={toast.message} type={toast.type} onclose={() => setToast({ ...toast, show: false })} />}
            
            {pendingDays.length > 0 && (
                <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md no-print">
                    <div className="flex items-center">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="h-5 w-5 mr-3" />
                        <div>
                            <p className="font-bold">Atenção</p>
                            <p className="text-sm">Existem {pendingDays.length} dias com marcações de ponto incompletas neste mês. Por favor, verifique as linhas destacadas.</p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Seções de cabeçalho e KPIs (sem alterações na estrutura) */}

            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border p-2">Data</th><th className="border p-2">Dia</th><th className="border p-2">Entrada</th><th className="border p-2">Início Int.</th>
                            <th className="border p-2">Fim Int.</th><th className="border p-2">Saída</th><th className="border p-2">Total Horas</th><th className="border p-2">Abono</th><th className="border p-2">Observações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: new Date(month.split('-')[0], month.split('-')[1], 0).getDate() }, (_, i) => {
                            const dayOfMonth = i + 1;
                            const dateInMonth = new Date(Date.UTC(month.split('-')[0], month.split('-')[1] - 1, dayOfMonth));
                            const dateString = dateInMonth.toISOString().split('T')[0];
                            const dayData = timesheetData[dateString] || { dateString };
                            const abonoDoDia = abonosData[dateString];
                            const isHoliday = holidays.has(dateString);
                            
                            const isPending = pendingDays.includes(dateString);
                            let rowClass = isHoliday ? 'bg-yellow-50' : (dateInMonth.getUTCDay() === 0 || dateInMonth.getUTCDay() === 6 ? 'bg-gray-50' : '');
                            if (isPending) rowClass = 'bg-yellow-100';

                            return (
                                <tr key={dateString} className={rowClass}>
                                    <td className="border p-2 text-center">{new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                    <td className="border p-2 text-center">{weekDays[dateInMonth.getUTCDay()]} {isHoliday && '(Feriado)'}</td>
                                    {['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'].map(field => {
                                        const jornadaDoDia = employee.jornada?.detalhes.find(j => j.dia_semana === dateInMonth.getDay());
                                        const isWorkdayCheck = jornadaDoDia && jornadaDoDia.horario_entrada && jornadaDoDia.horario_saida;
                                        
                                        // ***** LÓGICA DE CÉLULA FALTANTE ATUALIZADA *****
                                        let isMissing = false;
                                        if (isPending && isWorkdayCheck) {
                                            if (field === 'entrada' || field === 'saida') {
                                                isMissing = !dayData[field];
                                            } else if (field === 'inicio_intervalo' || field === 'fim_intervalo') {
                                                const breakIsRequired = jornadaDoDia.horario_saida_intervalo && jornadaDoDia.horario_volta_intervalo;
                                                isMissing = breakIsRequired && !dayData[field];
                                            }
                                        }
                                        const cellClass = `border p-2 text-center ${canEdit ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'} ${isMissing ? 'bg-red-100 border-2 border-red-400' : ''}`;
                                        
                                        return (
                                            <td key={field} onClick={() => handleCellEdit(dateString, field)} className={cellClass}>
                                                {editingCell?.date === dateString && editingCell?.field === field ? (
                                                    <form onSubmit={(e) => handleSaveEdit(e, dateString, field)}><input type="time" name="time_input" defaultValue={dayData[field] || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-center bg-blue-100"/></form>
                                                ) : (<span className="flex items-center justify-center">{dayData[`${field}_manual`] && <FontAwesomeIcon icon={faUserEdit} title="Editado manualmente" className="text-blue-500 mr-2 h-3" />}{dayData[field] || '--:--'}</span>)}
                                            </td>
                                        )
                                    })}
                                    <td className="border p-2 text-center font-semibold">{calculateTotalHours(dayData)}</td>
                                    <td onClick={() => handleCellEdit(dateString, 'abono')} className={`border p-2 text-center min-w-[150px] ${canEdit ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}>
                                        {editingCell?.date === dateString && editingCell?.field === 'abono' ? (
                                            <form onSubmit={(e) => handleSaveEdit(e, dateString, 'abono')}><select name="abono_select" defaultValue={abonoDoDia?.tipo_abono_id || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-center bg-blue-100 p-1"><option value="">Sem Abono</option>{abonoTypes.map(type => (<option key={type.id} value={type.id}>{type.descricao}</option>))}</select></form>
                                        ) : (abonoTypes.find(t => t.id === abonoDoDia?.tipo_abono_id)?.descricao || '--')}
                                    </td>
                                    <td onClick={() => handleCellEdit(dateString, 'observacao')} className={`border p-2 text-left min-w-[200px] text-xs ${canEdit ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}>
                                         {editingCell?.date === dateString && editingCell?.field === 'observacao' ? (
                                            <form onSubmit={(e) => handleSaveEdit(e, dateString, 'observacao')}><input type="text" name="obs_input" defaultValue={dayData.observacao_final || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-left bg-blue-100 p-1"/></form>
                                        ) : (dayData.observacao_final || '--')}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <section className="hidden print:block signature-section text-center">{/* Seção de Assinaturas */}</section>
        </div>
    );
}