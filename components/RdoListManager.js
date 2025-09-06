"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';

// O componente agora recebe a propriedade 'isAdmin'
export default function RdoListManager({ initialRdos, empreendimentosList, responsaveisList, isAdmin }) {
  const supabase = createClient();
  const router = useRouter(); 
  const [rdos, setRdos] = useState(initialRdos);
  const [message, setMessage] = useState('');
  
  const [isFiltersVisible, setIsFiltersVisible] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState('');
  const [selectedResponsavel, setSelectedResponsavel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const setPeriod = (period) => {
    const end = new Date();
    const start = new Date();
    if (period === 'week') {
      start.setDate(end.getDate() - 7);
    } else if (period === 'month') {
      start.setMonth(end.getMonth() - 1);
    }
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const filteredRdos = useMemo(() => {
    return rdos.filter(rdo => {
      const rdoDate = new Date(rdo.data_relatorio + 'T00:00:00');
      
      const matchEmpreendimento = !selectedEmpreendimento || rdo.empreendimento_id?.toString() === selectedEmpreendimento;
      
      // O PORQUÊ: A lógica de filtro foi atualizada. Agora, comparamos
      // o 'rdo.usuario_responsavel_id' com o ID do usuário selecionado no filtro.
      const matchResponsavel = !selectedResponsavel || rdo.usuario_responsavel_id === selectedResponsavel;
      
      const matchStartDate = !startDate || rdoDate >= new Date(startDate + 'T00:00:00');
      const matchEndDate = !endDate || rdoDate <= new Date(endDate + 'T00:00:00');
      
      const matchSearchTerm = !searchTerm || JSON.stringify(rdo).toLowerCase().includes(searchTerm.toLowerCase());

      return matchEmpreendimento && matchResponsavel && matchStartDate && matchEndDate && matchSearchTerm;
    });
  }, [rdos, searchTerm, selectedEmpreendimento, selectedResponsavel, startDate, endDate]);

  const handleDeleteRdo = async (e, rdoId) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir este Diário de Obra?')) return;
    
    setMessage('Excluindo RDO...');
    const { error } = await supabase.from('diarios_obra').delete().eq('id', rdoId);
    if (error) setMessage(`Erro ao excluir RDO: ${error.message}`);
    else {
      setMessage('Diário de Obra excluído com sucesso!');
      setRdos(prevRdos => prevRdos.filter(rdo => rdo.id !== rdoId));
    }
  };

  const handleRowClick = (rdoId) => {
    router.push(`/rdo/${rdoId}`);
  };

  return (
    <div className="space-y-6">
      <button 
        onClick={() => setIsFiltersVisible(!isFiltersVisible)}
        className="text-lg font-semibold text-gray-800 flex items-center gap-2"
      >
        Filtros
        <span className="transform transition-transform duration-200">
          {isFiltersVisible ? '▲' : '▼'}
        </span>
      </button>

      {isFiltersVisible && (
        <div className="p-4 bg-gray-50 border rounded-lg space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select onChange={(e) => setSelectedEmpreendimento(e.target.value)} value={selectedEmpreendimento} className="p-2 border rounded-md">
              <option value="">Todos Empreendimentos</option>
              {empreendimentosList.map(emp => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
            </select>
            
            {/* O PORQUÊ: O filtro de responsáveis agora é populado com a lista de usuários.
                O 'value' de cada opção é o ID do usuário, e o texto é o nome completo. */}
            <select onChange={(e) => setSelectedResponsavel(e.target.value)} value={selectedResponsavel} className="p-2 border rounded-md">
              <option value="">Todos Responsáveis</option>
              {responsaveisList.map(resp => (
                <option key={resp.id} value={resp.id}>
                  {`${resp.nome} ${resp.sobrenome}`}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="flex gap-2">
              <button onClick={() => setPeriod('week')} className="p-2 bg-gray-200 rounded-md text-sm w-full">Esta Semana</button>
              <button onClick={() => setPeriod('month')} className="p-2 bg-gray-200 rounded-md text-sm w-full">Este Mês</button>
            </div>
            <div>
              <label className="text-xs">Data Início</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border rounded-md w-full" />
            </div>
            <div>
              <label className="text-xs">Data Fim</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border rounded-md w-full" />
            </div>
            <input
              type="text"
              placeholder="Buscar em todo o conteúdo do RDO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-2 border rounded-md w-full lg:col-span-4"
            />
          </div>
        </div>
      )}

      {message && <div className={`p-3 rounded-md text-sm ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Empreendimento</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Responsável</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Praticável</th>
              <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRdos.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-4 text-center">Nenhum Diário de Obra encontrado.</td></tr>
            ) : (
              filteredRdos.map((rdo) => (
                <tr key={rdo.id} onClick={() => handleRowClick(rdo.id)} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-6 py-4">{new Date(rdo.data_relatorio + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4">{rdo.empreendimentos?.nome || 'N/A'}</td>
                  
                  {/* O PORQUÊ: A célula do responsável agora exibe o nome e sobrenome do usuário.
                      Se por algum motivo o usuário não for encontrado (ex: um RDO muito antigo),
                      ele ainda exibe o e-mail antigo como um fallback. */}
                  <td className="px-6 py-4">
                    {rdo.usuarios ? `${rdo.usuarios.nome} ${rdo.usuarios.sobrenome}` : (rdo.responsavel_rdo || 'N/A')}
                  </td>

                  <td className="px-6 py-4">{rdo.condicoes_trabalho === 'Praticável' ? 'Sim' : 'Não'}</td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <button onClick={(e) => handleDeleteRdo(e, rdo.id)} className="text-red-600 hover:text-red-900 z-10 relative">Excluir</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}