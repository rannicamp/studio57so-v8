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
    useEffect(() => {
        const timer = setTimeout(onclose, 4000);
        return () => clearTimeout(timer);
    }, [onclose]);

    const styles = {
        success: { bg: 'bg-green-500', icon: faCheckCircle },
        error: { bg: 'bg-red-500', icon: faExclamationCircle },
        info: { bg: 'bg-blue-500', icon: faInfoCircle }
    };
    const currentStyle = styles[type] || styles.info;

    return (
        <div className={`fixed bottom-5 right-5 flex items-center p-4 rounded-lg shadow-lg text-white ${currentStyle.bg} animate-fade-in-up z-50 no-print`}>
            <FontAwesomeIcon icon={currentStyle.icon} className="mr-3 text-xl" />
            <span>{message}</span>
        </div>
    );
};

export default function FolhaPonto({ employeeId, month, canEdit }) {
    const supabase = createClient();
    const { user, userData } = useAuth();
    
    const [employee, setEmployee] = useState(null);
    const [calendarDays, setCalendarDays] = useState([]);
    const [kpis, setKpis] = useState({ dias: '0 / 0', horas: '00:00h / 00:00h', faltas: 0 });
    const [pendingDaysCount, setPendingDaysCount] = useState(0);

    const [abonoTypes, setAbonoTypes] = useState([]);
    const [proprietarios, setProprietarios] = useState([]);
    const [selectedSignatoryId, setSelectedSignatoryId] = useState('');
    
    const [isProcessing, setIsProcessing] = useState(true);
    const [editingCell, setEditingCell] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

    const isUserProprietario = userData?.funcoes?.nome_funcao === 'Proprietário';
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    
    const showToast = (message, type = 'info') => setToast({ show: true, message, type });

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

    const isWorkDay = (date, jornadaDetalhes, holidays) => {
        const dateString = date.toISOString().split('T')[0];
        if (holidays.has(dateString)) return false;

        const dayOfWeek = date.getUTCDay();
        const jornadaDoDia = jornadaDetalhes.find(j => j.dia_semana === dayOfWeek);

        return (
            jornadaDoDia &&
            jornadaDoDia.horario_entrada && jornadaDoDia.horario_entrada.trim() !== '' &&
            jornadaDoDia.horario_saida && jornadaDoDia.horario_saida.trim() !== ''
        );
    };

    const loadData = useCallback(async () => {
        if (!employeeId || !month) return;
        setIsProcessing(true);

        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

        try {
            const [
                { data: employeeData, error: empError },
                { data: pontosData },
                { data: abonosDoMes },
                { data: abonoTypesData },
                { data: proprietariosData },
                holidaysResponse
            ] = await Promise.all([
                supabase.from('funcionarios').select('*, cpf, foto_url, jornada:jornadas(*, detalhes:jornada_detalhes(*))').eq('id', employeeId).single(),
                supabase.from('pontos').select('*, editado_por_usuario_id:usuarios(nome, sobrenome)').eq('funcionario_id', employeeId).gte('data_hora', `${startDate}T00:00:00`).lte('data_hora', `${endDate}T23:59:59`),
                supabase.from('abonos').select('*, criado_por_usuario_id:usuarios(nome, sobrenome)').eq('funcionario_id', employeeId).gte('data_abono', startDate).lte('data_abono', endDate),
                supabase.from('abono_tipos').select('id, descricao'),
                supabase.from('usuarios').select('id, nome, sobrenome, funcionario:funcionarios(cpf), funcoes!inner(nome_funcao)').eq('funcoes.nome_funcao', 'Proprietário'),
                fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`)
            ]);

            if (empError) throw new Error('Erro ao buscar dados do funcionário.');
            
            if (employeeData.foto_url) {
                const { data: urlData } = await supabase.storage.from('funcionarios-documentos').createSignedUrl(employeeData.foto_url, 3600);
                employeeData.foto_url = urlData?.signedUrl;
            }
            setEmployee(employeeData);
            setAbonoTypes(abonoTypesData || []);
            setProprietarios(proprietariosData || []);
            if (isUserProprietario && user) { setSelectedSignatoryId(user.id); }
            else if (proprietariosData?.length > 0) { setSelectedSignatoryId(proprietariosData[0].id); }

            const holidaysData = holidaysResponse.ok ? await holidaysResponse.json() : [];
            const holidaysSet = new Set(holidaysData.map(h => h.date));

            const processedPontos = (pontosData || []).reduce((acc, ponto) => {
                const utcDate = new Date(ponto.data_hora.replace(' ', 'T') + 'Z');
                const dateStr = utcDate.toLocaleDateString('sv-SE');
                if (!acc[dateStr]) acc[dateStr] = { dateString: dateStr, observacoes: [] };
                const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
                const field = fieldMap[ponto.tipo_registro];
                if (field) {
                    acc[dateStr][field] = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    if (ponto.editado_manualmente && ponto.editado_por_usuario_id) {
                        acc[dateStr][`${field}_manual`] = true;
                        const editorNome = `${ponto.editado_por_usuario_id.nome || ''} ${ponto.editado_por_usuario_id.sobrenome || ''}`.trim();
                        const obsText = `Campo "${ponto.tipo_registro}" editado por ${editorNome}.`;
                        if (!acc[dateStr].observacoes.includes(obsText)) acc[dateStr].observacoes.push(obsText);
                    }
                }
                if (ponto.observacao && !acc[dateStr].observacoes.includes(ponto.observacao)) acc[dateStr].observacoes.push(ponto.observacao);
                return acc;
            }, {});
            
            const processedAbonos = (abonosDoMes || []).reduce((acc, abono) => {
                acc[abono.data_abono] = abono;
                return acc;
            }, {});

            const daysInMonth = new Date(year, monthNum, 0).getDate();
            const today = new Date(); today.setHours(0,0,0,0);
            let pendingCount = 0;
            
            const calendar = Array.from({ length: daysInMonth }, (_, i) => {
                const dayOfMonth = i + 1;
                const dateInMonth = new Date(Date.UTC(year, monthNum - 1, dayOfMonth));
                const dateString = dateInMonth.toISOString().split('T')[0];
                const dayData = processedPontos[dateString] || { dateString: dateString };
                const abonoDoDia = processedAbonos[dateString];
                const jornadaDetalhes = employeeData.jornada?.detalhes || [];
                const isWorkday = isWorkDay(dateInMonth, jornadaDetalhes, holidaysSet);
                const isPastOrToday = dateInMonth <= today;
                const jornadaDoDia = jornadaDetalhes.find(j => j.dia_semana === dateInMonth.getUTCDay());
                const breakIsRequired = jornadaDoDia && jornadaDoDia.horario_saida_intervalo && jornadaDoDia.horario_volta_intervalo;
                const hasRequiredPunches = dayData.entrada && dayData.saida && (!breakIsRequired || (dayData.inicio_intervalo && dayData.fim_intervalo));
                const isPending = isWorkday && isPastOrToday && !hasRequiredPunches && !abonoDoDia;
                if (isPending) pendingCount++;

                return {
                    dateString, date: dateInMonth, dayOfMonth,
                    dayOfWeek: weekDays[dateInMonth.getUTCDay()],
                    isHoliday: holidaysSet.has(dateString),
                    isWorkday, isPending, breakIsRequired,
                    punchData: { ...dayData, totalHoras: calculateTotalHours(dayData), observacao_final: dayData.observacoes?.join(' | ') || '' },
                    abonoData: abonoDoDia,
                };
            });
            
            setCalendarDays(calendar);
            setPendingDaysCount(pendingCount);

        } catch (error) {
            showToast(error.message, 'error');
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    }, [employeeId, month, supabase, calculateTotalHours, user, userData, isUserProprietario]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (!employee || calendarDays.length === 0) return;
        const today = new Date();
        const [year, monthNum] = month.split('-').map(Number);
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthNum - 1;
        const limitDate = isCurrentMonth ? today : new Date(year, monthNum, 0);
        let diasUteisNoPeriodo = 0, cargaHorariaEsperadaMinutos = 0, diasTrabalhados = 0, totalMinutosTrabalhados = 0;
        calendarDays.forEach(day => {
            if (day.date <= limitDate) {
                if (day.isWorkday) {
                    diasUteisNoPeriodo++;
                    const jornadaDoDia = employee.jornada.detalhes.find(j => j.dia_semana === day.date.getUTCDay());
                    if (jornadaDoDia) {
                        const entrada = parseTime(jornadaDoDia.horario_entrada, day.date) || 0;
                        const saida = parseTime(jornadaDoDia.horario_saida, day.date) || 0;
                        const inicioIntervalo = parseTime(jornadaDoDia.horario_saida_intervalo, day.date) || 0;
                        const fimIntervalo = parseTime(jornadaDoDia.horario_volta_intervalo, day.date) || 0;
                        if(saida > entrada) {
                            let minutosTrabalho = (saida - entrada) / 60000;
                            if (fimIntervalo > inicioIntervalo) { minutosTrabalho -= (fimIntervalo - inicioIntervalo) / 60000; }
                            cargaHorariaEsperadaMinutos += minutosTrabalho;
                        }
                    }
                }
            }
            if (day.punchData.totalHoras !== '--:--') {
                diasTrabalhados++;
                const [hours, minutes] = day.punchData.totalHoras.split(':').map(Number);
                totalMinutosTrabalhados += (hours * 60) + minutes;
            }
        });
        const cargaHorariaEsperadaFmt = `${Math.floor(cargaHorariaEsperadaMinutos / 60)}:${String(Math.round(cargaHorariaEsperadaMinutos % 60)).padStart(2, '0')}h`;
        const horasTrabalhadasFmt = `${Math.floor(totalMinutosTrabalhados / 60)}:${String(Math.round(totalMinutosTrabalhados % 60)).padStart(2, '0')}h`;
        const faltas = Math.max(0, diasUteisNoPeriodo - diasTrabalhados - calendarDays.filter(d => d.date <= limitDate && d.abonoData).length);
        setKpis({ dias: `${diasTrabalhados} / ${diasUteisNoPeriodo}`, horas: `${horasTrabalhadasFmt} / ${cargaHorariaEsperadaFmt}`, faltas });
    }, [calendarDays, employee, month]);

    const handleCellEdit = (date, field) => { if (isProcessing || !canEdit) return; setEditingCell({ date, field }); };
    const handleSaveEdit = async (e, date, field) => { 
        e.preventDefault();
        const newValue = e.target.elements[0].value;
        setEditingCell(null);
        if (!user) { showToast("Não foi possível identificar o usuário.", "error"); return; }
        setIsProcessing(true);
        let error = null;
        if (field === 'abono') {
            const abonoRecord = { funcionario_id: employeeId, data_abono: date, tipo_abono_id: newValue ? parseInt(newValue) : null, criado_por_usuario_id: user.id, horas_abonadas: 8 };
            const existingAbono = calendarDays.find(d => d.dateString === date)?.abonoData;
            if (existingAbono && !newValue) { ({ error } = await supabase.from('abonos').delete().eq('id', existingAbono.id));
            } else if (newValue) { ({ error } = await supabase.from('abonos').upsert(abonoRecord, { onConflict: 'funcionario_id, data_abono' })); }
        } else if (field === 'observacao') {
             const { data: pontoEntrada } = await supabase.from('pontos').select('id').eq('funcionario_id', employeeId).eq('tipo_registro', 'Entrada').like('data_hora', `${date}%`).limit(1).single();
             if (pontoEntrada) { ({ error } = await supabase.from('pontos').update({ observacao: newValue }).eq('id', pontoEntrada.id)); }
             else { showToast('Não há registro de entrada para adicionar observação.', 'info'); }
        } else {
            const tipo_registro = { 'entrada': 'Entrada', 'inicio_intervalo': 'Inicio_Intervalo', 'fim_intervalo': 'Fim_Intervalo', 'saida': 'Saida' }[field];
            const { data: existingRecord } = await supabase.from('pontos').select('id').eq('funcionario_id', employeeId).eq('tipo_registro', tipo_registro).like('data_hora', `${date}%`).maybeSingle();
            if (!newValue) { if (existingRecord) ({ error } = await supabase.from('pontos').delete().eq('id', existingRecord.id));
            } else {
                const recordData = { funcionario_id: employeeId, tipo_registro, data_hora: new Date(`${date}T${newValue}`).toISOString(), editado_manualmente: true, editado_por_usuario_id: user.id };
                if (existingRecord) { ({ error } = await supabase.from('pontos').update(recordData).eq('id', existingRecord.id)); }
                else { ({ error } = await supabase.from('pontos').insert(recordData)); }
            }
        }
        showToast(error ? `Erro: ${error.message}` : 'Alteração salva!', error ? 'error' : 'success');
        await loadData();
    };
    
    const geradoPor = `${userData?.nome || ''} ${userData?.sobrenome || ''}`.trim();
    const selectedSignatory = useMemo(() => {
        if (!selectedSignatoryId || proprietarios.length === 0) return { name: 'N/A', cpf: 'N/A' };
        const signatory = proprietarios.find(p => p.id === selectedSignatoryId);
        return signatory ? { name: `${signatory.nome || ''} ${signatory.sobrenome || ''}`.trim(), cpf: signatory.funcionario?.cpf || 'N/A' } : { name: 'N/A', cpf: 'N/A' };
    }, [selectedSignatoryId, proprietarios]);

    if (isProcessing && !employee) { return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando dados...</div>; }
    if (!employee) { return <div className="text-center p-10 bg-yellow-50 text-yellow-800 rounded-lg">Selecione um funcionário e um mês para continuar.</div>; }

    return (
        <div className="printable-area space-y-4">
            <style jsx global>{`
                @media print {
                    @page { size: A4 portrait; margin: 0.8cm; }
                    body * { visibility: hidden; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; border: none !important; box-shadow: none !important; }
                    .no-print { display: none !important; }
                    .print-header { display: block !important; }
                    .print-header-info h3 { font-size: 1.1rem !important; }
                    .kpi-container-on-print { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.5rem; font-size: 8pt; border: 1px solid #eee; padding: 4px; border-radius: 6px; }
                    table { font-size: 7.5pt !important; width: 100%; border-collapse: collapse !important; margin-top: 0.5rem; }
                    th, td { border: 1px solid #ccc !important; padding: 2px !important; text-align: center; }
                    .signature-section { margin-top: 1.5cm !important; page-break-inside: avoid; }
                }
            `}</style>
            
            {toast.show && <Toast message={toast.message} type={toast.type} onclose={() => setToast({ ...toast, show: false })} />}
            
            {pendingDaysCount > 0 && (
                <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md no-print">
                    <div className="flex items-center">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="h-5 w-5 mr-3" />
                        <div>
                            <p className="font-bold">Atenção</p>
                            <p className="text-sm">Existem {pendingDaysCount} dias com marcações de ponto incompletas neste mês. Por favor, verifique as linhas destacadas.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="print-header hidden">
                 <div className="flex flex-row gap-4 items-center border-b pb-2 mb-2">
                    {employee.foto_url ? ( <img src={employee.foto_url} alt="Foto" className="w-16 h-16 rounded-full object-cover" /> ) : ( <FontAwesomeIcon icon={faUserCircle} className="w-16 h-16 text-gray-300" /> )}
                    <div className="flex-grow text-left print-header-info">
                        <h3 className="font-bold">{employee.full_name}</h3>
                        <p className="text-sm">{employee.contract_role}</p>
                        <p className="text-xs text-gray-600">Mês de Referência: {new Date(month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
                 <div className="kpi-container-on-print">
                    <div><p className="font-semibold">Dias (Trab. / Úteis):</p><p>{kpis.dias}</p></div>
                    <div><p className="font-semibold">Horas (Trab. / Prev.):</p><p>{kpis.horas}</p></div>
                    <div><p className="font-semibold">Faltas (no período):</p><p>{kpis.faltas}</p></div>
                 </div>
            </div>

            <section className="bg-gray-100 p-4 rounded-lg shadow-inner no-print">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <KpiCard title="Dias (Trab. / Úteis)" value={kpis.dias} icon={faCalendarCheck} color="blue" />
                    <KpiCard title="Horas (Trab. / Prev.)" value={kpis.horas} icon={faBusinessTime} color="green" />
                    <KpiCard title="Faltas (no período)" value={kpis.faltas} icon={faCalendarXmark} color="red" />
                </div>
            </section>
            
            <div className='no-print flex justify-end items-center gap-2'>
                {!isUserProprietario && (
                     <select value={selectedSignatoryId} onChange={(e) => setSelectedSignatoryId(e.target.value)} className="p-2 border rounded-md text-sm">
                        <option value="">Assinatura do Responsável</option>
                        {proprietarios.map(p => <option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>)}
                     </select>
                )}
                 <button onClick={() => window.print()} className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800">
                    <FontAwesomeIcon icon={faPrint} /> Imprimir
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border p-2">Data</th><th className="border p-2">Dia</th><th className="border p-2">Entrada</th><th className="border p-2">Início Int.</th>
                            <th className="border p-2">Fim Int.</th><th className="border p-2">Saída</th><th className="border p-2">Total Horas</th><th className="border p-2">Abono</th><th className="border p-2">Observações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {calendarDays.map((day) => {
                            const { dateString, date, dayOfWeek, isHoliday, isPending, punchData, abonoData, breakIsRequired } = day;
                            
                            let rowClass = isHoliday ? 'bg-yellow-50' : (date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 'bg-gray-50' : '');
                            if (isPending) rowClass = 'bg-yellow-100';

                            return (
                                <tr key={dateString} className={rowClass}>
                                    <td className="border p-2 text-center">{new Date(dateString + 'T00:00:00Z').toLocaleDateString('pt-BR')}</td>
                                    <td className="border p-2 text-center">{dayOfWeek} {isHoliday && '(Feriado)'}</td>
                                    {['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'].map(field => {
                                        let isMissing = false;
                                        if (isPending) {
                                            if (field === 'entrada' || field === 'saida') {
                                                isMissing = !punchData[field];
                                            } else if (field === 'inicio_intervalo' || field === 'fim_intervalo') {
                                                isMissing = breakIsRequired && !punchData[field];
                                            }
                                        }
                                        const cellClass = `border p-2 text-center ${canEdit ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'} ${isMissing ? 'bg-red-100 border-2 border-red-400' : ''}`;
                                        
                                        return (
                                            <td key={field} onClick={() => handleCellEdit(dateString, field)} className={cellClass}>
                                                {editingCell?.date === dateString && editingCell?.field === field ? (
                                                    <form onSubmit={(e) => handleSaveEdit(e, dateString, field)}><input type="time" name="time_input" defaultValue={punchData[field] || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-center bg-blue-100"/></form>
                                                ) : (<span className="flex items-center justify-center">{punchData[`${field}_manual`] && <FontAwesomeIcon icon={faUserEdit} title="Editado manualmente" className="text-blue-500 mr-2 h-3" />}{punchData[field] || '--:--'}</span>)}
                                            </td>
                                        )
                                    })}
                                    <td className="border p-2 text-center font-semibold">{punchData.totalHoras}</td>
                                    <td onClick={() => handleCellEdit(dateString, 'abono')} className={`border p-2 text-center min-w-[150px] ${canEdit ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}>
                                        {editingCell?.date === dateString && editingCell?.field === 'abono' ? (
                                            <form onSubmit={(e) => handleSaveEdit(e, dateString, 'abono')}><select name="abono_select" defaultValue={abonoData?.tipo_abono_id || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-center bg-blue-100 p-1"><option value="">Sem Abono</option>{abonoTypes.map(type => (<option key={type.id} value={type.id}>{type.descricao}</option>))}</select></form>
                                        ) : (abonoTypes.find(t => t.id === abonoData?.tipo_abono_id)?.descricao || '--')}
                                    </td>
                                    <td onClick={() => handleCellEdit(dateString, 'observacao')} className={`border p-2 text-left min-w-[200px] text-xs ${canEdit ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}>
                                         {editingCell?.date === dateString && editingCell?.field === 'observacao' ? (
                                            <form onSubmit={(e) => handleSaveEdit(e, dateString, 'observacao')}><input type="text" name="obs_input" defaultValue={punchData.observacao_final || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-left bg-blue-100 p-1"/></form>
                                        ) : (punchData.observacao_final || '--')}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <section className="hidden print:block signature-section text-center">
                <div className="flex justify-around items-start">
                    <div className="w-2/5">
                        <div className="border-t border-black w-full mx-auto"></div>
                        <p className="mt-2 text-sm font-semibold">{employee.full_name}</p>
                        <p className="text-xs">CPF: {employee.cpf || 'N/A'}</p>
                    </div>
                    <div className="w-2/5">
                        <div className="border-t border-black w-full mx-auto"></div>
                        <p className="mt-2 text-sm font-semibold">{selectedSignatory.name}</p>
                        <p className="text-xs">CPF: {selectedSignatory.cpf || 'N/A'}</p>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-8">Documento gerado por: {geradoPor} em {new Date().toLocaleString('pt-BR')}</p>
            </section>
        </div>
    );
}