"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner, faUpload, faEye, faTrash, faFilePdf, faFileImage, faFileWord, faFile, faPlusCircle, faCalendarAlt, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import AbonoModal from './AbonoModal';
import Link from 'next/link'; // This line was added to fix the error

// --- Componentes Auxiliares ---
const InfoField = ({ label, value }) => (<div><dt className="text-sm font-medium text-gray-500">{label}</dt><dd className="mt-1 text-sm text-gray-900">{value || 'N/A'}</dd></div>);
const getFileIcon = (fileName) => { if (/\.pdf$/i.test(fileName)) return faFilePdf; if (/\.(jpg|jpeg|png|gif)$/i.test(fileName)) return faFileImage; if (/\.(doc|docx)$/i.test(fileName)) return faFileWord; return faFile; };


// --- Componente da Folha de Ponto Inteligente ---
const FolhaPontoInteligente = ({ employeeId, jornada, initialPontos, initialAbonos }) => {
    const supabase = createClient();
    const [pontos, setPontos] = useState(initialPontos);
    const [abonos, setAbonos] = useState(initialAbonos);
    const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
    const [holidays, setHolidays] = useState(new Set());
    
    const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
    const [abonoDate, setAbonoDate] = useState(null);

    // *** CORREÇÃO APLICADA AQUI ***
    const weekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    useEffect(() => {
        const fetchHolidays = async (year) => {
            try {
                const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
                const data = await response.json();
                setHolidays(new Set(data.map(h => h.date)));
            } catch (e) { console.error("Falha ao buscar feriados."); }
        };
        fetchHolidays(currentMonth.slice(0, 4));
    }, [currentMonth]);

    const handleSaveAbono = async (abonoData) => {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('abonos').insert({ ...abonoData, funcionario_id: employeeId, criado_por_usuario_id: user.id });
        if (error) { alert("Erro ao salvar abono: " + error.message); }
        else { const { data } = await supabase.from('abonos').select('*').eq('funcionario_id', employeeId); setAbonos(data || []); }
    };

    const timeToMinutes = (time) => { if (!time) return 0; const [h, m] = time.split(':').map(Number); return h * 60 + m; };
    const minutesToTime = (minutes) => { if (isNaN(minutes) || minutes === 0) return '00:00'; const h = Math.floor(Math.abs(minutes) / 60).toString().padStart(2, '0'); const m = (Math.abs(minutes) % 60).toString().padStart(2, '0'); return `${minutes < 0 ? '-' : ''}${h}:${m}`; };

    const dailyData = useMemo(() => {
        if (!jornada) return [];
        const [year, month] = currentMonth.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        
        return Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(year, month - 1, i + 1);
            const dateString = date.toISOString().slice(0, 10);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = holidays.has(dateString);

            const dayPontos = pontos.filter(p => p.data_hora.startsWith(dateString)).sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
            const dayAbono = abonos.find(a => a.data_abono === dateString);

            let horasTrabalhadas = 0;
            if (dayPontos.length >= 2) {
                const entrada = new Date(dayPontos[0].data_hora);
                const saida = new Date(dayPontos[dayPontos.length - 1].data_hora);
                let diff = saida - entrada;
                if (dayPontos.length >= 4) { // Considera intervalo
                    const saidaIntervalo = new Date(dayPontos[1].data_hora);
                    const voltaIntervalo = new Date(dayPontos[2].data_hora);
                    diff -= (voltaIntervalo - saidaIntervalo);
                }
                horasTrabalhadas = diff / (1000 * 60); // em minutos
            }

            const jornadaDia = jornada.detalhes.find(d => d.dia_semana === dayOfWeek);
            let horasPrevistas = 0;
            if (jornadaDia && !isWeekend && !isHoliday) {
                horasPrevistas = (timeToMinutes(jornadaDia.horario_saida) - timeToMinutes(jornadaDia.horario_entrada)) - (timeToMinutes(jornadaDia.horario_volta_intervalo) - timeToMinutes(jornadaDia.horario_saida_intervalo));
            }

            const tolerancia = jornada.tolerancia_minutos || 0;
            let saldo = horasTrabalhadas - horasPrevistas;
            if (Math.abs(saldo) <= tolerancia && !isWeekend && !isHoliday) {
                saldo = 0;
            }
            if (dayAbono) {
                saldo += (dayAbono.horas_abonadas * 60);
            }
             if (isWeekend || isHoliday) {
                saldo = horasTrabalhadas;
            }

            return { dateString, dayOfWeek, isWeekend, isHoliday, dayPontos, dayAbono, horasTrabalhadas, horasPrevistas, saldo };
        });
    }, [currentMonth, jornada, pontos, abonos, holidays]);

    const totalSaldo = useMemo(() => dailyData.reduce((acc, day) => acc + day.saldo, 0), [dailyData]);

    if (!jornada) {
        return <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-center">Este funcionário não possui uma jornada de trabalho definida. Por favor, <Link href={`/funcionarios/editar/${employeeId}`} className="font-bold underline">edite o cadastro</Link> para associar uma jornada.</div>
    }

    return (
        <div>
            <AbonoModal isOpen={isAbonoModalOpen} onClose={() => setIsAbonoModalOpen(false)} onSave={handleSaveAbono} date={abonoDate} />
            <input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)} className="p-2 border rounded-md mb-4"/>
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100"><tr><th className="p-2">Data</th><th>Entrada</th><th>Saída</th><th>Horas Trab.</th><th>Horas Prev.</th><th>Saldo</th><th>Ações</th></tr></thead>
                    <tbody className="divide-y">
                        {dailyData.map(day => (
                            <tr key={day.dateString} className={`${day.isWeekend || day.isHoliday ? 'bg-gray-50' : ''}`}>
                                <td className="p-2">{new Date(day.dateString + 'T12:00:00Z').toLocaleDateString('pt-BR')} ({weekDays[day.dayOfWeek].slice(0,3)})</td>
                                <td className="p-2">{day.dayPontos[0] ? new Date(day.dayPontos[0].data_hora).toLocaleTimeString('pt-BR') : '--:--'}</td>
                                <td className="p-2">{day.dayPontos.length > 1 ? new Date(day.dayPontos[day.dayPontos.length - 1].data_hora).toLocaleTimeString('pt-BR') : '--:--'}</td>
                                <td className="p-2 font-semibold">{minutesToTime(day.horasTrabalhadas)}</td>
                                <td className="p-2">{minutesToTime(day.horasPrevistas)}</td>
                                <td className={`p-2 font-bold ${day.saldo > 0 ? 'text-green-600' : (day.saldo < 0 ? 'text-red-600' : '')}`}>{minutesToTime(day.saldo)}</td>
                                <td className="p-2">
                                    {day.dayAbono ? 
                                     <span className="text-xs text-blue-600" title={day.dayAbono.motivo}>Abonado ({day.dayAbono.horas_abonadas}h)</span>
                                    : <button onClick={() => { setAbonoDate(day.dateString); setIsAbonoModalOpen(true); }} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200">Abonar</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-200 font-bold">
                        <tr><td colSpan="5" className="p-2 text-right">Saldo Total do Mês:</td><td className={`p-2 ${totalSaldo > 0 ? 'text-green-700' : 'text-red-700'}`}>{minutesToTime(totalSaldo)}</td><td></td></tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

// --- Componente Principal da Ficha ---
export default function FichaCompletaFuncionario({ employee, allDocuments, allJornadas, allPontos, allAbonos }) {
    const supabase = createClient();
    const [documentos, setDocumentos] = useState(allDocuments || []);
    const [message, setMessage] = useState('');
    const [isUploading, setIsUploading] = useState(null);

    const employeeJornada = useMemo(() => {
        return allJornadas.find(j => j.id === employee.jornada_id);
    }, [allJornadas, employee.jornada_id]);

    const handleFileUpload = async (docType, file) => {
        if (!file) return; setIsUploading(docType); setMessage('Enviando documento...');
        const fileExtension = file.name.split('.').pop();
        const filePath = `documentos/${employee.id}/${docType.replace(/ /g, '_')}.${fileExtension}`;
        const { error } = await supabase.storage.from('funcionarios-documentos').upload(filePath, file, { upsert: true });
        if (error) { setMessage(`Erro no upload: ${error.message}`); }
        else {
            const { error: dbError } = await supabase.from('documentos_funcionarios').upsert({ funcionario_id: employee.id, nome_documento: docType, caminho_arquivo: filePath }, { onConflict: 'funcionario_id, nome_documento' });
            if(dbError) { setMessage(`Erro ao salvar no banco: ${dbError.message}`); }
            else { setMessage('Documento enviado!'); const { data: updatedDocs } = await supabase.from('documentos_funcionarios').select('*').eq('funcionario_id', employee.id); setDocumentos(updatedDocs || []); }
        }
        setIsUploading(null);
    };

    const handleViewDocument = async (caminho) => {
         const { data, error } = await supabase.storage.from('funcionarios-documentos').createSignedUrl(caminho, 60);
         if(error) { alert("Erro ao gerar link."); } else { window.open(data.signedUrl, '_blank'); }
    };
    
    const handleDeleteDocument = async (doc) => {
        if (!window.confirm(`Excluir "${doc.nome_documento}"?`)) return;
        await supabase.storage.from('funcionarios-documentos').remove([doc.caminho_arquivo]);
        await supabase.from('documentos_funcionarios').delete().eq('id', doc.id);
        setDocumentos(prev => prev.filter(d => d.id !== doc.id));
        setMessage("Documento excluído.");
    };

    const requiredDocs = ['Identidade com Foto', 'CTPS', 'Comprovante de Residência', 'ASO'];

    return (
        <div className="space-y-10">
            {message && <p className="text-center font-semibold p-2 bg-blue-50 text-blue-700 rounded-md">{message}</p>}
            
            <section><div className="flex items-center gap-6 border-b pb-6"><h2 className="text-3xl font-bold text-gray-900">{employee.full_name}</h2></div></section>
            
            <section>
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Documentos do Funcionário</h3>
                <ul className="space-y-3">
                    {requiredDocs.map(docType => {
                        const uploadedDoc = documentos.find(d => d.nome_documento === docType);
                        return (
                            <li key={docType} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3"><FontAwesomeIcon icon={getFileIcon(uploadedDoc?.caminho_arquivo || '')} className="text-xl text-gray-500" /><span className="font-medium">{docType}</span></div>
                                <div className="flex items-center gap-3">
                                    {uploadedDoc ? (<><button onClick={() => handleViewDocument(uploadedDoc.caminho_arquivo)} className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"><FontAwesomeIcon icon={faEye} /> Visualizar</button><button onClick={() => handleDeleteDocument(uploadedDoc)} className="text-sm font-semibold text-red-600 hover:underline flex items-center gap-1"><FontAwesomeIcon icon={faTrash} /> Excluir</button></>) 
                                    : (<label className="text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-md cursor-pointer flex items-center gap-1">{isUploading === docType ? <FontAwesomeIcon icon={faSpinner} spin/> : <FontAwesomeIcon icon={faUpload} />} Enviar<input type="file" className="hidden" onChange={(e) => handleFileUpload(docType, e.target.files[0])} disabled={isUploading}/></label>)}
                                </div>
                            </li>
                        )
                    })}
                </ul>
            </section>
            
            <section>
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Folha de Ponto e Saldo de Horas</h3>
                <FolhaPontoInteligente employeeId={employee.id} jornada={employeeJornada} initialPontos={allPontos} initialAbonos={allAbonos} />
            </section>
        </div>
    );
}