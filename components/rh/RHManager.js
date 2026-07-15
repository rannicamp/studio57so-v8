"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUsers, faUpload, faUserCheck, faUserSlash, faUserTie, faUserCircle, faBriefcase, faSearch, faPlus
} from '@fortawesome/free-solid-svg-icons';
import ColaboradorDetailPanel from './ColaboradorDetailPanel';
import PontoImporter from './PontoImporter';
import FuncionarioModal from './FuncionarioModal';

export default function RHManager() {
  const supabase = createClient();
  const { user } = useAuth();
  const organizacaoId = user?.organizacao_id;

  const [employees, setEmployees] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  // Controle do Grupo Ativo no Menu Esquerdo
  const [grupoAtivo, setGrupoAtivo] = useState('ativos');
  // Painel 3/4 Direita (Master-Detail Ficha Completa)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [isCandidateSelected, setIsCandidateSelected] = useState(false);

  // Modal Global de Importação de Ponto e Novo Colaborador
  const [isPontoModalOpen, setIsPontoModalOpen] = useState(false);
  const [isFuncionarioModalOpen, setIsFuncionarioModalOpen] = useState(false);

  const fetchAllData = useCallback(async () => {
    if (!organizacaoId) return;
    setLoading(true);

    const [funcionariosRes, contatosRes] = await Promise.all([
      supabase
        .from('funcionarios')
        .select(`
          id, full_name, foto_url, status, cpf,
          cargos (id, nome), cadastro_empresa(id, razao_social)
        `)
        .eq('organizacao_id', organizacaoId)
        .order('full_name', { ascending: true }),

      supabase
        .from('contatos')
        .select('id, nome, razao_social, foto_url, cargo')
        .eq('organizacao_id', organizacaoId)
        .eq('tipo_contato', 'Candidato')
        .eq('lixeira', false)
    ]);

    let loadedAtivos = [];
    if (funcionariosRes.data) {
      const mappedEmployees = funcionariosRes.data.map(e => {
        let finalUrl = e.foto_url;
        if (finalUrl && !finalUrl.startsWith('http')) {
          finalUrl = supabase.storage.from('funcionarios-documentos').getPublicUrl(finalUrl).data?.publicUrl;
        }
        return { ...e, foto_url: finalUrl };
      });
      setEmployees(mappedEmployees);
      loadedAtivos = mappedEmployees.filter(e => e.status !== 'Demitido');
    } else {
      console.error("Erro ao carregar funcionários:", funcionariosRes.error);
    }

    if (contatosRes.data) {
      const mappedCandidates = contatosRes.data.map(c => {
        let finalUrl = c.foto_url;
        if (finalUrl && !finalUrl.startsWith('http')) {
          finalUrl = supabase.storage.from('avatars').getPublicUrl(finalUrl).data?.publicUrl;
        }
        return {
          id: c.id,
          full_name: c.nome || c.razao_social,
          foto_url: finalUrl,
          contract_role: c.cargo || 'Candidato',
          status: 'Candidato'
        };
      });
      setCandidates(mappedCandidates);
    }

    // Seleção automática ao carregar se nada estiver selecionado
    if (loadedAtivos.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(loadedAtivos[0].id);
      setIsCandidateSelected(false);
    }

    setLoading(false);
  }, [supabase, organizacaoId, selectedEmployeeId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleSelectEmployee = (employee) => {
    setSelectedEmployeeId(employee.id);
    setIsCandidateSelected(employee.status === 'Candidato');
  };

  const handleChavearGrupo = (novoGrupo) => {
    setGrupoAtivo(novoGrupo);
    setSearchQuery(""); // Limpa a busca ao trocar de grupo

    let lista = [];
    let isCandidate = false;
    if (novoGrupo === 'ativos') {
      lista = employees.filter(e => e.status !== 'Demitido');
    } else if (novoGrupo === 'candidatos') {
      lista = candidates;
      isCandidate = true;
    } else {
      lista = employees.filter(e => e.status === 'Demitido');
    }

    if (lista.length > 0) {
      setSelectedEmployeeId(lista[0].id);
      setIsCandidateSelected(isCandidate);
    } else {
      setSelectedEmployeeId(null);
      setIsCandidateSelected(false);
    }
  };

  // Agrupamentos Básicos
  const ativos = employees.filter(e => e.status !== 'Demitido');
  const demitidos = employees.filter(e => e.status === 'Demitido');

  const getFilteredList = (list) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(e => 
      e.full_name?.toLowerCase().includes(q) || 
      e.cpf?.includes(q) || 
      e.cargos?.nome?.toLowerCase().includes(q) ||
      e.contract_role?.toLowerCase().includes(q)
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <FontAwesomeIcon icon={faSpinner} spin size="4x" className="text-blue-600 mb-6" />
        <h2 className="text-xl font-bold text-gray-800">Sincronizando Departamento Pessoal...</h2>
        <p className="text-gray-500">Montando quadro geral de colaboradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12 w-full max-w-[1920px] mx-auto">
      {/* CABEÇALHO UNIFICADO "PADRÃO OURO" */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-800">Recursos Humanos</h2>
          </div>
          <p className="text-gray-500 font-medium">Gestão estratégica de colaboradores, controle de ponto e talentos.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
          <button
            onClick={() => setIsFuncionarioModalOpen(true)}
            className="bg-black hover:bg-gray-900 text-white text-xs md:text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-transform hover:-translate-y-0.5 w-full justify-center md:w-auto"
          >
            <FontAwesomeIcon icon={faPlus} /> Novo Colaborador
          </button>
          <button
            onClick={() => setIsPontoModalOpen(true)}
            className="bg-white border border-gray-300 text-gray-700 text-xs md:text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2 hover:bg-gray-50 transition-colors w-full justify-center md:w-auto"
          >
            <FontAwesomeIcon icon={faUpload} className="text-gray-400" /> Importar Ponto (REP)
          </button>
        </div>
      </div>

      {/* MASTER-DETAIL */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LADO ESQUERDO (1/4): LISTAGEM DE COLABORADORES */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Colaboradores</h3>
          
          {/* Chaveador de Abas Pílula */}
          <div className="flex bg-gray-100 p-1 rounded-lg shadow-sm border border-gray-200">
            <button
              onClick={() => handleChavearGrupo('ativos')}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md transition-all ${grupoAtivo === 'ativos' ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Ativos ({ativos.length})
            </button>
            <button
              onClick={() => handleChavearGrupo('candidatos')}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md transition-all ${grupoAtivo === 'candidatos' ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Talentos ({candidates.length})
            </button>
            <button
              onClick={() => handleChavearGrupo('demitidos')}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md transition-all ${grupoAtivo === 'demitidos' ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Demitidos ({demitidos.length})
            </button>
          </div>

          {/* Barra de Pesquisa */}
          <div className="relative shadow-sm rounded-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-sm" />
            </div>
            <input
              type="text"
              placeholder="Buscar nome, cargo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium transition-shadow"
            />
          </div>

          {/* Lista Plana (Estilo Extrato) */}
          <div className="bg-white border text-sm rounded-lg flex flex-col shadow-sm overflow-y-auto max-h-[600px] custom-scrollbar">
            {getFilteredList(grupoAtivo === 'ativos' ? ativos : grupoAtivo === 'candidatos' ? candidates : demitidos).length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-medium bg-gray-50/50">
                Nenhum colaborador encontrado.
              </div>
            ) : (
              getFilteredList(grupoAtivo === 'ativos' ? ativos : grupoAtivo === 'candidatos' ? candidates : demitidos).map(emp => {
                const isSelected = selectedEmployeeId === emp.id;
                return (
                  <div
                    key={emp.id}
                    className={`border-b last:border-0 transition-all border-l-4 ${isSelected ? 'border-l-blue-500' : 'border-l-transparent'}`}
                  >
                    <div className={`flex items-center ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
                      <button
                        onClick={() => handleSelectEmployee(emp)}
                        className="flex-1 text-left p-4 flex items-center gap-3"
                      >
                        {/* Mini Avatar */}
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 bg-gray-100 ${isSelected ? 'ring-2 ring-blue-100' : ''}`}>
                          {emp.foto_url ? (
                            <img src={emp.foto_url} alt={emp.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <FontAwesomeIcon icon={faUserCircle} className="text-gray-300 text-lg" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-bold truncate text-[13px] ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                            {emp.full_name}
                          </div>
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider truncate mt-0.5 flex items-center gap-1.5 font-semibold">
                            <FontAwesomeIcon icon={faBriefcase} className="text-gray-400" />
                            {emp.cargos?.nome || emp.contract_role || 'S/ Cargo'}
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* LADO DIREITO (3/4): PAINEL FIXO DA FICHA FUNCIONAL COMPLETA */}
        <div className="lg:col-span-3 h-full">
          <ColaboradorDetailPanel
            selectedId={selectedEmployeeId}
            isCandidateSelected={isCandidateSelected}
            onEmployeeUpdate={fetchAllData}
          />
        </div>
      </div>

      {/* Modal Global de Importação Ponto */}
      {isPontoModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden relative transform transition-all scale-100">
            <div className="px-6 py-5 border-b flex justify-between items-center bg-gray-50/80 sticky top-0 z-10">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faUpload} className="text-purple-600" />
                Importador Cérebro de Ponto (REP)
              </h2>
              <button
                onClick={() => setIsPontoModalOpen(false)}
                className="text-gray-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
              <PontoImporter onImportSuccess={() => {}} />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação de Novo Funcionário / Candidato */}
      {isFuncionarioModalOpen && (
        <FuncionarioModal
          isOpen={isFuncionarioModalOpen}
          onClose={() => setIsFuncionarioModalOpen(false)}
          initialData={null}
          onSaveSuccess={fetchAllData}
        />
      )}
    </div>
  );
}
