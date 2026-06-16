'use client';

import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faLink, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

// Detecta a unidade de uma medida a partir do label
function detectarUnidade(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('volume'))      return 'm³';
  if (l.includes('área') || l.includes('area')) return 'm²';
  if (l.includes('comprimento') || l.includes('length')) return 'm';
  if (l.includes('diâmetro') || l.includes('diametro')) return 'mm';
  return 'un';
}

const fmt2 = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

export default function BimElementPropertiesModal({
  isOpen,
  onClose,
  elemento, // { id, external_id, categoria, familia, tipo, propriedades }
  propriedadesMapeadas, // Set contendo chaves mapeadas
  onVincularPropriedade, // (propNome, propValor)
}) {
  const [busca, setBusca] = useState('');
  const [mostrarTodas, setMostrarTodas] = useState(false);

  const propriedadesFiltradas = useMemo(() => {
    if (!elemento || !elemento.propriedades) return [];

    const entries = Object.entries(elemento.propriedades);
    const lista = entries
      .map(([chave, valor]) => {
        if (!chave || chave.startsWith('<') || chave.includes('id') || chave === 'projeto_bim_id') return null;

        const valNum = parseFloat(valor);
        const ehNumerico = !isNaN(valNum);
        const temValorNumerico = ehNumerico && valNum > 0;

        return {
          chave,
          valorOriginal: valor,
          valorNumerico: ehNumerico ? valNum : 0,
          ehNumerico,
          temValorNumerico,
          unidade: ehNumerico ? detectarUnidade(chave) : 'txt'
        };
      })
      .filter(Boolean);

    // Ordenação: numéricas com valor primeiro, depois outras numéricas, depois textuais
    return lista.sort((a, b) => {
      if (a.temValorNumerico && !b.temValorNumerico) return -1;
      if (!a.temValorNumerico && b.temValorNumerico) return 1;
      if (a.ehNumerico && !b.ehNumerico) return -1;
      if (!a.ehNumerico && b.ehNumerico) return 1;
      return a.chave.localeCompare(b.chave);
    });
  }, [elemento]);

  // Filtra as propriedades baseado na busca e na opção de mostrar todas
  const propriedadesExibidas = useMemo(() => {
    return propriedadesFiltradas.filter(p => {
      const correspondeBusca = p.chave.toLowerCase().includes(busca.toLowerCase()) || 
                               String(p.valorOriginal).toLowerCase().includes(busca.toLowerCase());
      
      if (!correspondeBusca) return false;
      if (mostrarTodas) return true;
      return p.temValorNumerico; // Exibe por padrão apenas propriedades numéricas com valor ativo
    });
  }, [propriedadesFiltradas, busca, mostrarTodas]);

  if (!isOpen || !elemento) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      {/* Container do Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-700 text-white px-6 py-5 flex-shrink-0 relative">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-white/70 hover:text-white w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-all"
            title="Fechar"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
          <p className="text-[10px] uppercase tracking-widest font-semibold opacity-75 mb-0.5">
            {elemento.categoria} {elemento.familia ? `› ${elemento.familia}` : ''} {elemento.tipo ? `› ${elemento.tipo}` : ''}
          </p>
          <h2 className="text-lg font-bold">Propriedades da Instância</h2>
          <p className="text-xs opacity-80 mt-0.5 font-mono">
            ID: {elemento.external_id}
          </p>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="bg-gray-50 border-b border-gray-150 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar propriedade ou valor..."
              className="w-full pl-3 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-650 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mostrarTodas}
                onChange={(e) => setMostrarTodas(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-450 focus:ring-offset-0 w-3.5 h-3.5"
              />
              Mostrar parâmetros vazios ou de texto
            </label>
          </div>
        </div>

        {/* Corpo do Modal - Lista de Propriedades */}
        <div className="flex-1 overflow-y-auto p-6">
          {propriedadesExibidas.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FontAwesomeIcon icon={faInfoCircle} className="text-2xl mb-2 text-gray-300" />
              <p className="text-xs font-bold uppercase tracking-wider">Nenhuma propriedade encontrada</p>
              <p className="text-[11px] mt-1">
                {mostrarTodas ? 'Tente ajustar os termos da busca.' : 'Não há propriedades numéricas ativas. Marque a caixa acima para ver todos os parâmetros.'}
              </p>
            </div>
          ) : (
            <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 bg-white shadow-sm">
              {propriedadesExibidas.map((p) => {
                const jaMapeada = propriedadesMapeadas?.has(p.chave);

                return (
                  <div 
                    key={p.chave} 
                    className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 transition-colors group"
                  >
                    {/* Nome da Propriedade */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-750 truncate" title={p.chave}>
                        {p.chave}
                      </p>
                      <p className="text-[10px] text-gray-455 font-mono mt-0.5 truncate" title={String(p.valorOriginal)}>
                        Valor Bruto: {String(p.valorOriginal)}
                      </p>
                    </div>

                    {/* Valor Formatado + Unidade */}
                    <div className="text-right shrink-0 flex items-center gap-2">
                      {p.ehNumerico && (
                        <>
                          <span className="text-xs font-bold text-gray-800">
                            {fmt2(p.valorNumerico)}
                          </span>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded font-mono bg-gray-100 text-gray-500 border border-gray-150">
                            {p.unidade}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Ação (Vincular) */}
                    <div className="w-20 text-right shrink-0">
                      {jaMapeada ? (
                        <span className="text-[9px] bg-green-150 text-green-700 border border-green-255 px-2 py-0.5 rounded-full font-extrabold uppercase select-none">
                          Vinculado
                        </span>
                      ) : p.temValorNumerico ? (
                        <button
                          onClick={() => onVincularPropriedade(p.chave, p.valorNumerico)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1.5 ml-auto active:scale-95 shadow-sm"
                          title={`Vincular parâmetro ${p.chave} ao orçamento`}
                        >
                          <FontAwesomeIcon icon={faLink} />
                          vincular
                        </button>
                      ) : (
                        <span className="text-gray-300 text-[10px] font-medium">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button 
            onClick={onClose} 
            className="px-5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-750 text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
