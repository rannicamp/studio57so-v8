'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, 
  faPrint, 
  faSearchPlus, 
  faSearchMinus, 
  faUndo 
} from '@fortawesome/free-solid-svg-icons';

export default function DocumentoProposta504Page() {
  
  // Nível de Zoom inicial (ajustado para caber as 3 lado a lado na tela por padrão)
  const [zoomLevel, setZoomLevel] = useState(70); // Em porcentagem (50% a 120%)
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null); // 'A', 'B', 'C' ou null (todas)

  // Lê a query string no carregamento para renderizar opção individual se solicitado (?opcao=A)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const op = params.get('opcao');
      if (op) {
        setOpcaoSelecionada(op.toUpperCase());
      }
    }
  }, []);

  // Valores exatos unificados obtidos do extrato financeiro do Beto (Monte Alto)
  const valContratoOriginal = 327429.37;
  const valTotalPago = 165971.96; // Valor exato pago amortizado do extrato comercial
  const valTabelaAtualizada = 442359.93;
  const valorMercadoLote = 200000.00; // Lote repassado pelo valor de mercado de R$ 200.000,00
  const taxaComissao = 5.0;

  // Parcela Remanescente de Obras
  const numParcelasRemanescentes = 21;
  const valParcelaObra = 7706.37;
  const saldoDevedorRestante = numParcelasRemanescentes * valParcelaObra; // R$ 161.833,77 (saldo de chaves descontado = R$ 0,00)

  // Cálculos de Proporção e Valorização
  const valorizacaoImovel = valTabelaAtualizada - valContratoOriginal;
  
  // Porcentagens exatas cumpridas do contrato
  const pctQuitada = (valTotalPago / valContratoOriginal) * 100; // 50,69%
  const pctSaldoDevedor = (saldoDevedorRestante / valContratoOriginal) * 100; // 49,31%

  // Opção A: Permuta do Lote
  const valorizacaoRepassadaLote = valorMercadoLote - valTotalPago; // R$ 34.028,04 (ganho repassado como lote)

  // Opção B: Repasse de Ágio Valorizado
  const agioValorizado = (pctQuitada / 100) * valTabelaAtualizada; // Cota de 50.69% valorizada = R$ 224.232,25
  
  // Custo Total para o Novo Comprador
  const custoTotalNovoComprador = 386063.33; // Valor exato de venda do repasse definido pelo usuário
  const economiaNovoComprador = valTabelaAtualizada - custoTotalNovoComprador; // R$ 56.296,60

  // Comissão da Studio 57 (5% sobre o valor da venda pago pelo vendedor Monte Alto)
  const comissaoStudio = (custoTotalNovoComprador * taxaComissao) / 100; // R$ 19.303,17

  // Opção C: Sociedade de Propriedade Compartilhada
  const comissaoCorretorOpcaoC = (valTabelaAtualizada * taxaComissao) / 100; // R$ 22.117,99
  const valorLiquidoPartilharC = valTabelaAtualizada - comissaoCorretorOpcaoC; // R$ 420.241,94
  
  // Rateio proporcional
  const cotaLiquidaMonteAltoC = (pctQuitada / 100) * valorLiquidoPartilharC; // R$ 213.020,64
  const cotaLiquidaStudioC = (pctSaldoDevedor / 100) * valorLiquidoPartilharC; // R$ 207.221,30

  const fmt = (v) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  const handlePrint = () => {
    window.print();
  };

  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 120));
  };

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 40));
  };

  const resetZoom = () => {
    setZoomLevel(70);
  };

  // Se uma opção individual for selecionada, renderiza de forma estrita em tamanho A4 para gerar PDF perfeito
  if (opcaoSelecionada) {
    return (
      <div className="bg-white min-h-screen text-gray-800 font-sans print:p-0 flex justify-center items-start overflow-hidden">
        
        {/* Importação das fontes da marca e regras estritas de impressão de 1 página */}
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Khand:wght@500;600;700&family=Montserrat:wght@400;500;600;700&display=swap');
          
          .font-khand {
            font-family: 'Khand', sans-serif;
          }
          .font-montserrat {
            font-family: 'Montserrat', sans-serif;
          }
          
          /* Forçar exatamente 1 única página na impressão de PDFs individuais */
          @media print {
            html, body {
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-a4-strict {
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              border: none !important;
              padding: 12mm 15mm !important; /* Margem interna equilibrada */
              box-sizing: border-box !important;
              page-break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
          }
        `}</style>

        {opcaoSelecionada === 'A' && (
          <div className="w-[210mm] h-[297mm] bg-white pt-8 pb-6 px-12 flex flex-col justify-between print-a4-strict">
            <div>
              {/* Cabeçalho */}
              <div className="flex justify-between items-center border-b border-gray-955 pb-3 mb-6">
                <div>
                  <img 
                    src="/brand/studio_57_logo_preto.png" 
                    alt="Studio 57" 
                    className="h-8 object-contain"
                  />
                  <p className="text-[8.5px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Cessão & Reestruturação Comercial de Ativos
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9.5px] font-bold text-gray-900 tracking-wider uppercase border-b border-gray-900 pb-0.5">
                    PROPOSTA A
                  </span>
                  <p className="text-[8.5px] text-gray-400 mt-1 font-medium">Ref: APARTAMENTO 504 — ALFA</p>
                </div>
              </div>

              {/* Título do Instrumento */}
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-gray-900 uppercase tracking-tight font-khand">
                  Instrumento de Proposta de Acordo Comercial
                </h2>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                  Modalidade: Permuta Física por Ativo Loteamento (Dação em Pagamento)
                </p>
              </div>

              {/* Dados do Objeto e Partes */}
              <div className="mb-4 border-b border-gray-200 pb-4 text-[11px] text-gray-800 leading-relaxed">
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Proponente:</span> STUDIO 57 INCORPORADORA LTDA</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Cliente Cedente:</span> MONTE ALTO EMPREENDIMENTOS IMOBILIÁRIOS LTDA</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Objeto:</span> Unidade Habitacional Autônoma 504 (com Garagem Coberta nº 09)</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Localização:</span> Empreendimento Residencial Alfa</p>
              </div>

              {/* Demonstrativo Contratual */}
              <div className="mb-5">
                <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-widest mb-2 border-l-2 border-gray-900 pl-2">
                  1. Demonstrativo Financeiro Atualizado do Contrato
                </h3>
                <div className="overflow-hidden border border-gray-200 rounded">
                  <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                    <tbody className="divide-y divide-gray-200 text-gray-700">
                      <tr>
                        <td className="px-3.5 py-1.5 font-bold text-gray-400 uppercase tracking-wider text-[8px]">Valor do Contrato Original (15/01/2025)</td>
                        <td className="px-3.5 py-1.5 text-right font-semibold text-gray-900">{fmt(valContratoOriginal)}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-1.5 font-bold text-gray-400 uppercase tracking-wider text-[8px]">Total Pago Amortizado pelo Adquirente ({pctQuitada.toFixed(2)}%)</td>
                        <td className="px-3.5 py-1.5 text-right font-semibold text-gray-900">{fmt(valTotalPago)}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-1.5 font-bold text-gray-400 uppercase tracking-wider text-[8px]">Saldo Devedor Remanescente ({pctSaldoDevedor.toFixed(2)}%)</td>
                        <td className="px-3.5 py-1.5 text-right font-semibold text-gray-900">{fmt(saldoDevedorRestante)}</td>
                      </tr>
                      <tr className="bg-gray-50 border-t border-gray-300">
                        <td className="px-3.5 py-2 font-bold text-gray-900 uppercase tracking-wider text-[8.5px]">Valor de Mercado da Unidade (Tabela de Vendas Atual)</td>
                        <td className="px-3.5 py-2 text-right font-bold text-gray-900">{fmt(valTabelaAtualizada)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cláusulas */}
              <div className="mb-4">
                <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-widest mb-2 border-l-2 border-gray-900 pl-2">
                  2. Condições Comerciais do Acordo
                </h3>
                <div className="flex flex-col gap-3 text-[11px] text-gray-700 leading-relaxed">
                  <p>
                    <strong>Cláusula Primeira (Objeto da Permuta):</strong> O adquirente MONTE ALTO transfere e cede todos os seus direitos e deveres sobre a Unidade 504 do Residencial Alfa em favor da Incorporadora proponente STUDIO 57, rescindindo o compromisso de compra e venda original de forma irrevogável.
                  </p>
                  <p>
                    <strong>Cláusula Segunda (Dação em Pagamento):</strong> A Incorporadora proponente quita a restituição dos valores pagos pelo adquirente (R$ {valTotalPago.toLocaleString('pt-BR')}) mediante a entrega do seguinte ativo de seu estoque:
                  </p>
                  <div className="pl-3.5 border-l border-gray-300 font-medium my-1 text-[11px] flex flex-col gap-1">
                    <p>• Transmissão da propriedade de 01 Lote de terreno localizado no Loteamento Ouro Verde.</p>
                    <p>• Valor de repasse comercial atribuído ao lote de terreno: <strong>{fmt(valorMercadoLote)}</strong>.</p>
                    <p>• Ganho adicional / Ágio em ativo repassado em favor do cliente: <strong>{fmt(valorizacaoRepassadaLote)}</strong>.</p>
                  </div>
                  <p>
                    <strong>Cláusula Terceira (Quitação de Saldo Devedor):</strong> Com a formalização deste instrumento, o adquirente fica integralmente desonerado do saldo devedor restante do apartamento no valor de R$ {saldoDevedorRestante.toLocaleString('pt-BR')}, eximindo-se de quaisquer parcelas remanescentes de obras junto à construtora.
                  </p>
                </div>
              </div>
            </div>

            {/* Rodapé e Assinaturas */}
            <div className="border-t border-gray-300 pt-6">
              <div className="grid grid-cols-2 gap-12 text-center text-[9px] font-bold tracking-wider text-gray-600">
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">STUDIO 57 INCORPORADORA LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Representante Comercial</p>
                </div>
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">MONTE ALTO EMPREENDIMENTOS LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Cliente Proprietário</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {opcaoSelecionada === 'B' && (
          <div className="w-[210mm] h-[297mm] bg-white pt-8 pb-6 px-12 flex flex-col justify-between print-a4-strict">
            <div>
              {/* Cabeçalho */}
              <div className="flex justify-between items-center border-b border-gray-955 pb-3 mb-5">
                <div>
                  <img 
                    src="/brand/studio_57_logo_preto.png" 
                    alt="Studio 57" 
                    className="h-8 object-contain"
                  />
                  <p className="text-[8.5px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Cessão & Reestruturação Comercial de Ativos
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9.5px] font-bold text-gray-900 tracking-wider uppercase border-b border-gray-900 pb-0.5">
                    PROPOSTA B
                  </span>
                  <p className="text-[8.5px] text-gray-400 mt-1 font-medium">Ref: APARTAMENTO 504 — ALFA</p>
                </div>
              </div>

              {/* Título do Instrumento */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 uppercase tracking-tight font-khand">
                  Instrumento de Proposta de Acordo Comercial
                </h2>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                  Modalidade: Intermediação de Repasse de Ágio Valorizado (Manutenção de Adimplência)
                </p>
              </div>

              {/* Cláusulas da Proposta B */}
              <div className="mb-4 flex flex-col gap-2.5 text-[10.5px] text-gray-700 leading-normal">
                <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-widest mb-0.5 border-l-2 border-gray-900 pl-2">
                  1. Condições da Intermediação e Cessão de Ágio
                </h3>
                <p>
                  <strong>Cláusula Primeira (Do Repasse):</strong> A Monte Alto disponibiliza a Unidade 504 no mercado para repasse a terceiros adquirentes pelo valor total de transação de <strong>{fmt(custoTotalNovoComprador)}</strong>. Este repasse concede ao novo adquirente uma economia direta de <strong>{fmt(economiaNovoComprador)}</strong> em relação ao preço de tabela atualizado (R$ {valTabelaAtualizada.toLocaleString('pt-BR')}).
                </p>
                <p>
                  <strong>Cláusula Segunda (Estrutura de Recebimento de Valores):</strong> O novo comprador assume as obrigações contratuais sob a seguinte divisão financeira:
                </p>
                <div className="pl-3.5 border-l border-gray-300 font-medium my-1 text-[10.5px] flex flex-col gap-1.5 bg-gray-50/50 p-2.5 rounded">
                  <div className="flex justify-between">
                    <span>• Pagamento de Ágio Valorizado à Monte Alto:</span>
                    <span className="font-bold text-gray-900">{fmt(agioValorizado)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1">
                    <span>• Assunção de Saldo Devedor Restante (Studio 57):</span>
                    <span className="font-bold text-gray-900">{fmt(saldoDevedorRestante)}</span>
                  </div>
                  <div className="pl-3 text-[9.5px] text-gray-400 flex flex-col gap-0.5 w-full font-normal">
                    <div className="flex justify-between">
                      <span>- Parcelas Remanescentes de Obra:</span>
                      <span>{numParcelasRemanescentes}x mensais de {fmt(valParcelaObra)}</span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>- Parcela Final de Chaves:</span>
                      <span>R$ 0,00 (Desconto / Isento)</span>
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-1 font-black text-gray-900">
                    <span>Custo Total do Repasse:</span>
                    <span>{fmt(custoTotalNovoComprador)}</span>
                  </div>
                </div>

                {/* Destaque Obrigatório */}
                <div className="bg-red-50/10 border border-gray-900 p-2.5 rounded text-[10px] font-medium text-gray-700 my-0.5 leading-relaxed">
                  <strong>Cláusula Terceira (Da Manutenção da Adimplência - Obrigatório):</strong> O proprietário (Monte Alto) assume a obrigação irretratável de manter-se integralmente adimplente com o cronograma financeiro e os aportes das parcelas de obras mensais junto à Construtora proponente durante todo o interstício de comercialização da unidade no mercado, sob pena de rescisão e cancelamento imediato da presente proposta de intermediação de repasse.
                </div>

                <p>
                  <strong>Cláusula Quarta (Da Autonomia e Não Exclusividade Comercial):</strong> 
                </p>
                <div className="pl-3.5 border-l border-gray-300 text-[10px] text-gray-650 flex flex-col gap-1 font-medium">
                  <p>
                    I. É direito exclusivo e soberano do proprietário (Monte Alto) fixar, aumentar ou reduzir o valor pretendido de ágio e suas respectivas condições de recebimento a qualquer tempo, de acordo com a sua conveniência ou necessidade individual, mediante proposta específica formulada junto a potenciais adquirentes.
                  </p>
                  <p>
                    II. Por se tratar de direito legítimo de propriedade, o cedente Monte Alto possui total liberdade para disponibilizar e promover a venda do ágio de sua unidade através de outras imobiliárias e corretores terceiros ativos de mercado, não restando estabelecido qualquer caráter de exclusividade comercial ou de corretagem com a proponente Studio 57.
                  </p>
                  <p>
                    III. Fica ajustado que este plano financeiro e as estimativas de ágio descritos constituem uma proposta e estudo comercial de valor elaborados pela Studio 57, visando ao melhor ganho patrimonial e maior atratividade do ativo no mercado.
                  </p>
                </div>

                <p>
                  <strong>Cláusula Quinta (Comissão de Intermediação):</strong> Fica estabelecida a taxa de intermediação e corretagem de <strong>{taxaComissao.toFixed(1)}%</strong> sob o valor total da venda (R$ {custoTotalNovoComprador.toLocaleString('pt-BR')}), resultando em <strong>{fmt(comissaoStudio)}</strong>. Esta comissão é devida pelo vendedor (Monte Alto) e deverá ser quitada integralmente junto à Incorporadora no ato da assinatura do instrumento de cessão de direitos (fechamento da venda).
                </p>
              </div>
            </div>

            {/* Rodapé e Assinaturas */}
            <div className="border-t border-gray-300 pt-6">
              <div className="grid grid-cols-2 gap-12 text-center text-[9px] font-bold tracking-wider text-gray-600">
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">STUDIO 57 INCORPORADORA LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Representante Comercial</p>
                </div>
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">MONTE ALTO EMPREENDIMENTOS LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Cliente Proprietário</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {opcaoSelecionada === 'C' && (
          <div className="w-[210mm] h-[297mm] bg-white pt-8 pb-6 px-12 flex flex-col justify-between print-a4-strict">
            <div>
              {/* Cabeçalho */}
              <div className="flex justify-between items-center border-b border-gray-955 pb-3 mb-6">
                <div>
                  <img 
                    src="/brand/studio_57_logo_preto.png" 
                    alt="Studio 57" 
                    className="h-8 object-contain"
                  />
                  <p className="text-[8.5px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Cessão & Reestruturação Comercial de Ativos
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9.5px] font-bold text-gray-900 tracking-wider uppercase border-b border-gray-900 pb-0.5">
                    PROPOSTA C
                  </span>
                  <p className="text-[8.5px] text-gray-400 mt-1 font-medium">Ref: APARTAMENTO 504 — ALFA</p>
                </div>
              </div>

              {/* Título do Instrumento */}
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 uppercase tracking-tight font-khand">
                  Instrumento de Proposta de Acordo Comercial
                </h2>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                  Modalidade: Parceria de Propriedade Compartilhada (Sociedade de Revenda)
                </p>
              </div>

              {/* Dados do Objeto e Partes */}
              <div className="mb-4 border-b border-gray-200 pb-4 text-[11px] text-gray-800 leading-relaxed">
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Proponente:</span> STUDIO 57 INCORPORADORA LTDA</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Cliente Cedente:</span> MONTE ALTO EMPREENDIMENTOS IMOBILIÁRIOS LTDA</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Objeto:</span> Unidade Habitacional Autônoma 504 (com Garagem Coberta nº 09)</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Localização:</span> Empreendimento Residencial Alfa</p>
              </div>

              {/* Cláusulas da Proposta C */}
              <div className="mb-6 flex flex-col gap-3.5 text-[11px] text-gray-750 leading-relaxed">
                <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-widest mb-1 border-l-2 border-gray-900 pl-2">
                  1. Condições da Parceria de Propriedade Compartilhada
                </h3>
                <p>
                  <strong>Cláusula Primeira (Constituição da Sociedade):</strong> Em troca de assumir a responsabilidade total e integral pelo pagamento das parcelas de obras remanescentes de obras (R$ {saldoDevedorRestante.toLocaleString('pt-BR')}), a MONTE ALTO cede **{pctSaldoDevedor.toFixed(2)}%** do imóvel para o Studio 57, estabelecendo uma copropriedade na seguinte proporção:
                </p>
                <div className="pl-3.5 border-l border-gray-300 font-medium my-1.5 text-[11px] flex flex-col gap-1">
                  <p>• Fração de Propriedade Monte Alto (Cedente): <strong>{pctQuitada.toFixed(2)}%</strong> (Capital Investido de R$ {valTotalPago.toLocaleString('pt-BR')})</p>
                  <p>• Fração de Propriedade Studio 57 (Assunção): <strong>{pctSaldoDevedor.toFixed(2)}%</strong> (Saldo Remanescente de R$ {saldoDevedorRestante.toLocaleString('pt-BR')})</p>
                </div>
                <p>
                  <strong>Cláusula Segunda (Partilha da Revenda):</strong> A unidade será comercializada no mercado de forma conjunta e o fluxo de caixa líquido recebido (descontada a comissão de intermediação imobiliária de 5%) será repassado a cada sócio, proporcionalmente, no ato do recebimento de cada parcela/entrada liquidação do novo contrato:
                </p>
                <div className="pl-3.5 border-l border-gray-300 font-medium my-1.5 text-[11px] flex flex-col gap-1 bg-gray-50/50 p-2.5 rounded">
                  <div className="flex justify-between">
                    <span>• Preço de Tabela Estimado de Revenda:</span>
                    <span>{fmt(valTabelaAtualizada)}</span>
                  </div>
                  <div className="flex justify-between text-red-500 border-b border-gray-200 pb-0.5">
                    <span>• (-) Comissão de Venda Estimada (5%):</span>
                    <span>-{fmt(comissaoCorretorOpcaoC)}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-gray-900">
                    <span>• Valor Líquido Total a Partilhar:</span>
                    <span>{fmt(valorLiquidoPartilharC)}</span>
                  </div>
                  <div className="flex justify-between pt-0.5 pl-2 border-l border-gray-300 text-[9.5px] text-gray-500">
                    <span>- Cota Líquida da Monte Alto ({pctQuitada.toFixed(2)}%):</span>
                    <span className="font-bold text-purple-700">{fmt(cotaLiquidaMonteAltoC)}</span>
                  </div>
                  <div className="flex justify-between pl-2 border-l border-gray-300 text-[9.5px] text-gray-500">
                    <span>- Cota Líquida do Studio 57 ({pctSaldoDevedor.toFixed(2)}%):</span>
                    <span>{fmt(cotaLiquidaStudioC)}</span>
                  </div>
                </div>
                <p>
                  <strong>Cláusula Terceira (Comissão de Venda):</strong> A despesa com taxas de intermediação de venda (comissão de corretagem) de 5% será integralmente deduzida do preço bruto no ato do fechamento da venda com o terceiro adquirente, sendo compartilhada proporcionalmente entre os coproprietários.
                </p>
              </div>
            </div>

            {/* Rodapé e Assinaturas */}
            <div className="border-t border-gray-300 pt-6">
              <div className="grid grid-cols-2 gap-12 text-center text-[9px] font-bold tracking-wider text-gray-600">
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">STUDIO 57 INCORPORADORA LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Representante Comercial</p>
                </div>
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">MONTE ALTO EMPREENDIMENTOS LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Cliente Proprietário</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Visualização Comparativa Padrão Lado a Lado (com Zoom)
  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-6 text-gray-800 font-sans print:bg-white print:p-0">
      
      {/* Importação das fontes da marca */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Khand:wght@500;600;700&family=Montserrat:wght@400;500;600;700&display=swap');
        
        .font-khand {
          font-family: 'Khand', sans-serif;
        }
        .font-montserrat {
          font-family: 'Montserrat', sans-serif;
        }
        
        /* Oculta na impressão */
        @media print {
          body {
            background-color: #ffffff;
            color: #000000;
          }
          .print-break-page {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
      
      {/* Barra de Ações Superior (Escondida na Impressão) */}
      <div className="max-w-[700px] mx-auto xl:max-w-none xl:px-8 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden font-montserrat">
        <Link 
          href="/painel" 
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-black transition-colors"
        >
          <FontAwesomeIcon icon={faArrowLeft} /> Voltar para o Painel
        </Link>
        
        {/* Controles de Zoom */}
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded border border-gray-300 shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Visualização:</span>
          <button 
            onClick={zoomOut}
            className="w-7 h-7 rounded bg-gray-50 hover:bg-gray-155 text-gray-600 flex items-center justify-center transition-colors text-xs"
            title="Afastar"
          >
            <FontAwesomeIcon icon={faSearchMinus} />
          </button>
          <span className="text-xs font-bold text-gray-700 w-10 text-center">
            {zoomLevel}%
          </span>
          <button 
            onClick={zoomIn}
            className="w-7 h-7 rounded bg-gray-50 hover:bg-gray-155 text-gray-600 flex items-center justify-center transition-colors text-xs"
            title="Aproximar"
          >
            <FontAwesomeIcon icon={faSearchPlus} />
          </button>
          <button 
            onClick={resetZoom}
            className="w-7 h-7 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 flex items-center justify-center transition-colors text-xs"
            title="Resetar Zoom"
          >
            <FontAwesomeIcon icon={faUndo} />
          </button>
        </div>

        <button 
          onClick={handlePrint}
          className="bg-black text-white px-5 py-2.5 rounded text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-gray-900 transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faPrint} /> Gerar PDFs das Propostas
        </button>
      </div>

      {/* Wrapper com Zoom Dinâmico aplicado via estilo de Escala e Zoom */}
      <div className="overflow-x-auto pb-10 print:overflow-visible print:pb-0">
        
        <div 
          className="flex flex-col xl:flex-row gap-8 justify-start xl:justify-center items-center xl:items-start px-4 xl:px-8 print:flex-col print:gap-0 print:p-0 print:overflow-visible font-montserrat"
          style={{ 
            zoom: `${zoomLevel}%`,
            transformOrigin: 'top center',
            transition: 'zoom 0.12s ease-out'
          }}
        >
          
          {/* ================= PROPOSTA A ================= */}
          <div className="w-[210mm] h-[297mm] bg-white border border-gray-300 pt-8 pb-6 px-12 flex flex-col justify-between shrink-0 shadow-sm print:shadow-none print:border-none print:p-0 print:w-full print:h-[297mm] print:break-after-page print-break-page">
            <div>
              {/* Cabeçalho */}
              <div className="flex justify-between items-center border-b border-gray-955 pb-3 mb-6">
                <div>
                  <img 
                    src="/brand/studio_57_logo_preto.png" 
                    alt="Studio 57" 
                    className="h-8 object-contain"
                  />
                  <p className="text-[8.5px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Cessão & Reestruturação Comercial de Ativos
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9.5px] font-bold text-gray-900 tracking-wider uppercase border-b border-gray-900 pb-0.5">
                    PROPOSTA A
                  </span>
                  <p className="text-[8.5px] text-gray-400 mt-1 font-medium">Ref: APARTAMENTO 504 — ALFA</p>
                </div>
              </div>

              {/* Título */}
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-gray-900 uppercase tracking-tight font-khand">
                  Instrumento de Proposta de Acordo Comercial
                </h2>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                  Modalidade: Permuta Física por Ativo Loteamento (Dação em Pagamento)
                </p>
              </div>

              {/* Dados */}
              <div className="mb-4 border-b border-gray-200 pb-4 text-[11px] text-gray-800 leading-relaxed">
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Proponente:</span> STUDIO 57 INCORPORADORA LTDA</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Cliente Cedente:</span> MONTE ALTO EMPREENDIMENTOS IMOBILIÁRIOS LTDA</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Objeto:</span> Unidade Habitacional Autônoma 504 (com Garagem Coberta nº 09)</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Localização:</span> Empreendimento Residencial Alfa</p>
              </div>

              {/* Demonstrativo */}
              <div className="mb-5">
                <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-widest mb-2 border-l-2 border-gray-900 pl-2">
                  1. Demonstrativo Financeiro Atualizado do Contrato
                </h3>
                <div className="overflow-hidden border border-gray-200 rounded">
                  <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                    <tbody className="divide-y divide-gray-200 text-gray-700">
                      <tr>
                        <td className="px-3.5 py-1.5 font-bold text-gray-400 uppercase tracking-wider text-[8px]">Valor do Contrato Original (15/01/2025)</td>
                        <td className="px-3.5 py-1.5 text-right font-semibold text-gray-900">{fmt(valContratoOriginal)}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-1.5 font-bold text-gray-400 uppercase tracking-wider text-[8px]">Total Pago Amortizado pelo Adquirente ({pctQuitada.toFixed(2)}%)</td>
                        <td className="px-3.5 py-1.5 text-right font-semibold text-gray-900">{fmt(valTotalPago)}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-1.5 font-bold text-gray-400 uppercase tracking-wider text-[8px]">Saldo Devedor Remanescente ({pctSaldoDevedor.toFixed(2)}%)</td>
                        <td className="px-3.5 py-1.5 text-right font-semibold text-gray-900">{fmt(saldoDevedorRestante)}</td>
                      </tr>
                      <tr className="bg-gray-50 border-t border-gray-300">
                        <td className="px-3.5 py-2 font-bold text-gray-900 uppercase tracking-wider text-[8.5px]">Valor de Mercado da Unidade (Tabela de Vendas Atual)</td>
                        <td className="px-3.5 py-2 text-right font-bold text-gray-900">{fmt(valTabelaAtualizada)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cláusulas */}
              <div className="mb-4">
                <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-widest mb-2 border-l-2 border-gray-900 pl-2">
                  2. Condições Comerciais do Acordo
                </h3>
                <div className="flex flex-col gap-3 text-[11px] text-gray-700 leading-relaxed">
                  <p>
                    <strong>Cláusula Primeira (Objeto da Permuta):</strong> O adquirente MONTE ALTO transfere e cede todos os seus direitos e deveres sobre a Unidade 504 do Residencial Alfa em favor da Incorporadora proponente STUDIO 57, rescindindo o compromisso de compra e venda original de forma irrevogável.
                  </p>
                  <p>
                    <strong>Cláusula Segunda (Dação em Pagamento):</strong> A Incorporadora proponente quita a restituição dos valores pagos pelo adquirente (R$ {valTotalPago.toLocaleString('pt-BR')}) mediante a entrega do seguinte ativo de seu estoque:
                  </p>
                  <div className="pl-3.5 border-l border-gray-300 font-medium my-1 text-[11px] flex flex-col gap-1">
                    <p>• Transmissão da propriedade de 01 Lote de terreno localizado no Loteamento Ouro Verde.</p>
                    <p>• Valor de repasse comercial atribuído ao lote de terreno: <strong>{fmt(valorMercadoLote)}</strong>.</p>
                    <p>• Ganho adicional / Ágio em ativo repassado em favor do cliente: <strong>{fmt(valorizacaoRepassadaLote)}</strong>.</p>
                  </div>
                  <p>
                    <strong>Cláusula Terceira (Quitação de Saldo Devedor):</strong> Com a formalização deste instrumento, o adquirente fica integralmente desonerado do saldo devedor restante do apartamento no valor de R$ {saldoDevedorRestante.toLocaleString('pt-BR')}, eximindo-se de quaisquer parcelas remanescentes de obras junto à construtora.
                  </p>
                </div>
              </div>
            </div>

            {/* Rodapé e Assinaturas */}
            <div className="border-t border-gray-300 pt-6">
              <div className="grid grid-cols-2 gap-12 text-center text-[9px] font-bold tracking-wider text-gray-600">
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">STUDIO 57 INCORPORADORA LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Representante Comercial</p>
                </div>
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">MONTE ALTO EMPREENDIMENTOS LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Cliente Proprietário</p>
                </div>
              </div>
            </div>
          </div>

          {/* ================= PROPOSTA B ================= */}
          <div className="w-[210mm] h-[297mm] bg-white border border-gray-300 pt-8 pb-6 px-12 flex flex-col justify-between shrink-0 shadow-sm print:shadow-none print:border-none print:p-0 print:w-full print:h-[297mm] print:break-after-page print-break-page">
            <div>
              {/* Cabeçalho */}
              <div className="flex justify-between items-center border-b border-gray-955 pb-3 mb-5">
                <div>
                  <img 
                    src="/brand/studio_57_logo_preto.png" 
                    alt="Studio 57" 
                    className="h-8 object-contain"
                  />
                  <p className="text-[8.5px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Cessão & Reestruturação Comercial de Ativos
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9.5px] font-bold text-gray-900 tracking-wider uppercase border-b border-gray-900 pb-0.5">
                    PROPOSTA B
                  </span>
                  <p className="text-[8.5px] text-gray-400 mt-1 font-medium">Ref: APARTAMENTO 504 — ALFA</p>
                </div>
              </div>

              {/* Título */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 uppercase tracking-tight font-khand">
                  Instrumento de Proposta de Acordo Comercial
                </h2>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                  Modalidade: Intermediação de Repasse de Ágio Valorizado (Manutenção de Adimplência)
                </p>
              </div>

              {/* Cláusulas */}
              <div className="mb-4 flex flex-col gap-2.5 text-[10.5px] text-gray-700 leading-normal">
                <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-widest mb-0.5 border-l-2 border-gray-900 pl-2">
                  1. Condições da Intermediação e Cessão de Ágio
                </h3>
                <p>
                  <strong>Cláusula Primeira (Do Repasse):</strong> A Monte Alto disponibiliza a Unidade 504 no mercado para repasse a terceiros adquirentes pelo valor total de transação de <strong>{fmt(custoTotalNovoComprador)}</strong>. Este repasse concede ao novo adquirente uma economia direta de <strong>{fmt(economiaNovoComprador)}</strong> em relação ao preço de tabela atualizado (R$ {valTabelaAtualizada.toLocaleString('pt-BR')}).
                </p>
                <p>
                  <strong>Cláusula Segunda (Estrutura de Recebimento de Valores):</strong> O novo comprador assume as obrigações contratuais sob a seguinte divisão financeira:
                </p>
                <div className="pl-3.5 border-l border-gray-300 font-medium my-1 text-[10.5px] flex flex-col gap-1.5 bg-gray-50/50 p-2.5 rounded">
                  <div className="flex justify-between">
                    <span>• Pagamento de Ágio Valorizado à Monte Alto:</span>
                    <span className="font-bold text-gray-900">{fmt(agioValorizado)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1">
                    <span>• Assunção de Saldo Devedor Restante (Studio 57):</span>
                    <span className="font-bold text-gray-900">{fmt(saldoDevedorRestante)}</span>
                  </div>
                  <div className="pl-3 text-[9.5px] text-gray-400 flex flex-col gap-0.5 w-full font-normal">
                    <div className="flex justify-between">
                      <span>- Parcelas Remanescentes de Obra:</span>
                      <span>{numParcelasRemanescentes}x mensais de {fmt(valParcelaObra)}</span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>- Parcela Final de Chaves:</span>
                      <span>R$ 0,00 (Desconto / Isento)</span>
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-1 font-black text-gray-900">
                    <span>Custo Total do Repasse:</span>
                    <span>{fmt(custoTotalNovoComprador)}</span>
                  </div>
                </div>

                {/* Destaque Obrigatório */}
                <div className="bg-red-50/10 border border-gray-900 p-2.5 rounded text-[10px] font-medium text-gray-700 my-0.5 leading-relaxed">
                  <strong>Cláusula Terceira (Da Manutenção da Adimplência - Obrigatório):</strong> O proprietário (Monte Alto) assume a obrigação irretratável de manter-se integralmente adimplente com o cronograma financeiro e os aportes das parcelas de obras mensais junto à Construtora proponente durante todo o interstício de comercialização da unidade no mercado, sob pena de rescisão e cancelamento imediato da presente proposta de intermediação de repasse.
                </div>

                <p>
                  <strong>Cláusula Quarta (Da Autonomia e Não Exclusividade Comercial):</strong> 
                </p>
                <div className="pl-3.5 border-l border-gray-300 text-[10px] text-gray-650 flex flex-col gap-1 font-medium">
                  <p>
                    I. É direito exclusivo e soberano do proprietário (Monte Alto) fixar, aumentar ou reduzir o valor pretendido de ágio e suas respectivas condições de recebimento a qualquer tempo, de acordo com a sua conveniência ou necessidade individual, mediante proposta específica formulada junto a potenciais adquirentes.
                  </p>
                  <p>
                    II. Por se tratar de direito legítimo de propriedade, o cedente Monte Alto possui total liberdade para disponibilizar e promover a venda do ágio de sua unidade através de outras imobiliárias e corretores terceiros ativos de mercado, não restando estabelecido qualquer caráter de exclusividade comercial ou de corretagem com a proponente Studio 57.
                  </p>
                  <p>
                    III. Fica ajustado que este plano financeiro e as estimativas de ágio descritos constituem uma proposta e estudo comercial de valor elaborados pela Studio 57, visando ao melhor ganho patrimonial e maior atratividade do ativo no mercado.
                  </p>
                </div>

                <p>
                  <strong>Cláusula Quinta (Comissão de Intermediação):</strong> Fica estabelecida a taxa de intermediação e corretagem de <strong>{taxaComissao.toFixed(1)}%</strong> sob o valor total da venda (R$ {custoTotalNovoComprador.toLocaleString('pt-BR')}), resultando em <strong>{fmt(comissaoStudio)}</strong>. Esta comissão é devida pelo vendedor (Monte Alto) e deverá ser quitada integralmente junto à Incorporadora no ato da assinatura do instrumento de cessão de direitos (fechamento da venda).
                </p>
              </div>
            </div>

            {/* Rodapé e Assinaturas */}
            <div className="border-t border-gray-300 pt-6">
              <div className="grid grid-cols-2 gap-12 text-center text-[9px] font-bold tracking-wider text-gray-600">
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">STUDIO 57 INCORPORADORA LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Representante Comercial</p>
                </div>
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">MONTE ALTO EMPREENDIMENTOS LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Cliente Proprietário</p>
                </div>
              </div>
            </div>
          </div>

          {/* ================= PROPOSTA C ================= */}
          <div className="w-[210mm] h-[297mm] bg-white border border-gray-300 pt-8 pb-6 px-12 flex flex-col justify-between shrink-0 shadow-sm print:shadow-none print:border-none print:p-0 print:w-full print:h-[297mm] print:break-after-page print-break-page">
            <div>
              {/* Cabeçalho */}
              <div className="flex justify-between items-center border-b border-gray-955 pb-3 mb-6">
                <div>
                  <img 
                    src="/brand/studio_57_logo_preto.png" 
                    alt="Studio 57" 
                    className="h-8 object-contain"
                  />
                  <p className="text-[8.5px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Cessão & Reestruturação Comercial de Ativos
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9.5px] font-bold text-gray-900 tracking-wider uppercase border-b border-gray-900 pb-0.5">
                    PROPOSTA C
                  </span>
                  <p className="text-[8.5px] text-gray-400 mt-1 font-medium">Ref: APARTAMENTO 504 — ALFA</p>
                </div>
              </div>

              {/* Título do Instrumento */}
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 uppercase tracking-tight font-khand">
                  Instrumento de Proposta de Acordo Comercial
                </h2>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                  Modalidade: Parceria de Propriedade Compartilhada (Sociedade de Revenda)
                </p>
              </div>

              {/* Dados */}
              <div className="mb-4 border-b border-gray-200 pb-4 text-[11px] text-gray-800 leading-relaxed">
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Proponente:</span> STUDIO 57 INCORPORADORA LTDA</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Cliente Cedente:</span> MONTE ALTO EMPREENDIMENTOS IMOBILIÁRIOS LTDA</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Objeto:</span> Unidade Habitacional Autônoma 504 (com Garagem Coberta nº 09)</p>
                <p className="mb-1.5"><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-2">Localização:</span> Empreendimento Residencial Alfa</p>
              </div>

              {/* Cláusulas da Proposta C */}
              <div className="mb-6 flex flex-col gap-3.5 text-[11px] text-gray-750 leading-relaxed">
                <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-widest mb-1 border-l-2 border-gray-900 pl-2">
                  1. Condições da Parceria de Propriedade Compartilhada
                </h3>
                <p>
                  <strong>Cláusula Primeira (Constituição da Sociedade):</strong> Em troca de assumir a responsabilidade total e integral pelo pagamento das parcelas de obras remanescentes de obras (R$ {saldoDevedorRestante.toLocaleString('pt-BR')}), a MONTE ALTO cede **{pctSaldoDevedor.toFixed(2)}%** do imóvel para o Studio 57, estabelecendo uma copropriedade na seguinte proporção:
                </p>
                <div className="pl-3.5 border-l border-gray-300 font-medium my-1.5 text-[11px] flex flex-col gap-1">
                  <p>• Fração de Propriedade Monte Alto (Cedente): <strong>{pctQuitada.toFixed(2)}%</strong> (Capital Investido de R$ {valTotalPago.toLocaleString('pt-BR')})</p>
                  <p>• Fração de Propriedade Studio 57 (Assunção): <strong>{pctSaldoDevedor.toFixed(2)}%</strong> (Saldo Remanescente de R$ {saldoDevedorRestante.toLocaleString('pt-BR')})</p>
                </div>
                <p>
                  <strong>Cláusula Segunda (Partilha da Revenda):</strong> A unidade será comercializada no mercado de forma conjunta e o fluxo de caixa líquido recebido (descontada a comissão de intermediação imobiliária de 5%) será repassado a cada sócio, proporcionalmente, no ato do recebimento de cada parcela/entrada liquidação do novo contrato:
                </p>
                <div className="pl-3.5 border-l border-gray-300 font-medium my-1.5 text-[11px] flex flex-col gap-1 bg-gray-50/50 p-2.5 rounded">
                  <div className="flex justify-between">
                    <span>• Preço de Tabela Estimado de Revenda:</span>
                    <span>{fmt(valTabelaAtualizada)}</span>
                  </div>
                  <div className="flex justify-between text-red-500 border-b border-gray-200 pb-0.5">
                    <span>• (-) Comissão de Venda Estimada (5%):</span>
                    <span>-{fmt(comissaoCorretorOpcaoC)}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-gray-900">
                    <span>• Valor Líquido Total a Partilhar:</span>
                    <span>{fmt(valorLiquidoPartilharC)}</span>
                  </div>
                  <div className="flex justify-between pt-0.5 pl-2 border-l border-gray-300 text-[9.5px] text-gray-500">
                    <span>- Cota Líquida da Monte Alto ({pctQuitada.toFixed(2)}%):</span>
                    <span className="font-bold text-purple-700">{fmt(cotaLiquidaMonteAltoC)}</span>
                  </div>
                  <div className="flex justify-between pl-2 border-l border-gray-300 text-[9.5px] text-gray-500">
                    <span>- Cota Líquida do Studio 57 ({pctSaldoDevedor.toFixed(2)}%):</span>
                    <span>{fmt(cotaLiquidaStudioC)}</span>
                  </div>
                </div>
                <p>
                  <strong>Cláusula Terceira (Comissão de Venda):</strong> A despesa com taxas de intermediação de venda (comissão de corretagem) de 5% será integralmente deduzida do preço bruto no ato do fechamento da venda com o terceiro adquirente, sendo compartilhada proporcionalmente entre os coproprietários.
                </p>
              </div>
            </div>

            {/* Rodapé e Assinaturas */}
            <div className="border-t border-gray-300 pt-6">
              <div className="grid grid-cols-2 gap-12 text-center text-[9px] font-bold tracking-wider text-gray-600">
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">STUDIO 57 INCORPORADORA LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Representante Comercial</p>
                </div>
                <div>
                  <div className="border-b border-gray-400 w-3/4 mx-auto mb-1.5 h-6"></div>
                  <p className="uppercase">MONTE ALTO EMPREENDIMENTOS LTDA</p>
                  <p className="text-[8px] text-gray-400 font-normal uppercase tracking-widest mt-0.5">Cliente Proprietário</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
