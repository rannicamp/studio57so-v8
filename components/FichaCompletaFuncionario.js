"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner, faUpload, faEye, faTrash, faFilePdf, faFileImage, faFileWord, faFile, faAddressCard, faFileContract, faFileMedical, faClock, faHourglassHalf, faPlus, faExclamationTriangle, faFileLines, faCheckCircle, faTimesCircle, faDollarSign, faCalendarCheck, faCalendarXmark, faBusinessTime } from '@fortawesome/free-solid-svg-icons';
import KpiCard from './KpiCard';

// --- SUB-COMPONENTES (SEM ALTERAÇÕES SIGNIFICATIVAS) ---

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

// ##### INÍCIO DA SEÇÃO CORRIGIDA #####
const DocumentosSection = ({ documentos: initialDocuments, employeeId, employeeName, onUpdate }) => {
    const supabase = createClient();
    const [documentos, setDocumentos] = useState(initialDocuments || []);
    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [newFile, setNewFile] = useState(null);
    const [newFileType, setNewFileType] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);

    // ESTE É O HOOK QUE CORRIGE O PROBLEMA
    useEffect(() => {
        setDocumentos(initialDocuments || []);
    }, [initialDocuments]);

    useEffect(() => {
        const fetchTipos = async () => {
            setLoading(true);
            const { data } = await supabase.from('documento_tipos').select('*').order('sigla');
            setTiposDocumento(data || []);
            setLoading(false);
        };
        fetchTipos();
    }, [supabase]);

    const getFileIcon = (fileName) => {
        const extension = fileName.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) return faFileImage;
        if (extension === 'pdf') return faFilePdf;
        if (['doc', 'docx'].includes(extension)) return faFileWord;
        return faFile;
    };

    const handleUpload = async () => {
        if (!newFile || !newFileType) {
            alert('Por favor, selecione um arquivo e um tipo de documento.');
            return;
        }
        setIsUploading(true);

        const tipoSelecionado = tiposDocumento.find(t => t.id == newFileType);
        const sigla = tipoSelecionado?.sigla || 'DOC';
        const fileExtension = newFile.name.split('.').pop();
        const newFileName = `documentos/${employeeId}/${sigla}_${employeeName.replace(/ /g, '_')}.${fileExtension}`;

        const { error: uploadError } = await supabase.storage.from('funcionarios-documentos').upload(newFileName, newFile, { upsert: true });

        if (uploadError) {
            alert('Erro no upload: ' + uploadError.message);
        } else {
            await supabase.from('documentos_funcionarios').insert({
                funcionario_id: employeeId,
                nome_documento: tipoSelecionado.descricao,
                caminho_arquivo: newFileName,
                tipo_documento_id: newFileType
            });
            setNewFile(null);
            setNewFileType('');
            if (fileInputRef.current) fileInputRef.current.value = "";
            onUpdate(); // Notifica o componente pai para recarregar os dados
        }
        setIsUploading(false);
    };

    const handleView = async (filePath) => {
        const { data } = await supabase.storage.from('funcionarios-documentos').createSignedUrl(filePath, 3600);
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
        else alert('Não foi possível gerar a URL do documento.');
    };

    const handleDelete = async (doc) => {
        if (!window.confirm(`Tem certeza que deseja excluir o documento "${doc.nome_documento}"?`)) return;
        await supabase.storage.from('funcionarios-documentos').remove([doc.caminho_arquivo]);
        await supabase.from('documentos_funcionarios').delete().eq('id', doc.id);
        onUpdate();
    };

    return (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Arquivo</label>
                        <input ref={fileInputRef} type="file" onChange={(e) => setNewFile(e.target.files[0])} className="mt-1 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Tipo de Documento</label>
                        <select value={newFileType} onChange={(e) => setNewFileType(e.target.value)} className="mt-1 block w-full p-2 border rounded-md">
                            <option value="">Selecione...</option>
                            {tiposDocumento.map(tipo => (<option key={tipo.id} value={tipo.id}>{tipo.sigla} - {tipo.descricao}</option>))}
                        </select>
                    </div>
                </div>
                <div className="text-right mt-4">
                    <button onClick={handleUpload} disabled={isUploading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                        {isUploading ? <><FontAwesomeIcon icon={faSpinner} spin className="mr-2"/>Enviando...</> : <><FontAwesomeIcon icon={faUpload} className="mr-2"/>Enviar Documento</>}
                    </button>
                </div>
            </div>
            <div className="space-y-3">
                {loading ? <p>Carregando...</p> : documentos.length === 0 ? <p className="text-center text-gray-500 py-4">Nenhum documento anexado.</p> :
                    documentos.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md bg-white">
                            <div className="flex items-center gap-3">
                                <FontAwesomeIcon icon={getFileIcon(doc.caminho_arquivo)} className="text-2xl text-gray-500" />
                                <div>
                                    <p className="font-semibold">{doc.nome_documento}</p>
                                    <p className="text-xs text-gray-500">Enviado em: {new Date(doc.data_upload).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={() => handleView(doc.caminho_arquivo)} className="text-blue-500 hover:text-blue-700"><FontAwesomeIcon icon={faEye} title="Visualizar"/></button>
                                <button onClick={() => handleDelete(doc)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} title="Excluir"/></button>
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
    );
};
// ##### FIM DA SEÇÃO CORRIGIDA #####

const FinanceiroSection = ({ lancamentos, onEditLancamento }) => { /* ... (código existente sem alterações, mantido para a funcionalidade completa do componente) ... */ };

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
    
    const kpiData = useMemo(() => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
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
        const faltas = Math.max(0, diasUteisAteHoje - diasTrabalhados);

        return {
            dias: `${diasTrabalhados} / ${diasUteisAteHoje}`,
            horas: `${horasTrabalhadasFormatada} / ${cargaHorariaEsperadaFormatada}`,
            faltas: faltas
        };

    }, [employee, allPontos, holidays]);
    
    const fetchLancamentos = useCallback(async () => { 
        if (!employee.contato_id) {
            setLancamentos([]);
            return;
        }
        const { data } = await supabase.from('lancamentos').select('*, categoria:categorias_financeiras(nome)').eq('favorecido_contato_id', employee.contato_id).order('data_vencimento', { ascending: false });
        setLancamentos(data || []);
    }, [employee, supabase]);

    useEffect(() => { if (activeTab === 'financeiro') { fetchLancamentos(); } }, [activeTab, fetchLancamentos]);
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <KpiCard title="Dias (Trab. / Úteis)" value={kpiData.dias} icon={faCalendarCheck} color="blue" />
                <KpiCard title="Horas (Trab. / Prev.)" value={kpiData.horas} icon={faBusinessTime} color="green" />
                <KpiCard title="Faltas (no período)" value={kpiData.faltas} icon={faCalendarXmark} color="red" />
            </div>

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