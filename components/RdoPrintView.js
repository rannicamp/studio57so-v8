// components/RdoPrintView.js
"use client";

import React from 'react';

const RdoPrintView = React.forwardRef(({ rdoData, atividades, maoDeObra, ocorrencias, fotos, pedidos }, ref) => {
    
    if (!rdoData) return null;

    // Logo do Studio 57
    const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";

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
                        alt="Studio 57" 
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
                            <th className="border border-gray-300 p-2 text-left w-1/2">Atividade</th>
                            <th className="border border-gray-300 p-2 text-center w-1/4">Status</th>
                            <th className="border border-gray-300 p-2 text-left w-1/4">Obs.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {atividades && atividades.length > 0 ? atividades.map(act => (
                            <tr key={act.id}>
                                <td className="border border-gray-300 p-2">{act.nome}</td>
                                <td className="border border-gray-300 p-2 text-center font-medium">{act.status}</td>
                                <td className="border border-gray-300 p-2 italic text-gray-600">{act.observacao}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan="3" className="border p-4 text-center text-gray-500">Nenhuma atividade registrada.</td></tr>
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

            {/* FOTOS (GRID) */}
            {fotos && fotos.length > 0 && (
                <section className="mb-6 break-inside-avoid">
                    <h3 className="font-bold text-sm bg-gray-200 print:bg-gray-200 p-1 mb-2 border-l-4 border-gray-800 pl-2">REGISTRO FOTOGRÁFICO</h3>
                    <div className="grid grid-cols-3 gap-3">
                        {fotos.map(foto => (
                            <div key={foto.id} className="border border-gray-200 p-2 text-center bg-white break-inside-avoid">
                                <div className="h-36 w-full mb-1 bg-gray-100 flex items-center justify-center overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img 
                                        src={foto.signedUrl} 
                                        alt="RDO" 
                                        className="w-full h-full object-cover" 
                                        loading="eager"
                                        crossOrigin="anonymous" 
                                    />
                                </div>
                                <p className="text-[10px] text-gray-600 truncate px-1">{foto.descricao || ''}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

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
                    Documento gerado digitalmente pelo Sistema Studio 57 em {new Date().toLocaleString('pt-BR')}
                </div>
            </footer>
        </div>
    );
});

RdoPrintView.displayName = 'RdoPrintView';

export default RdoPrintView;