"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner, faPrint, faUserEdit, faCalendarCheck, faBusinessTime, faCalendarXmark, faCheckCircle, faTimesCircle, faFilePdf, faFileImage, faFileWord, faFile, faUpload, faEye, faTrash, faFileLines } from '@fortawesome/free-solid-svg-icons';

// Componente de KPI Compacto
const KpiCompacto = ({ title, value, icon, colorClass = 'text-gray-700' }) => (
    <div className="flex items-center p-3 bg-gray-50 border rounded-lg">
        <FontAwesomeIcon icon={icon} className={`w-6 h-6 mr-3 ${colorClass}`} />
        <div>
            <p className="text-xs text-gray-500 font-semibold">{title}</p>
            <p className="text-lg font-bold text-gray-800">{value}</p>
        </div>
    </div>
);


export default function RelatorioPonto({ employee, pontosDoMes, abonosDoMes, selectedMonth, canEdit, onDataChange }) {
    const supabase = createClient();
    const { user, userData } = useAuth();

    const [timesheetData, setTimesheetData] = useState({});
    const [holidays, setHolidays] = useState(new Set());
    const [abonosData, setAbonosData] = useState({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingCell, setEditingCell] = useState(null);
    const [abonoTypes, setAbonoTypes] = useState([]);
    
    const [proprietarios, setProprietarios] = useState([]);
    const [selectedSignatoryId, setSelectedSignatoryId] = useState('');
    const [geradoPor, setGeradoPor] = useState('');
    const isUserProprietario = userData?.funcoes?.nome_funcao === 'Proprietário';

    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: abonoTypesData } = await supabase.from('abono_tipos').select('id, descricao');
            setAbonoTypes(abonoTypesData || []);

            const { data: proprietariosData } = await supabase.from('usuarios').select('id, nome, sobrenome, funcoes!inner(nome_funcao)').eq('funcoes.nome_funcao', 'Proprietário');
            setProprietarios(proprietariosData || []);

            if (isUserProprietario) {
                setSelectedSignatoryId(user.id);
            } else if (proprietariosData && proprietariosData.length > 0) {
                setSelectedSignatoryId(proprietariosData[0].id);
            }
        };
        fetchInitialData();
        if (userData) {
            setGeradoPor(`${userData.nome} ${userData.sobrenome}`);
        }
    }, [supabase, user, userData, isUserProprietario]);

    const handlePrint = () => { window.print(); };

    const selectedEmployeeName = employee.full_name || 'N/A';
    const selectedSignatoryName = proprietarios.find(p => p.id == selectedSignatoryId)?.nome + ' ' + (proprietarios.find(p => p.id == selectedSignatoryId)?.sobrenome || '') || 'N/A';

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

    useEffect(() => {
        const processData = async () => {
            setIsProcessing(true);
            const [year] = selectedMonth.split('-');
            
            const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
            if (response.ok) {
                const data = await response.json();
                setHolidays(new Set(data.map(h => h.date)));
            }

            const processedPontos = {};
            pontosDoMes.forEach(ponto => {
                if (!ponto.data_hora) return;
                const utcDate = new Date(ponto.data_hora.replace(' ', 'T') + 'Z');
                const dateStr = utcDate.toLocaleDateString('sv-SE');
                if (!processedPontos[dateStr]) { processedPontos[dateStr] = { dateString: dateStr }; }
                const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
                processedPontos[dateStr][fieldMap[ponto.tipo_registro]] = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            });
            setTimesheetData(processedPontos);

            const processedAbonos = {};
            abonosDoMes.forEach(abono => { processedAbonos[abono.data_abono] = abono; });
            setAbonosData(processedAbonos);

            setIsProcessing(false);
        };
        processData();
    }, [pontosDoMes, abonosDoMes, selectedMonth]);

    const kpiData = useMemo(() => {
        if (!selectedMonth) return { dias: '0 / 0', horas: '00:00h / 00:00h', faltas: 0 };
        const today = new Date();
        const [year, month] = selectedMonth.split('-').map(Number);
        const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
        const isCurrentMonth = today.getUTCFullYear() === year && today.getUTCMonth() === month - 1;
        const limitDate = isCurrentMonth ? today : lastDayOfMonth;

        let diasUteisAteHoje = 0;
        let cargaHorariaEsperadaMinutos = 0;
        const jornadaDetalhes = employee.jornada?.detalhes || [];

        if (jornadaDetalhes.length > 0) {
            for (let d = new Date(firstDayOfMonth); d <= limitDate; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getUTCDay();
                const dateString = d.toISOString().split('T')[0];
                if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateString)) {
                    diasUteisAteHoje++;
                    const jornadaDoDia = jornadaDetalhes.find(j => j.dia_semana === dayOfWeek);
                    if (jornadaDoDia) {
                        const entrada = jornadaDoDia.horario_entrada?.split(':').map(Number) || [0,0];
                        const saida = jornadaDoDia.horario_saida?.split(':').map(Number) || [0,0];
                        const inicioIntervalo = jornadaDoDia.horario_saida_intervalo?.split(':').map(Number) || [0,0];
                        const fimIntervalo = jornadaDoDia.horario_volta_intervalo?.split(':').map(Number) || [0,0];
                        const minutosTrabalho = (saida[0]*60 + saida[1]) - (entrada[0]*60 + entrada[1]);
                        const minutosIntervalo = (fimIntervalo[0]*60 + fimIntervalo[1]) - (inicioIntervalo[0]*60 + inicioIntervalo[1]);
                        cargaHorariaEsperadaMinutos += minutosTrabalho - (minutosIntervalo > 0 ? minutosIntervalo : 0);
                    }
                }
            }
        }
        const cargaHorariaEsperadaFormatada = `${Math.floor(cargaHorariaEsperadaMinutos / 60)}:${String(cargaHorariaEsperadaMinutos % 60).padStart(2, '0')}h`;
        const diasTrabalhados = Object.keys(timesheetData).length;
        let totalMinutosTrabalhados = 0;
        Object.values(timesheetData).forEach(dayData => {
            const totalDayStr = calculateTotalHours(dayData);
            if (totalDayStr !== '--:--') {
                const [hours, minutes] = totalDayStr.split(':').map(Number);
                totalMinutosTrabalhados += (hours * 60) + minutes;
            }
        });
        const horasTrabalhadasFormatada = `${Math.floor(totalMinutosTrabalhados / 60)}:${String(Math.round(totalMinutosTrabalhados % 60)).padStart(2, '0')}h`;
        const faltas = Math.max(0, diasUteisAteHoje - diasTrabalhados);
        return { dias: `${diasTrabalhados} / ${diasUteisAteHoje}`, horas: `${horasTrabalhadasFormatada} / ${cargaHorariaEsperadaFormatada}`, faltas };
    }, [timesheetData, selectedMonth, employee.jornada, holidays, calculateTotalHours]);

    return (
        <div className="printable-area bg-white p-6 rounded-lg shadow-md space-y-4">
            {/* ***** INÍCIO DA CORREÇÃO FINAL ***** */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 1cm;
                    }
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area {
                        position: absolute; left: 0; top: 0; width: 100%;
                        padding: 0 !important; margin: 0 !important;
                        border: none !important; box-shadow: none !important;
                    }
                    .no-print { display: none !important; }
                    .print-header-name { font-size: 1rem !important; font-weight: bold; }
                    .kpi-container-print { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.5rem !important; }
                    .kpi-compacto-print { border: 1px solid #eee; padding: 4px; }
                    .kpi-compacto-print p { font-size: 0.7rem !important; }
                    .kpi-compacto-print .text-lg { font-size: 1rem !important; }
                    table { font-size: 8pt; width: 100%; border-collapse: collapse !important; }
                    th, td { border: 1px solid #ccc !important; padding: 2px !important; text-align: center; }
                    .signature-section { margin-top: 1rem !important; page-break-inside: avoid; }
                }
            `}</style>
            {/* ***** FIM DA CORREÇÃO FINAL ***** */}
            
            <div className="flex justify-between items-center no-print">
                <h2 className="text-xl font-bold">Relatório de Ponto</h2>
                <div className="flex items-center gap-2">
                    {!isUserProprietario && (
                         <select value={selectedSignatoryId} onChange={(e) => setSelectedSignatoryId(e.target.value)} className="p-2 border rounded-md text-sm">
                            <option value="">Assinatura do Responsável</option>
                            {proprietarios.map(p => <option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>)}
                         </select>
                    )}
                     <button onClick={handlePrint} className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800">
                        <FontAwesomeIcon icon={faPrint} />
                    </button>
                </div>
            </div>

            <div className="flex flex-row gap-6 items-center border-b pb-4">
                {employee.foto_url ? ( <img src={employee.foto_url} alt="Foto" className="w-20 h-20 rounded-full object-cover" /> ) : ( <FontAwesomeIcon icon={faUserCircle} className="w-20 h-20 text-gray-300" /> )}
                <div className="flex-grow text-left">
                    <h3 className="text-2xl font-bold print-header-name">{employee.full_name}</h3>
                    <p className="text-gray-600">{employee.contract_role}</p>
                    <p className="text-sm text-gray-500">Mês de Referência: {new Date(selectedMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 kpi-container-print">
                <div className="kpi-compacto-print">
                    <KpiCompacto title="Dias (Trab. / Úteis)" value={kpiData.dias} icon={faCalendarCheck} colorClass="text-blue-500" />
                </div>
                <div className="kpi-compacto-print">
                    <KpiCompacto title="Horas (Trab. / Prev.)" value={kpiData.horas} icon={faBusinessTime} colorClass="text-green-500" />
                </div>
                <div className="kpi-compacto-print">
                    <KpiCompacto title="Faltas (no período)" value={kpiData.faltas} icon={faCalendarXmark} colorClass="text-red-500" />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2">Data</th><th className="p-2">Dia</th>
                            <th className="p-2">Entrada</th><th className="p-2">Início Int.</th>
                            <th className="p-2">Fim Int.</th><th className="p-2">Saída</th>
                            <th className="p-2">Total Horas</th><th className="p-2">Abono</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0).getDate() }, (_, i) => {
                            const dayOfMonth = i + 1;
                            const dateInMonth = new Date(Date.UTC(selectedMonth.split('-')[0], selectedMonth.split('-')[1] - 1, dayOfMonth));
                            const dateString = dateInMonth.toISOString().split('T')[0];
                            const dayData = timesheetData[dateString] || { dateString };
                            const abonoDoDia = abonosData[dateString];
                            const isHoliday = holidays.has(dateString);
                            const rowClass = isHoliday ? 'bg-yellow-50' : (dateInMonth.getUTCDay() === 0 || dateInMonth.getUTCDay() === 6 ? 'bg-gray-50' : '');
                            return (
                                <tr key={dateString} className={rowClass}>
                                    <td className="p-2">{new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                    <td className="p-2">{weekDays[dateInMonth.getUTCDay()]} {isHoliday && '(Feriado)'}</td>
                                    {['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'].map(field => (
                                        <td key={field} className="p-2">{dayData[field] || '--:--'}</td>
                                    ))}
                                    <td className="p-2 font-semibold">{calculateTotalHours(dayData)}</td>
                                    <td className="p-2">{abonoDoDia ? 'Sim' : 'Não'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="signature-section hidden print:block mt-8 pt-8 text-center">
                <div className="flex justify-around items-start">
                    <div className="w-2/5"><div className="border-t border-black w-full mx-auto"></div><p className="mt-2 text-sm font-semibold">{selectedEmployeeName}</p><p className="text-xs">Assinatura do Funcionário</p></div>
                    <div className="w-2/5"><div className="border-t border-black w-full mx-auto"></div><p className="mt-2 text-sm font-semibold">{selectedSignatoryName}</p><p className="text-xs">Assinatura do Responsável</p></div>
                </div>
                <p className="text-xs text-gray-500 mt-8">Documento gerado por: {geradoPor} em {new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
    );
}