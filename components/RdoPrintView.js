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
            className={`
                print-view bg-white text-gray-800 font-sans text-xs p-8 max-w-[210mm] mx-auto
                /* TRUQUE CSS: Esconde da tela sem usar display:none para forçar o carregamento das imagens */
                absolute top-0 left-0 -z-50 h-0 overflow-hidden opacity-0 pointer-events-none
                /* REVELA NA IMPRESSÃO: Reseta tudo para aparecer no papel */
                print:static print:h-auto print:overflow-visible print:opacity-100 print:z-auto
            `}
        >
            
            {/* CABEÇALHO */}
            <header className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-center">
                <div>
                    {/* loading="eager" força o download imediato */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Studio 57" className="h-10 mb-2" loading="eager" />
                    <h1 className="text-xl font-bold uppercase tracking-wide">Relatório Diário de Obra</h1>
                </div>
                <div className="text-right">
                    <p className="text-lg font-bold">RDO Nº {rdoData.rdo_numero}</p>
                    <p className="text-sm text-gray-600">
                        Data: {new Date(rdoData.data_relatorio).toLocaleDateString('pt-BR')}
                    </p>
                </div>
            </header>

            {/* DADOS GERAIS */}
            <section className="mb-6 border border-gray-300 rounded p-2 bg-gray-50">
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
                <h3 className="font-bold text-sm bg-gray-200 p-1 mb-1 border-l-4 border-gray-800 pl-2">ATIVIDADES REALIZADAS</h3>
                <table className="w-full border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 p-1 text-left w-1/2">Atividade</th>
                            <th className="border border-gray-300 p-1 text-center w-1/4">Status</th>
                            <th className="border border-gray-300 p-1 text-left w-1/4">Obs.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {atividades.length > 0 ? atividades.map(act => (
                            <tr key={act.id}>
                                <td className="border border-gray-300 p-1">{act.nome}</td>
                                <td className="border border-gray-300 p-1 text-center">{act.status}</td>
                                <td className="border border-gray-300 p-1 italic text-gray-600">{act.observacao}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan="3" className="border p-2 text-center text-gray-500">Nenhuma atividade registrada.</td></tr>
                        )}
                    </tbody>
                </table>
            </section>

            {/* MÃO DE OBRA */}
            <section className="mb-6">
                <h3 className="font-bold text-sm bg-gray-200 p-1 mb-1 border-l-4 border-gray-800 pl-2">MÃO DE OBRA</h3>
                <div className="grid grid-cols-2 gap-4">
                    <table className="w-full border-collapse border border-gray-300">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-300 p-1 text-left">Funcionário</th>
                                <th className="border border-gray-300 p-1 text-center w-20">Presença</th>
                            </tr>
                        </thead>
                        <tbody>
                            {maoDeObra.length > 0 ? maoDeObra.map(emp => (
                                <tr key={emp.id}>
                                    <td className="border border-gray-300 p-1">{emp.name}</td>
                                    <td className={`border border-gray-300 p-1 text-center font-bold ${emp.present ? 'text-green-700' : 'text-red-700'}`}>
                                        {emp.present ? 'P' : 'F'}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="2" className="border p-2 text-center">Nenhum registro.</td></tr>
                            )}
                        </tbody>
                    </table>
                    
                    {/* RESUMO DE EFETIVO */}
                    <div className="border border-gray-300 p-2 bg-gray-50 h-fit">
                        <p className="font-bold mb-2 border-b">Resumo do Efetivo:</p>
                        <div className="flex justify-between text-sm">
                            <span>Presentes:</span>
                            <span className="font-bold">{maoDeObra.filter(e => e.present).length}</span>
                        </div>
                        <div className="flex justify-between text-sm text-red-600">
                            <span>Ausentes:</span>
                            <span className="font-bold">{maoDeObra.filter(e => !e.present).length}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t mt-1 pt-1">
                            <span>Total:</span>
                            <span className="font-bold">{maoDeObra.length}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* OCORRÊNCIAS */}
            {ocorrencias.length > 0 && (
                <section className="mb-6">
                    <h3 className="font-bold text-sm bg-gray-200 p-1 mb-1 border-l-4 border-red-600 pl-2">OCORRÊNCIAS / OBSERVAÇÕES</h3>
                    <ul className="border border-gray-300 rounded p-2 space-y-2">
                        {ocorrencias.map(occ => (
                            <li key={occ.id} className="border-b border-gray-200 last:border-0 pb-1 last:pb-0">
                                <strong className="text-red-700">[{occ.tipo}]:</strong> {occ.descricao}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* PEDIDOS/ENTREGAS */}
            {pedidos.length > 0 && (
                <section className="mb-6">
                    <h3 className="font-bold text-sm bg-gray-200 p-1 mb-1 border-l-4 border-blue-600 pl-2">MATERIAIS RECEBIDOS</h3>
                    <ul className="border border-gray-300 rounded p-2">
                        {pedidos.map(p => (
                            <li key={p.id} className="mb-1">
                                <strong>Pedido #{p.id}:</strong> {p.itens.map(i => i.descricao_item).join(', ')} 
                                {p.status === 'Entregue' && <span className="text-green-600 font-bold ml-2">(Entregue)</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* FOTOS (GRID) */}
            {fotos.length > 0 && (
                <section className="mb-6 break-inside-avoid">
                    <h3 className="font-bold text-sm bg-gray-200 p-1 mb-1 border-l-4 border-gray-800 pl-2">REGISTRO FOTOGRÁFICO</h3>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        {fotos.map(foto => (
                            <div key={foto.id} className="border border-gray-200 p-1 text-center bg-white">
                                {/* loading="eager" força o navegador a baixar a foto mesmo se estiver fora da tela */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                    src={foto.signedUrl} 
                                    alt="RDO" 
                                    className="h-32 w-full object-cover mb-1 bg-gray-100" 
                                    loading="eager" 
                                />
                                <p className="text-[10px] text-gray-600 truncate">{foto.descricao || ''}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ASSINATURAS */}
            <footer className="mt-12 break-inside-avoid">
                <div className="grid grid-cols-2 gap-16 text-center">
                    <div>
                        <div className="border-t border-black pt-1"></div>
                        <p className="font-bold">{rdoData.responsavel_nome}</p>
                        <p className="text-xs">Responsável Técnico</p>
                    </div>
                    <div>
                        <div className="border-t border-black pt-1"></div>
                        <p className="font-bold">Fiscalização / Cliente</p>
                        <p className="text-xs">De acordo</p>
                    </div>
                </div>
                <div className="text-center text-[10px] text-gray-400 mt-8 border-t pt-2">
                    Gerado pelo Sistema Studio 57 em {new Date().toLocaleString('pt-BR')}
                </div>
            </footer>
        </div>
    );
});

RdoPrintView.displayName = 'RdoPrintView';

export default RdoPrintView;