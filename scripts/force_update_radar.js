const fs = require('fs');

const content = `// Código completo e restaurado do Radar Studio
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRadarStats, resolveMetaIds, getDicionarioContatos } from './actions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMobileAlt, faDesktop, faEye, faGlobe, faSpinner, faExclamationTriangle, faFilter, faFunnelDollar, faChartPie, faChartLine, faBullhorn } from '@fortawesome/free-solid-svg-icons';
import { faMeta } from '@fortawesome/free-brands-svg-icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import AdsManager from '@/components/comercial/AdsManager';

export default function RadarPage() {
  const [activeTab, setActiveTab] = useState('radar');
  const [somenteMarketing, setSomenteMarketing] = useState(true);
  const [periodo, setPeriodo] = useState(30);

  const fetchData = async () => {
    const queryData = await getRadarStats(parseInt(periodo), somenteMarketing);

    // Mágica para pegar Nomes de Campanha, AdSet e Ads da API do Meta Graph
    try {
      const [resCamp, resAds, dictCrm] = await Promise.all([
        fetch('/api/meta/campaigns'),
        fetch('/api/meta/ads'),
        getDicionarioContatos()
      ]);
      const metaCamp = resCamp.ok ? await resCamp.json() : {};
      const metaAds = resAds.ok ? await resAds.json() : {};

      const dictNomes = { ...dictCrm };
      if (metaCamp.campaigns) metaCamp.campaigns.forEach(c => dictNomes[c.id] = c.name);
      if (metaCamp.adsets) metaCamp.adsets.forEach(c => dictNomes[c.id] = c.name);
      if (metaAds.data) {
         metaAds.data.forEach(c => {
            dictNomes[c.id] = c.name;
            if (c.adset_id) dictNomes[c.adset_id] = c.adset_name;
            if (c.campaign_id) dictNomes[c.campaign_id] = c.campaign_name;
         });
      }

      if (queryData?.topCampanhas) {
         const fallbackIds = [];
         queryData.topCampanhas.forEach(camp => {
             const idAnuncio = camp.anuncio_id;
             if (idAnuncio && /^\\d{15,}$/.test(idAnuncio) && !dictNomes[idAnuncio]) {
                 fallbackIds.push(idAnuncio);
             }
         });

         if (fallbackIds.length > 0) {
             const resolvedDict = await resolveMetaIds(fallbackIds);
             Object.assign(dictNomes, resolvedDict);
         }

         queryData.topCampanhas = queryData.topCampanhas.map(camp => {
            let nomeAnuncio = dictNomes[camp.anuncio_id] || camp.anuncio_id || 'Não especificado';
            if (/^\\d{15,}$/.test(nomeAnuncio)) {
               nomeAnuncio = \\\`ID: \\\${nomeAnuncio} (Excluído / Órfão)\\\`;
            }
            return {
               ...camp,
               nome_campanha: dictNomes[camp.campanha_id] || dictNomes[camp.nome_campanha] || camp.nome_campanha || camp.campanha_id || 'Indefinida',
               nome_anuncio: nomeAnuncio
            };
         });
      }
    } catch (e) {
      console.warn('Erro fetch API Meta internamente', e);
    }
    return queryData;
  };

  const { data: stats, isLoading: loading, isError: error } = useQuery({
    queryKey: ['radarStats', periodo, somenteMarketing],
    queryFn: fetchData,
    refetchInterval: 30000
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
      <FontAwesomeIcon icon={faSpinner} spin className="text-4xl mb-4 text-indigo-500"/> <p>Calibrando Radar...</p>
    </div>
  );
  if (error || !stats) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-red-500">
      <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl mb-4"/> <p>Não foi possível carregar os dados.</p>
    </div>
  );

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#64748b'];

  const total = stats.totalVisitas || 0;
  const mobile = stats.porDispositivo?.mobile || 0;
  const desktop = stats.porDispositivo?.desktop || 0;
  const origens = stats.topOrigens || [];
  const paginas = stats.topPaginas || [];
  const funil = stats.funil || [];
  const ecossistemas = stats.ecossistemas || [];
  const campanhas = stats.topCampanhas || [];
  
  const melhorCanal = origens.length > 0 ? origens[0] : { nome: 'N/A', qtd: 0 };
  const conversaoMedia = funil.length > 0 
    ? (funil.reduce((acc, f) => acc + (f.visitas_obrigado||0), 0) / funil.reduce((acc, f) => acc + (f.visitas_landing||0), 0) * 100).toFixed(1)
    : 0;

  if (activeTab === 'ads') {
    return (
      <div className="p-4 md:p-6 lg:p-8 bg-gray-50/50 min-h-screen animate-fade-in-up">
        <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
              <FontAwesomeIcon icon={faMeta} className="text-blue-600 mr-3 text-3xl" />
              Hub de Marketing
            </h1>
            <p className="text-sm text-gray-500 mt-1">Gerenciamento unificado de campanhas e inteligência de tráfego.</p>
          </div>
          <div className="bg-gray-100 p-1 rounded-lg flex">
            <button onClick={() => setActiveTab('radar')} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition text-gray-600 hover:bg-white hover:shadow-sm">
              <FontAwesomeIcon icon={faChartLine} /> Radar (Site)
            </button>
            <button onClick={() => setActiveTab('ads')} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition bg-white text-gray-900 shadow-sm border border-gray-200">
              <FontAwesomeIcon icon={faBullhorn} /> Gestão Meta Ads
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto"><AdsManager /></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50/50 flex justify-center w-full">
      <div className="max-w-7xl w-full">
        
        {/* CABEÇALHO */}
        <div className="mb-8 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
              <FontAwesomeIcon icon={faEye} className="text-blue-600 mr-3 text-3xl" />
              Radar Studio
            </h1>
            <p className="text-sm text-gray-500 mt-1">Inteligência de Tráfego e Comportamento Digital</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="bg-gray-100 p-1 rounded-lg flex">
              <button onClick={() => setActiveTab('radar')} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition bg-white text-gray-900 shadow-sm border border-gray-200">
                <FontAwesomeIcon icon={faChartLine} /> Radar (Site)
              </button>
              <button onClick={() => setActiveTab('ads')} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition text-gray-500 hover:text-gray-900">
                <FontAwesomeIcon icon={faBullhorn} /> Gestão Meta Ads
              </button>
            </div>
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setSomenteMarketing(!somenteMarketing)} className={\`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors \${somenteMarketing ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-gray-600'}\`}>
                <FontAwesomeIcon icon={faFilter} className={somenteMarketing ? 'text-indigo-500' : ''} />
                {somenteMarketing ? 'Filtro Marketing' : 'Geral'}
              </button>
              <select value={periodo} onChange={(e) => setPeriodo(parseInt(e.target.value))} className="bg-white border-0 rounded-md text-sm px-2 py-1.5 text-gray-700">
                <option value={7}>7 dias</option>
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
                <option value={90}>3 meses</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-6 animate-fade-in-up pb-10">
          {/* 1. KPIs Principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Acessos Reais</p>
                <h3 className="text-3xl font-bold text-slate-800">{total}</h3>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                <FontAwesomeIcon icon={faEye} className="text-xl" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Taxa de Conversão</p>
                <h3 className="text-3xl font-bold text-slate-800">{conversaoMedia}%</h3>
                <p className="text-[10px] text-gray-400">Baseado em Landing Pages</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
                <FontAwesomeIcon icon={faFunnelDollar} className="text-xl" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-gray-500 text-sm font-medium mb-2">Dispositivos</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faMobileAlt} className="text-emerald-500" />
                  <span className="font-bold text-lg">{mobile}</span>
                </div>
                <div className="h-8 w-px bg-gray-200"></div>
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faDesktop} className="text-gray-500" />
                  <span className="font-bold text-lg">{desktop}</span>
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Melhor Canal</p>
                <h3 className="text-xl font-bold text-slate-800 truncate max-w-[120px]" title={melhorCanal.nome}>
                  {melhorCanal.nome.replace('https://', '').split('/')[0]}
                </h3>
                <p className="text-xs text-green-600 font-bold">
                  {melhorCanal.qtd} visitas
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-purple-600">
                <FontAwesomeIcon icon={faGlobe} className="text-xl" />
              </div>
            </div>
          </div>

          {/* LINHA 2: Funil e Ecossistemas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FontAwesomeIcon icon={faFunnelDollar} className="text-emerald-500" /> Funil por Empreendimento
              </h3>
              <div className="space-y-4 flex-1">
                {funil.map((item, idx) => (
                  <div key={idx} className="bg-gray-50 border border-gray-100 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-gray-700 capitalize">{item.produto.replace('/', '') || 'Geral'}</h4>
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">
                        {item.taxa_conversao}% Conversão
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div><span className="font-semibold text-gray-800">{item.visitas_landing}</span> Visitas na LP</div>
                      <FontAwesomeIcon icon={faGlobe} className="text-gray-300 mx-1" />
                      <div><span className="font-semibold text-gray-800">{item.visitas_obrigado}</span> Leads (Obrigado)</div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: \\\`\\\${item.taxa_conversao}%\\\` }}></div>
                    </div>
                  </div>
                ))}
                {funil.length === 0 && (
                  <div className="h-full flex items-center justify-center text-gray-400">Não há dados suficientes no funil para o período.</div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
              <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                <FontAwesomeIcon icon={faChartPie} className="text-purple-500" /> Distribuição de Ecossistemas
              </h3>
              <p className="text-xs text-gray-500 mb-4">Meta Ecosystem agrupa Instagram, Facebook e Anúncios Pagos.</p>
              <div className="h-[250px] w-full flex items-center justify-center">
                {ecossistemas.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ecossistemas}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="qtd"
                        nameKey="ecossistema"
                      >
                        {ecossistemas.map((entry, index) => (
                          <Cell key={\\\`cell-\\\${index}\\\`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-gray-400">Sem dados mapeados.</div>
                )}
              </div>
            </div>
          </div>

          {/* LINHA 3: Paginas e Origens Brutas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Páginas Mais Visitadas</h3>
              <div className="h-[300px] w-full">
                {paginas.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={paginas} margin={{ left: 0, right: 30 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="nome" type="category" width={150} tick={{fontSize: 11}} interval={0} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                      <Bar dataKey="qtd" barSize={20} radius={[0, 4, 4, 0]}>
                        {paginas.map((entry, index) => (
                          <Cell key={\\\`cell-\\\${index}\\\`} fill={index === 0 ? '#2563eb' : '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">Sem dados ainda.</div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Origem do Tráfego Detalhada</h3>
              <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {origens.map((origem, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="bg-white w-6 h-6 flex items-center justify-center rounded-full text-gray-400 border border-gray-200 text-xs font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-gray-700 truncate text-sm" title={origem.nome}>
                        {origem.nome.replace('https://', '').replace('http://', '').replace('www.', '')}
                      </span>
                    </div>
                    <span className="bg-white px-2 py-1 rounded-md text-xs font-bold text-indigo-600 border border-indigo-100 min-w-[2.5rem] text-center">
                      {origem.qtd}
                    </span>
                  </div>
                ))}
                {origens.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                    <FontAwesomeIcon icon={faGlobe} className="text-3xl mb-2" />
                    <p>Sem dados de origem.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* LINHA 4: Campanhas Meta / UTM - Layout Identado (Agrupado) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[250px]">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <FontAwesomeIcon icon={faGlobe} className="text-blue-500" /> Desempenho do Tráfego por Campanha
            </h3>
            <p className="text-xs text-gray-500 mb-6">Abaixo, a performance unificada das suas campanhas. Os conjuntos ou anúncios associados aparecem agrupados para facilitar a leitura do seu funil.</p>
            
            <div className="space-y-4">
              {(() => {
                 if (!campanhas || campanhas.length === 0) {
                    return (
                      <div className="py-8 text-center text-gray-400 bg-gray-50 border border-dashed rounded-lg">
                        Nenhuma campanha com rastreio registrada neste período.
                      </div>
                    );
                 }
                 
                 const grupos = {};
                 campanhas.forEach(camp => {
                    const cNome = camp.nome_campanha;
                    if (!grupos[cNome]) grupos[cNome] = { nome: cNome, total: 0, itens: [] };
                    grupos[cNome].total += parseInt(camp.qtd || 0);
                    grupos[cNome].itens.push(camp);
                 });
                 
                 const gruposArray = Object.values(grupos).sort((a,b) => b.total - a.total);
                 
                 return gruposArray.map((grupo, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                       <div className="bg-gray-50 p-4 flex justify-between items-center border-b border-gray-100">
                          <div className="flex items-center gap-3">
                             <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                             <span className="font-bold text-gray-800">{grupo.nome}</span>
                          </div>
                          <span className="bg-blue-600 text-white font-bold px-3 py-1 rounded-full text-xs">
                            {grupo.total} cliques totais
                          </span>
                       </div>
                       
                       <div className="bg-white p-0">
                          {grupo.itens.map((item, idxi) => (
                             <div key={idxi} className="flex justify-between items-center px-6 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center gap-2 pl-6 border-l-2 border-gray-200 ml-4">
                                   <span className="text-gray-400 text-xs">↳</span>
                                   <span className="text-sm font-medium text-gray-600 truncate max-w-[300px]" title={item.nome_anuncio}>
                                      {item.nome_anuncio}
                                   </span>
                                </div>
                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                   {item.qtd}
                                </span>
                             </div>
                          ))}
                       </div>
                    </div>
                 ));
              })()}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('app/(main)/relatorios/radar/page.js', content);
