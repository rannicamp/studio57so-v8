"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner, faUpload, faEye, faTrash, faFilePdf, faFileImage, faFileWord, faFile, faAddressCard, faFileContract, faFileMedical, faClock, faHourglassHalf, faPlus, faExclamationTriangle, faFileLines, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import KpiCard from './KpiCard';

// --- COMPONENTES INTERNOS DA PÁGINA ---

const InfoField = ({ label, value, fullWidth = false }) => (
    <div className={fullWidth ? "md:col-span-2" : ""}>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || 'N/A'}</dd>
    </div>
);

const DocumentosSection = ({ documentos, employeeId, employeeName, onUpdate }) => {
    const supabase = createClient();
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [selectedTipoId, setSelectedTipoId] = useState('');
    const [descricao, setDescricao] = useState('');
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        const fetchTipos = async () => {
            const { data } = await supabase.from('documento_tipos').select('*').order('descricao');
            setTiposDocumento(data || []);
        };
        fetchTipos();
    }, [supabase]);

    const getFileIcon = (fileName) => {
        if (!fileName) return faFile;
        if (/\.pdf$/i.test(fileName)) return faFilePdf;
        if (/\.(jpg|jpeg|png|gif)$/i.test(fileName)) return faFileImage;
        if (/\.(doc|docx)$/i.test(fileName)) return faFileWord;
        return faFile;
    };

    const handleFileUpload = async () => {
        if (!file || !selectedTipoId || !descricao) {
            setMessage("Por favor, selecione o tipo, descreva e escolha um arquivo.");
            return;
        }

        setIsUploading(true);
        setMessage('Enviando documento...');

        const tipoSelecionado = tiposDocumento.find(t => t.id.toString() === selectedTipoId);
        const sigla = tipoSelecionado?.sigla || 'DOC';
        const fileExtension = file.name.split('.').pop();
        
        // ***** INÍCIO DA CORREÇÃO *****
        // Função de limpeza mais robusta para nomes de arquivos
        const sanitizeString = (str) => {
            return (str || '')
                .trim() // Remove espaços do início e do fim
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
                .replace(/[^a-zA-Z0-9\s-]/g, "") // Remove caracteres especiais, exceto espaços e hífens
                .replace(/\s+/g, '_'); // Substitui espaços por um único underscore
        };

        const nomeFuncionario = sanitizeString(employeeName);
        const descricaoSanitizada = sanitizeString(descricao);
        
        const newFileName = `${sigla}_${nomeFuncionario}_${descricaoSanitizada}.${fileExtension}`;
        const filePath = `${employeeId}/${newFileName}`;
        // ***** FIM DA CORREÇÃO *****

        const { error: uploadError } = await supabase.storage.from('funcionarios-documentos').upload(filePath, file, { upsert: true });

        if (uploadError) {
            setMessage(`Erro no upload: ${uploadError.message}`);
        } else {
            const { error: dbError } = await supabase.from('documentos_funcionarios').insert({
                funcionario_id: employeeId,
                nome_documento: descricao,
                caminho_arquivo: filePath,
                tipo_documento_id: tipoSelecionado.id
            });

            if (dbError) {
                setMessage(`Erro ao salvar no banco: ${dbError.message}`);
            } else {
                setMessage('Documento enviado com sucesso!');
                onUpdate();
                setFile(null);
                setDescricao('');
                setSelectedTipoId('');
                if(document.getElementById('file-upload-input')) {
                   document.getElementById('file-upload-input').value = "";
                }
            }
        }
        setIsUploading(false);
    };

    const handleViewDocument = async (caminho) => {
        const { data, error } = await supabase.storage.from('funcionarios-documentos').createSignedUrl(caminho, 60);
        if (error) { alert("Erro ao gerar link para visualização."); }
        else { window.open(data.signedUrl, '_blank'); }
    };

    const handleDeleteDocument = async (doc) => {
        if (!window.confirm(`Tem certeza que deseja excluir o documento "${doc.nome_documento}"?`)) return;
        await supabase.storage.from('funcionarios-documentos').remove([doc.caminho_arquivo]);
        await supabase.from('documentos_funcionarios').delete().eq('id', doc.id);
        setMessage("Documento excluído com sucesso.");
        onUpdate();
    };

    const handleDragEvents = (e) => { e.preventDefault(); e.stopPropagation(); if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true); else if (e.type === 'dragleave') setIsDragging(false); };
    const handleDrop = (e) => { handleDragEvents(e); setIsDragging(false); if (e.dataTransfer.files?.[0]) { setFile(e.dataTransfer.files[0]); } };


    return (
        <div className="space-y-6">
            {message && <p className="text-center text-sm p-2 bg-blue-50 text-blue-800 rounded-md">{message}</p>}

            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <h4 className="font-semibold text-lg">Adicionar Novo Documento</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tipo do Documento *</label>
                        <select value={selectedTipoId} onChange={(e) => setSelectedTipoId(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Selecione um tipo...</option>
                            {tiposDocumento.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.descricao} ({tipo.sigla})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Descrição do Documento *</label>
                        <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: ASO Admissional" className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                </div>
                <div onDragEnter={handleDragEvents} onDragOver={handleDragEvents} onDragLeave={handleDragEvents} onDrop={handleDrop} className={`relative mt-2 w-full h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                    <input type="file" id="file-upload-input" className="absolute w-full h-full opacity-0 cursor-pointer" onChange={(e) => setFile(e.target.files[0])} />
                    {file ? (
                        <div className="text-center"><FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-2xl mb-1" /><p className="text-sm font-semibold">{file.name}</p></div>
                    ) : (
                        <div className="text-center text-gray-500"><FontAwesomeIcon icon={faUpload} className="text-2xl mb-1" /><p className="text-sm">Arraste e solte ou <span className="font-semibold text-blue-600">clique aqui</span></p></div>
                    )}
                </div>
                <div className="text-right">
                    <button onClick={handleFileUpload} disabled={isUploading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                        {isUploading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Adicionar Documento'}
                    </button>
                </div>
            </div>

            <div>
                <h4 className="font-semibold text-lg mb-2">Documentos Salvos</h4>
                <ul className="space-y-3">
                    {documentos.length === 0 ? <p className="text-sm text-gray-500">Nenhum documento salvo para este funcionário.</p>
                    : documentos.map(doc => {
                        const tipoDoc = tiposDocumento.find(t => t.id === doc.tipo_documento_id);
                        const displayName = tipoDoc ? `${tipoDoc.sigla}_${doc.nome_documento}` : doc.nome_documento;

                        return (
                        <li key={doc.id} className="bg-white p-3 rounded-md border flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <FontAwesomeIcon icon={getFileIcon(doc.caminho_arquivo)} className="text-xl text-gray-500" />
                                <span className="font-medium">{displayName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => handleViewDocument(doc.caminho_arquivo)} className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"><FontAwesomeIcon icon={faEye} /> Visualizar</button>
                                <button onClick={() => handleDeleteDocument(doc)} className="text-sm font-semibold text-red-600 hover:underline flex items-center gap-1"><FontAwesomeIcon icon={faTrash} /> Excluir</button>
                            </div>
                        </li>
                    )})}
                </ul>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL (sem alterações) ---

export default function FichaCompletaFuncionario({ employee, allDocuments, allPontos, allAbonos, onUpdate }) {
    const [activeTab, setActiveTab] = useState('pessoal');
    const kpiData = useMemo(() => { const currentMonth = new Date().getMonth(); const currentYear = new Date().getFullYear(); const pontosDoMes = allPontos.filter(p => new Date(p.data_hora).getMonth() === currentMonth && new Date(p.data_hora).getFullYear() === currentYear); const abonosDoMes = allAbonos.filter(a => new Date(a.data_abono).getMonth() === currentMonth && new Date(a.data_abono).getFullYear() === currentYear); let totalMinutosTrabalhados = 0; const pontosPorDia = pontosDoMes.reduce((acc, ponto) => { const dia = ponto.data_hora.split('T')[0]; if (!acc[dia]) acc[dia] = []; acc[dia].push(new Date(ponto.data_hora)); return acc; }, {}); for (const dia in pontosPorDia) { const registros = pontosPorDia[dia].sort((a, b) => a - b); if (registros.length >= 2) { const entrada = registros[0]; const saida = registros[registros.length - 1]; let diff = saida - entrada; if (registros.length >= 4) { const saidaIntervalo = registros[1]; const voltaIntervalo = registros[2]; diff -= (voltaIntervalo - saidaIntervalo); } totalMinutosTrabalhados += diff / (1000 * 60); } } const horasTrabalhadas = (totalMinutosTrabalhados / 60).toFixed(1); const totalHorasAbonadas = abonosDoMes.reduce((acc, abono) => acc + abono.horas_abonadas, 0); return { horasTrabalhadas: `${horasTrabalhadas}h`, horasAbonadas: `${totalHorasAbonadas}h`, saldoHoras: 'N/A' }; }, [allPontos, allAbonos]);
    const TabButton = ({ tabName, label }) => (<button onClick={() => setActiveTab(tabName)} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === tabName ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`} > {label} </button>);
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
                <KpiCard title="Horas Trabalhadas (Mês)" value={kpiData.horasTrabalhadas} icon={faClock} color="blue" />
                <KpiCard title="Horas Abonadas (Mês)" value={kpiData.horasAbonadas} icon={faFileMedical} color="yellow" />
                <KpiCard title="Saldo de Horas" value={kpiData.saldoHoras} icon={faHourglassHalf} color="purple" />
            </div>
            <div className="border-t pt-6">
                <div className="flex items-center border-b mb-6"> <nav className="flex space-x-2" aria-label="Tabs"> <TabButton tabName="pessoal" label="Dados Pessoais" /> <TabButton tabName="contratual" label="Dados Contratuais" /> <TabButton tabName="endereco" label="Endereço" /> <TabButton tabName="documentos" label="Documentos" /> </nav> </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    {activeTab === 'pessoal' && ( <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"> <InfoField label="CPF" value={employee.cpf} /> <InfoField label="RG" value={employee.rg} /> <InfoField label="Data de Nascimento" value={employee.birth_date ? new Date(employee.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'} /> <InfoField label="Estado Civil" value={employee.estado_civil} /> <InfoField label="Telefone" value={employee.phone} /> <InfoField label="Email" value={employee.email} /> </dl> )}
                    {activeTab === 'contratual' && ( <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"> <InfoField label="Empresa Contratante" value={employee.cadastro_empresa?.razao_social} /> <InfoField label="Empreendimento Atual" value={employee.empreendimentos?.nome} /> <InfoField label="Data de Admissão" value={employee.admission_date ? new Date(employee.admission_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'} /> <InfoField label="Salário Base" value={employee.base_salary} /> <InfoField label="Observações" value={employee.observations} fullWidth={true} /> </dl> )}
                    {activeTab === 'endereco' && ( <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"> <InfoField label="CEP" value={employee.cep} /> <InfoField label="Logradouro" value={`${employee.address_street || ''}, ${employee.address_number || ''}`} /> <InfoField label="Complemento" value={employee.address_complement} /> <InfoField label="Bairro" value={employee.neighborhood} /> <InfoField label="Cidade" value={employee.city} /> <InfoField label="Estado" value={employee.state} /> </dl> )}
                    {activeTab === 'documentos' && ( <DocumentosSection documentos={allDocuments} employeeId={employee.id} employeeName={employee.full_name} onUpdate={onUpdate} /> )}
                </div>
            </div>
        </div>
    );
}