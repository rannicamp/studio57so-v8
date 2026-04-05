"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHistory, faSpinner, faFilter, 
  faArrowRight, faPlus, faTrash, faEdit, faUserShield,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AuditoriaManager() {
  const { user } = useAuth();
  const organizacao_id = user?.organizacao_id;
  const supabase = createClient();

  const [diasBusca, setDiasBusca] = useState(30);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('TODAS');
  const [filtroUsuario, setFiltroUsuario] = useState('TODOS');

  const fetchHistorico = async () => {
    if (!organizacao_id) return [];

    let limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasBusca);

    // 1. Busca os logs no banco
    const { data: logs, error } = await supabase
      .from('historico_lancamentos_financeiros')
      .select(`
        id,
        acao,
        campo_alterado,
        valor_antigo,
        valor_novo,
        criado_em,
        usuario_id,
        alterado_apos_conciliacao,
        lancamentos(id, descricao)
      `)
      .eq('organizacao_id', organizacao_id)
      .gte('criado_em', limiteData.toISOString())
      .order('criado_em', { ascending: false });

    if (error) {
      console.error("Erro ao buscar auditoria:", error);
      throw error;
    }

    if (!logs || logs.length === 0) return [];

    // 2. Extrai UUIDs de usuários únicos e busca seus nomes na tabela de usuários real
    const userIds = [...new Set(logs.map(log => log.usuario_id).filter(Boolean))];
    let mapUsuarios = {};

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('usuarios')
        .select('id, nome, sobrenome')
        .in('id', userIds);
      
      if (users) {
        users.forEach(u => {
          mapUsuarios[u.id] = `${u.nome || ''} ${u.sobrenome || ''}`.trim() || u.id;
        });
      }
    }

    // 3. Mescla os nomes para a view final
    return logs.map(log => ({
      ...log,
      usuario_nome: mapUsuarios[log.usuario_id] || log.usuario_id || 'Sistema'
    }));
  };

  const { data: historico, isLoading } = useQuery({
    queryKey: ['auditoria_financeira_table', organizacao_id, diasBusca],
    queryFn: fetchHistorico,
    enabled: !!organizacao_id,
    refetchInterval: false
  });

  const formatAcaoPill = (acao) => {
    switch(acao) {
      case 'INSERT': 
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><FontAwesomeIcon icon={faPlus} /> Criação</span>;
      case 'DELETE': 
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200"><FontAwesomeIcon icon={faTrash} /> Exclusão</span>;
      case 'UPDATE': 
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><FontAwesomeIcon icon={faEdit} /> Edição</span>;
      default: 
        return acao;
    }
  };

  // Funcao para formatar valores antigos e novos caso sejam datas ISO ou booleanos feios
  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return <span className="text-gray-400 italic">vazio</span>;
    if (val === 'true') return <span className="text-green-600 font-medium">Verdadeiro</span>;
    if (val === 'false') return <span className="text-red-600 font-medium">Falso</span>;
    
    // Simplifica strings longas
    return <span className="break-all">{val}</span>;
  };

  const historicoFiltrado = historico?.filter(item => {
    let matches = true;
    
    if (filtroAcao !== 'TODAS') {
      matches = matches && item.acao === filtroAcao;
    }
    
    if (filtroUsuario !== 'TODOS') {
      matches = matches && item.usuario_id === filtroUsuario;
    }
    
    if (termoBusca.trim() !== '') {
      const term = termoBusca.toLowerCase();
      const descLanc = (Array.isArray(item.lancamentos) ? item.lancamentos[0]?.descricao : item.lancamentos?.descricao) || '';
      const stringData = `${item.campo_alterado || ''} ${descLanc} ${item.valor_antigo || ''} ${item.valor_novo || ''} ${item.usuario_nome || ''}`.toLowerCase();
      matches = matches && stringData.includes(term);
    }
    
    return matches;
  });

  return (
    <div className="space-y-4">
      {/* Barra de Ferramentas / Título */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-lg border border-indigo-100">
            <FontAwesomeIcon icon={faUserShield} className="text-indigo-600 text-lg" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Visualização em Tabela</h3>
            <p className="text-xs text-gray-500 hidden sm:block">Registro linha a linha imutável</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-3 sm:mt-0">
          <FontAwesomeIcon icon={faFilter} className="text-gray-400 text-sm hidden sm:block" />
          <input 
            type="text" 
            placeholder="Buscar termo, campo, valor..." 
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-56 px-3 py-2"
          />
          <select 
            value={filtroAcao} 
            onChange={(e) => setFiltroAcao(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2"
          >
            <option value="TODAS">Ação (Todas)</option>
            <option value="INSERT">Criação</option>
            <option value="UPDATE">Edição</option>
            <option value="DELETE">Exclusão</option>
          </select>
          <select 
            value={filtroUsuario} 
            onChange={(e) => setFiltroUsuario(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 max-w-[150px] truncate"
          >
            <option value="TODOS">Usuários (Todos)</option>
            {historico && [...new Map(historico.map(item => [item.usuario_id, item.usuario_nome])).entries()].filter(x => x[0]).map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
            ))}
          </select>
          <select 
            value={diasBusca} 
            onChange={(e) => setDiasBusca(Number(e.target.value))}
            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block px-3 py-2 cursor-pointer font-medium hover:bg-gray-100 transition-colors"
          >
            <option value={7}>Últ. 7 dias</option>
            <option value={15}>Últ. 15 dias</option>
            <option value={30}>Últ. 30 dias</option>
            <option value={90}>Últ. 90 dias</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col justify-center items-center py-24 bg-white rounded-xl border border-gray-200 shadow-sm">
          <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-indigo-500 mb-4" />
          <span className="text-gray-500 font-medium">Compilando e descriptografando trilha de auditoria...</span>
        </div>
      ) : historico?.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-24 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="bg-gray-50 p-4 rounded-full mb-4">
            <FontAwesomeIcon icon={faHistory} size="2x" className="text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-700">Audit Trail Limpo</h3>
          <p className="text-gray-500 text-sm mt-1">Sua organização não teve registros adulterados/modificados nestes últimos {diasBusca} dias.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-5 py-4 font-semibold w-40">Data & Hora</th>
                  <th scope="col" className="px-5 py-4 font-semibold w-56">Usuário Responsável</th>
                  <th scope="col" className="px-5 py-4 font-semibold w-64">Lançamento Financeiro</th>
                  <th scope="col" className="px-5 py-4 font-semibold w-32">Ação</th>
                  <th scope="col" className="px-5 py-4 font-semibold min-w-[300px]">Detalhamento Específico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/80">
                {historicoFiltrado && historicoFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-gray-500 italic">
                      Nenhum registro encontrado para estes filtros.
                    </td>
                  </tr>
                ) : historicoFiltrado?.map((item, idx) => {
                  let descLancamento = item.lancamentos?.descricao;
                  if (!descLancamento && item.lancamentos) {
                     // Pode ser um array dependendo de como o supabase montou na query
                     if(Array.isArray(item.lancamentos)) descLancamento = item.lancamentos[0]?.descricao;
                  }
                  
                  return (
                    <tr key={item.id} className={`transition-colors group hover:bg-slate-50/50 ${item.alterado_apos_conciliacao ? 'bg-red-50/50 border-l-4 border-l-red-500' : ''}`}>
                      <td className="px-5 py-4 whitespace-nowrap text-gray-600 font-medium">
                        {format(parseISO(item.criado_em), "dd/MM/yy 'às' HH:mm")}
                      </td>
                      
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800">{item.usuario_nome}</span>
                          {/* Exibe o id de forma sutil apenas no hover da linha para auditoria avancada */}
                          <span className="text-[10px] text-gray-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity" title="ID do Auth Supabase">
                            {item.usuario_id?.split('-')[0]}...
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-gray-700">
                        <div className="font-medium line-clamp-2">
                          {descLancamento || <span className="text-gray-400 italic">ID original: {item.lancamento_id}</span>}
                        </div>
                        {item.alterado_apos_conciliacao && (
                          <div className="mt-2 text-[10px] font-bold text-red-700 flex items-center gap-1.5 bg-red-100/50 border border-red-200 px-2 py-1 rounded inline-flex uppercase">
                            <FontAwesomeIcon icon={faExclamationTriangle} /> Atenção: Alterado após conciliado
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {formatAcaoPill(item.acao)}
                      </td>

                      <td className="px-5 py-4">
                        {item.acao === 'UPDATE' ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Alterou o campo <span className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded normal-case tracking-normal">{item.campo_alterado}</span>
                            </div>
                            <div className="bg-white p-2 rounded border border-gray-100 flex items-center gap-3 text-xs shadow-sm">
                              <span className="bg-red-50 text-red-700 line-through px-2 py-1 rounded max-w-[150px] truncate block" title={item.valor_antigo}>
                                {formatValue(item.valor_antigo)}
                              </span>
                              <FontAwesomeIcon icon={faArrowRight} className="text-gray-300" />
                              <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded max-w-[150px] truncate block" title={item.valor_novo}>
                                {formatValue(item.valor_novo)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-500 italic text-sm">
                            {item.campo_alterado || 'Lançamento totalmente afetado'}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
