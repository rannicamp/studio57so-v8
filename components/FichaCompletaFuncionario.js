"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner, faUpload, faEye, faTrash, faFilePdf, faFileImage, faFileWord, faFile, faAddressCard, faFileContract, faFileMedical, faClock, faHourglassHalf, faPlus, faExclamationTriangle, faFileLines, faCheckCircle, faTimesCircle, faDollarSign, faCalendarCheck, faCalendarXmark, faBusinessTime } from '@fortawesome/free-solid-svg-icons';
import KpiCard from './KpiCard';

// --- COMPONENTES INTERNOS (SEM ALTERAÇÕES SIGNIFICATIVAS) ---

const InfoField = ({ label, value, fullWidth = false }) => (
    <div className={fullWidth ? "md:col-span-2" : ""}>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || 'N/A'}</dd>
    </div>
);

const CadastroChecklist = ({ employee }) => {
    const checklistItems = useMemo(() => {
        const items = [];
        const uploadedSiglas = (employee.documentos_funcionarios || []).map(doc => doc.tipo?.sigla?.toUpperCase()).filter(Boolean);
        const requiredItems = [
            { label: 'Nome Completo', type: 'field', key: 'full_name' }, { label: 'CPF', type: 'field', key: 'cpf' },
            { label: 'Cargo', type: 'field', key: 'contract_role' }, { label: 'Data de Admissão', type: 'field', key: 'admission_date' },
            { label: 'Telefone de Contato', type: 'field', key: 'phone' }, { label: 'Endereço (CEP)', type: 'field', key: 'cep' },
            { label: 'Documento de Identidade', type: 'document', siglas: ['RG', 'CNH'] }, { label: 'Carteira de Trabalho', type: 'document', siglas: ['CTPS'] },
            { label: 'Comprovante de Residência', type: 'document', siglas: ['CRES'] }, { label: 'ASO Admissional', type: 'document', siglas: ['AAD', 'ASO'] },
            { label: 'Contrato de Experiência', type: 'document', siglas: ['CTE'] }, { label: 'Recebimento de Uniforme', type: 'document', siglas: ['REU', 'CRE'] },
            { label: 'Controle de EPI', type: 'document', siglas: ['EPI', 'CIE'] }, { label: 'Termo de Vale Transporte (VT)', type: 'document', siglas: ['VT', 'TRN', 'VTN'] },
        ];
        requiredItems.forEach(item => {
            let isCompleted = false;
            if (item.type === 'field') { isCompleted = !!employee[item.key]; } 
            else if (item.type === 'document') { isCompleted = item.siglas.some(requiredSigla => uploadedSiglas.includes(requiredSigla.toUpperCase())); }
            items.push({ label: item.label, isCompleted });
        });
        return items;
    }, [employee]);
    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Checklist de Itens do Cadastro</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {checklistItems.map((item, index) => (
                    <div key={index} className="flex items-center p-3 bg-white border rounded-md">
                        <FontAwesomeIcon icon={item.isCompleted ? faCheckCircle : faTimesCircle} className={`w-5 h-5 mr-3 flex-shrink-0 ${item.isCompleted ? 'text-green-500' : 'text-red-500'}`} />
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DocumentosSection = ({ documentos, employeeId, employeeName, onUpdate }) => { /* ... (código existente sem alterações) ... */ };
const FinanceiroSection = ({ lancamentos, onEditLancamento }) => { /* ... (código existente sem alterações) ... */ };

// Componente Principal
export default function FichaCompletaFuncionario({ employee, allDocuments, allPontos, allAbonos, onUpdate, onEditLancamento }) {
    const [activeTab, setActiveTab] = useState('pessoal');
    const [lancamentos, setLancamentos] = useState([]);
    const [holidays, setHolidays] = useState(new Set());
    const supabase = createClient();

    useEffect(() => {
        const fetchHolidaysForYear = async () => {
            const year = new Date().getFullYear();
            try {
                const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
                if (!response.ok) return;
                const data = await response.json();
                setHolidays(new Set(data.map(h => h.date)));
            } catch (error) { console.error("Erro ao buscar feriados:", error); }
        };
        fetchHolidaysForYear();
    }, []);
    
    // ***** INÍCIO DA NOVA LÓGICA DE KPI *****
    const kpiData = useMemo(() => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // 1. Calcula os dias que deveriam ser trabalhados até hoje
        let diasUteisAteHoje = 0;
        let cargaHorariaEsperadaMinutos = 0;
        const jornadaDetalhes = employee.jornada?.detalhes || [];

        if (jornadaDetalhes.length > 0) {
            for (let d = new Date(firstDayOfMonth); d <= today; d.setDate(d.getDate() + 1)) {
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

        // 2. Calcula o que foi trabalhado
        const pontosDoMes = allPontos.filter(p => {
            const pontoDate = new Date(p.data_hora);
            return pontoDate.getMonth() === currentMonth && pontoDate.getFullYear() === currentYear;
        });
        
        const pontosPorDia = pontosDoMes.reduce((acc, ponto) => {
            const dia = ponto.data_hora.split('T')[0];
            if (!acc[dia]) acc[dia] = [];
            acc[dia].push(new Date(ponto.data_hora));
            return acc;
        }, {});

        const diasTrabalhados = Object.keys(pontosPorDia).length;
        let totalMinutosTrabalhados = 0;

        for (const dia in pontosPorDia) {
            const registros = pontosPorDia[dia].sort((a, b) => a - b);
            if (registros.length >= 2) {
                let diff = registros[registros.length - 1] - registros[0];
                if (registros.length >= 4) { diff -= (registros[2] - registros[1]); }
                totalMinutosTrabalhados += diff / (1000 * 60);
            }
        }
        const horasTrabalhadasFormatada = `${Math.floor(totalMinutosTrabalhados / 60)}:${String(Math.round(totalMinutosTrabalhados % 60)).padStart(2, '0')}h`;

        // 3. Calcula Faltas
        const faltas = Math.max(0, diasUteisAteHoje - diasTrabalhados);

        return {
            dias: `${diasTrabalhados} / ${diasUteisAteHoje}`,
            horas: `${horasTrabalhadasFormatada} / ${cargaHorariaEsperadaFormatada}`,
            faltas: faltas
        };

    }, [employee, allPontos, holidays]);
    // ***** FIM DA NOVA LÓGICA DE KPI *****

    const fetchLancamentos = useCallback(async () => { /* ... (código sem alterações) ... */ }, [employee, supabase]);
    useEffect(() => { if (activeTab === 'financeiro') { fetchLancamentos(); } }, [activeTab, fetchLancamentos, employee]);
    const TabButton = ({ tabName, label, icon }) => ( <button onClick={() => setActiveTab(tabName)} className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${activeTab === tabName ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}> <FontAwesomeIcon icon={icon} /> {label} </button> );
    
    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
                {employee.foto_url ? ( <img src={employee.foto_url} alt="Foto do Funcionário" className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg" /> ) : ( <FontAwesomeIcon icon={faUserCircle} className="w-28 h-28 text-gray-300" /> )}
                <div className="flex-grow">
                    <h2 className="text-3xl font-bold text-gray-900">{employee.full_name}</h2>
                    <p className="text-lg text-gray-600">{employee.contract_role}</p>
                    <span className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ employee.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}> {employee.status} </span>
                </div>
            </div>
            
            {/* ***** INÍCIO DA ATUALIZAÇÃO VISUAL DOS KPIs ***** */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <KpiCard title="Dias (Trab. / Úteis)" value={kpiData.dias} icon={faCalendarCheck} color="blue" />
                <KpiCard title="Horas (Trab. / Prev.)" value={kpiData.horas} icon={faBusinessTime} color="green" />
                <KpiCard title="Faltas (no período)" value={kpiData.faltas} icon={faCalendarXmark} color="red" />
            </div>
            {/* ***** FIM DA ATUALIZAÇÃO VISUAL DOS KPIs ***** */}

            <div className="border-t pt-6">
                <div className="flex items-center border-b mb-6">
                    <nav className="flex space-x-2" aria-label="Tabs">
                        <TabButton tabName="pessoal" label="Dados Pessoais" icon={faAddressCard} />
                        <TabButton tabName="documentos" label="Documentos" icon={faFileLines} />
                        <TabButton tabName="financeiro" label="Financeiro" icon={faDollarSign} />
                        <TabButton tabName="checklist" label="Checklist" icon={faCheckCircle} />
                    </nav>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    {activeTab === 'pessoal' && (
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <InfoField label="CPF" value={employee.cpf} />
                            <InfoField label="RG" value={employee.rg} />
                            <InfoField label="Data de Nascimento" value={employee.birth_date ? new Date(employee.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'} />
                            <InfoField label="Estado Civil" value={employee.estado_civil} />
                            <InfoField label="Telefone" value={employee.phone} />
                            <InfoField label="Email" value={employee.email} />
                            <InfoField label="Empresa Contratante" value={employee.cadastro_empresa?.razao_social} />
                            <InfoField label="Empreendimento Atual" value={employee.empreendimentos?.nome} />
                            <InfoField label="Data de Admissão" value={employee.admission_date ? new Date(employee.admission_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'} />
                            <InfoField label="Salário Base" value={employee.base_salary} />
                            <InfoField label="Endereço" value={`${employee.address_street || ''}, ${employee.address_number || ''} - ${employee.neighborhood || ''}, ${employee.city || ''}`} fullWidth={true}/>
                            <InfoField label="Observações" value={employee.observations} fullWidth={true} />
                        </dl>
                    )}
                    {activeTab === 'documentos' && ( <DocumentosSection documentos={allDocuments} employeeId={employee.id} employeeName={employee.full_name} onUpdate={onUpdate} /> )}
                    {activeTab === 'financeiro' && ( <FinanceiroSection lancamentos={lancamentos} onEditLancamento={onEditLancamento} /> )}
                    {activeTab === 'checklist' && ( <CadastroChecklist employee={employee} /> )}
                </div>
            </div>
        </div>
    );
}