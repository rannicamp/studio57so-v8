"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner, faUpload, faEye, faTrash, faFilePdf, faFileImage, faFileWord, faFile, faAddressCard, faFileContract, faFileMedical, faClock, faHourglassHalf, faPlus, faExclamationTriangle, faFileLines, faCheckCircle, faTimesCircle, faDollarSign, faCalendarCheck, faCalendarXmark, faBusinessTime, faPenToSquare, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';
import KpiCard from './KpiCard';

// --- SUB-COMPONENTES ---

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

const DocumentosSection = ({ documentos: initialDocuments, employeeId, employeeName, onUpdate }) => {
    const supabase = createClient();
    const [documentos, setDocumentos] = useState(initialDocuments || []);
    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [newFile, setNewFile] = useState(null);
    const [newFileType, setNewFileType] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);

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
        if (!fileName) return faFile;
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
            onUpdate();
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

const FinanceiroSection = ({ lancamentos, onEditLancamento }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'descending' });

    const sortedLancamentos = useMemo(() => {
        let sortableItems = [...lancamentos].map(lanc => ({
            ...lanc,
            data_ordenacao: lanc.status === 'Pago' ? lanc.data_pagamento : lanc.data_vencimento || lanc.data_transacao
        }));

        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let valA, valB;
                if (['data_vencimento', 'data_pagamento'].includes(sortConfig.key)) {
                    valA = new Date(a.data_ordenacao);
                    valB = new Date(b.data_ordenacao);
                } else if (sortConfig.key === 'categoria.nome') {
                    valA = a.categoria?.nome || '';
                    valB = b.categoria?.nome || '';
                } else {
                    valA = a[sortConfig.key] || '';
                    valB = b[sortConfig.key] || '';
                }

                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [lancamentos, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return faSort;
        return sortConfig.direction === 'ascending' ? faSortUp : faSortDown;
    };

    const SortableHeader = ({ label, sortKey, className = '' }) => (
        <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${className}`}>
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2">
                {label}
                <FontAwesomeIcon icon={getSortIcon(sortKey)} className="text-gray-400" />
            </button>
        </th>
    );

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR') : 'N/A';

    if (lancamentos.length === 0) {
        return <p className="text-center text-gray-500 py-4">Nenhum lançamento financeiro encontrado para este funcionário.</p>;
    }

    return (
        <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                    <tr>
                        <SortableHeader label="Data" sortKey="data_vencimento" />
                        <SortableHeader label="Descrição" sortKey="descricao" />
                        <SortableHeader label="Categoria" sortKey="categoria.nome" />
                        <SortableHeader label="Valor" sortKey="valor" />
                        <th className="px-4 py-2 text-center text-xs font-bold uppercase">Status</th>
                        <th className="px-4 py-2 text-center text-xs font-bold uppercase">Ações</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y">
                    {sortedLancamentos.map(lanc => {
                        const dataExibida = lanc.status === 'Pago' ? lanc.data_pagamento : lanc.data_vencimento || lanc.data_transacao;
                        return (
                            <tr key={lanc.id}>
                                <td className="px-4 py-2 whitespace-nowrap">{formatDate(dataExibida)}</td>
                                <td className="px-4 py-2">{lanc.descricao}</td>
                                <td className="px-4 py-2">{lanc.categoria?.nome || 'N/A'}</td>
                                <td className={`px-4 py-2 text-right font-semibold ${lanc.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(lanc.valor)}</td>
                                <td className="px-4 py-2 text-center">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${lanc.status === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {lanc.status}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <button onClick={() => onEditLancamento(lanc)} title="Editar Lançamento" className="text-blue-600 hover:text-blue-800">
                                        <FontAwesomeIcon icon={faPenToSquare} />
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};

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
    
    // ***** INÍCIO DA ALTERAÇÃO INTELIGENTE *****
    // O cálculo dos KPIs agora é mais robusto e inclui o novo "Valor a Pagar".
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
        
        // Novo cálculo: Valor a Pagar
        const valorDiaria = parseFloat(employee.daily_value) || 0;
        const valorAPagar = diasTrabalhados * valorDiaria;

        return {
            dias: `${diasTrabalhados} / ${diasUteisAteHoje}`,
            horas: `${horasTrabalhadasFormatada} / ${cargaHorariaEsperadaFormatada}`,
            faltas: faltas,
            valorAPagar: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorAPagar),
        };

    }, [employee, allPontos, holidays]);
    // ***** FIM DA ALTERAÇÃO INTELIGENTE *****
    
    const fetchLancamentos = useCallback(async () => {
        if (!employee.contato_id) {
            setLancamentos([]);
            return;
        }
        const { data } = await supabase
            .from('lancamentos')
            .select('*, categoria:categorias_financeiras(nome)')
            .eq('favorecido_contato_id', employee.contato_id)
            .order('data_vencimento', { ascending: false }); 
        
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
            
            {/* O grid de KPIs agora tem 4 colunas para acomodar o novo card */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Valor a Pagar (Mês)" value={kpiData.valorAPagar} icon={faDollarSign} color="purple" />
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
                            <InfoField label="Data de Admissão" value={employee.admission_date ? new Date(employee.admission_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}/>
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