// components/RdoPrintView.js
"use client";

import React from 'react';

const RdoPrintView = React.forwardRef(({ rdoData, atividades, maoDeObra, ocorrencias, fotos, pedidos }, ref) => {

 if (!rdoData) return null;

 // Logo do Elo 57
 const logoUrl = "/marca/logo-elo57-horizontal.svg";

  function getStatusIndex(status) {
    if (!status) return 1;
    const norm = status.trim().toLowerCase();
    if (norm === 'em andamento') return 0;
    if (norm === 'não iniciado') return 1;
    if (norm === 'pausado') return 2;
    if (norm === 'aguardando material') return 3;
    if (norm === 'concluído') return 4;
    if (norm === 'cancelado') return 5;
    return 99;
  }

  const sortedAtividadesPdf = atividades && atividades.length > 0 ? [...atividades].sort((a, b) => {
    const idxA = getStatusIndex(a.status);
    const idxB = getStatusIndex(b.status);
    if (idxA !== idxB) return idxA - idxB;
    return (a.nome || '').localeCompare(b.nome || '', undefined, { numeric: true, sensitivity: 'base' });
  }) : [];

 return (
 <div
 ref={ref}
 id="print-view-root"
 className="bg-white text-gray-800 font-sans text-xs p-8 w-[210mm] min-h-[297mm] mx-auto shadow-2xl print:shadow-none print:w-full print:m-0 print:p-4"
 // Estilos inline de segurança
 style={{ backgroundColor: '#ffffff', color: '#000000' }}
 >

 {/* CABEÇALHO */}
 <header className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-center">
 <div>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={logoUrl}
 alt="Elo 57"
 className="h-12 mb-2 object-contain"
 crossOrigin="anonymous"
 />
 <h1 className="text-xl font-bold uppercase tracking-wide">Relatório Diário de Obra</h1>
 </div>
 <div className="text-right">
 <p className="text-lg font-bold">RDO Nº {rdoData.rdo_numero}</p>
 <p className="text-sm text-gray-600">
 Data: {rdoData.data_relatorio ? new Date(rdoData.data_relatorio + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
 </p>
 </div>
 </header>

 {/* DADOS GERAIS */}
 <section className="mb-6 border border-gray-300 rounded p-3 bg-gray-50 print:bg-transparent">
 <div className="grid grid-cols-3 gap-4">
 <div>
 <span className="font-bold block">Clima:</span>
 {rdoData.condicoes_climaticas}
 </div>
 <div>
 <span className="font-bold block">Condição:</span>
 {rdoData.condicoes_trabalho}
 </div>
 <div>
 <span className="font-bold block">Responsável:</span>
 {rdoData.responsavel_nome || 'Não identificado'}
 </div>
 </div>
 </section>

 {/* ATIVIDADES */}
 <section className="mb-6">
 <h3 className="font-bold text-sm bg-gray-200 print:bg-gray-200 p-1 mb-2 border-l-4 border-gray-800 pl-2">ATIVIDADES REALIZADAS</h3>
 <table className="w-full border-collapse border border-gray-300 text-xs">
 <thead>
 <tr className="bg-gray-100 print:bg-gray-100">
 <th className="border border-gray-300 p-2 text-left w-3/4">Atividade</th>
 <th className="border border-gray-300 p-2 text-center w-1/4">Status</th>
 </tr>
 </thead>
 <tbody>
 {sortedAtividadesPdf && sortedAtividadesPdf.length > 0 ? sortedAtividadesPdf.map(act => {
   const depth = act.depth || 0;
   return (
     <tr key={act.id}>
       <td className="border border-gray-300 p-2" style={{ paddingLeft: `${depth * 14 + 8}px` }}>
         {depth > 0 && <span className="text-gray-500 font-mono font-bold mr-1">↳ </span>}
         <span className={depth === 0 ? 'font-bold text-gray-900' : 'text-gray-700'}>{act.nome}</span>
       </td>
       <td className="border border-gray-300 p-2 text-center font-medium">{act.status}</td>
     </tr>
   );
 }) : (
 <tr><td colSpan="2" className="border p-4 text-center text-gray-500">Nenhuma atividade registrada.</td></tr>
 )}
 </tbody>
 </table>
 </section>

 {/* MÃO DE OBRA */}
 <section className="mb-6">
 <h3 className="font-bold text-sm bg-gray-200 print:bg-gray-200 p-1 mb-2 border-l-4 border-gray-800 pl-2">MÃO DE OBRA</h3>
 <div className="flex gap-6">
 <div className="flex-grow">
 <table className="w-full border-collapse border border-gray-300 text-xs">
 <thead>
 <tr className="bg-gray-100 print:bg-gray-100">
 <th className="border border-gray-300 p-2 text-left">Funcionário</th>
 <th className="border border-gray-300 p-2 text-center w-20">Presença</th>
 </tr>
 </thead>
 <tbody>
 {maoDeObra && maoDeObra.length > 0 ? maoDeObra.map(emp => (
 <tr key={emp.id}>
 <td className="border border-gray-300 p-2">{emp.name}</td>
 <td className={`border border-gray-300 p-2 text-center font-bold ${emp.present ? 'text-green-700' : 'text-red-700'}`}>
 {emp.present ? 'P' : 'F'}
 </td>
 </tr>
 )) : (
 <tr><td colSpan="2" className="border p-4 text-center">Nenhum registro.</td></tr>
 )}
 </tbody>
 </table>
 </div>

 {/* RESUMO DE EFETIVO */}
 <div className="w-48 border border-gray-300 p-3 bg-gray-50 print:bg-transparent h-fit rounded">
 <p className="font-bold mb-2 border-b pb-1">Resumo do Efetivo:</p>
 <div className="flex justify-between text-sm mb-1">
 <span>Presentes:</span>
 <span className="font-bold">{maoDeObra ? maoDeObra.filter(e => e.present).length : 0}</span>
 </div>
 <div className="flex justify-between text-sm text-red-600 mb-1">
 <span>Ausentes:</span>
 <span className="font-bold">{maoDeObra ? maoDeObra.filter(e => !e.present).length : 0}</span>
 </div>
 <div className="flex justify-between text-sm border-t mt-2 pt-2">
 <span>Total:</span>
 <span className="font-bold">{maoDeObra ? maoDeObra.length : 0}</span>
 </div>
 </div>
 </div>
 </section>

 {/* OCORRÊNCIAS */}
 {ocorrencias && ocorrencias.length > 0 && (
 <section className="mb-6">
 <h3 className="font-bold text-sm bg-gray-200 print:bg-gray-200 p-1 mb-2 border-l-4 border-red-600 pl-2">OCORRÊNCIAS / OBSERVAÇÕES</h3>
 <ul className="border border-gray-300 rounded p-3 space-y-2">
 {ocorrencias.map(occ => (
 <li key={occ.id} className="border-b border-gray-200 last:border-0 pb-2 last:pb-0">
 <span className="font-bold text-red-700 block mb-1">[{occ.tipo}]:</span>
 {occ.descricao}
 </li>
 ))}
 </ul>
 </section>
 )}

 {/* PEDIDOS/ENTREGAS */}
 {pedidos && pedidos.length > 0 && (
 <section className="mb-6">
 <h3 className="font-bold text-sm bg-gray-200 print:bg-gray-200 p-1 mb-2 border-l-4 border-blue-600 pl-2">MATERIAIS RECEBIDOS</h3>
 <ul className="border border-gray-300 rounded p-3">
 {pedidos.map(p => (
 <li key={p.id} className="mb-2 last:mb-0">
 <strong>Pedido #{p.id}:</strong> {p.itens.map(i => i.descricao_item).join(', ')}
 {p.status === 'Entregue' && <span className="text-green-600 font-bold ml-2">(Entregue)</span>}
 </li>
 ))}
 </ul>
 </section>
 )}

  {/* FOTOS (GRID AGRUPADA POR DATA) */}
  {fotos && fotos.length > 0 && (() => {
    const pdfPhotoGroups = {};
    fotos.forEach(foto => {
      const rawDate = foto.created_at || foto.data_upload || rdoData?.data_relatorio;
      let dateStr = 'Registros';
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } else {
          dateStr = String(rawDate).split('T')[0];
        }
      }
      if (!pdfPhotoGroups[dateStr]) pdfPhotoGroups[dateStr] = [];
      pdfPhotoGroups[dateStr].push(foto);
    });

    return (
      <section className="mb-6 break-inside-avoid">
        <h3 className="font-bold text-sm bg-gray-200 print:bg-gray-200 p-1 mb-3 border-l-4 border-gray-800 pl-2 uppercase tracking-wide">
          REGISTRO FOTOGRÁFICO
        </h3>
        <div className="space-y-4">
          {Object.entries(pdfPhotoGroups).map(([dateStr, groupPhotos]) => (
            <div key={dateStr} className="space-y-2">
              <div className="flex items-center gap-2 border-b border-gray-300 pb-1">
                <span className="font-bold text-xs text-gray-800">Data: {dateStr}</span>
                <span className="text-[10px] text-gray-500">({groupPhotos.length} {groupPhotos.length === 1 ? 'imagem' : 'imagens'})</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {groupPhotos.map(foto => (
                  <div key={foto.id} className="border border-gray-200 p-1.5 text-center bg-white break-inside-avoid rounded">
                    <div className="h-36 w-full mb-1 bg-gray-100 flex items-center justify-center overflow-hidden rounded-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={foto.signedUrl}
                        alt="RDO"
                        className="w-full h-full object-cover"
                        loading="eager"
                        crossOrigin="anonymous"
                      />
                    </div>
                    {foto.descricao && (
                      <p className="text-[10px] text-gray-700 font-medium truncate leading-tight px-1">{foto.descricao}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  })()}

 {/* ASSINATURAS */}
 <footer className="mt-16 break-inside-avoid print:mt-12">
 <div className="grid grid-cols-2 gap-20 text-center">
 <div>
 <div className="border-t border-black pt-2"></div>
 <p className="font-bold">{rdoData.responsavel_nome}</p>
 <p className="text-xs text-gray-500">Responsável Técnico</p>
 </div>
 <div>
 <div className="border-t border-black pt-2"></div>
 <p className="font-bold">Fiscalização / Cliente</p>
 <p className="text-xs text-gray-500">De acordo</p>
 </div>
 </div>
 <div className="text-center text-[10px] text-gray-400 mt-10 border-t pt-2">
 Documento gerado digitalmente pelo Sistema Elo 57 em {new Date().toLocaleString('pt-BR')}
 </div>
 </footer>
 </div>
 );
});

RdoPrintView.displayName = 'RdoPrintView';

export default RdoPrintView;