export default function TutorialCartaoCredito() {
  return (
    <div className="space-y-6">
      <p className="text-lg leading-relaxed text-gray-700">
        O <strong>Elo 57</strong> conta com um módulo financeiro inteligente para gerenciar gastos com cartões de crédito. Diferente de contas correntes ou caixas físicos comuns, os cartões agrupam os lançamentos dentro de <strong>Faturas Mensais</strong> baseadas em ciclos de corte e regras de vencimento automáticas.
      </p>

      {/* Box de Resumo Conceitual */}
      <div className="bg-rose-50/50 p-5 rounded-xl border border-rose-100 flex gap-4">
        <div className="text-3xl text-rose-600">💳</div>
        <div>
          <h3 className="text-rose-900 font-bold mb-1">Conceito Básico das Datas</h3>
          <ul className="list-disc list-inside text-gray-600 text-sm space-y-1">
            <li><strong>Data da Compra:</strong> Quando você passou o cartão físico ou fez o gasto online.</li>
            <li><strong>Data de Vencimento:</strong> A data limite para pagar a fatura correspondente.</li>
            <li><strong>Data de Pagamento:</strong> O dia em que o dinheiro de fato saiu da conta corrente para quitar o cartão.</li>
          </ul>
        </div>
      </div>

      {/* Seção 1: Ciclos de Fechamento */}
      <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4 border-b pb-2">1. A Matemática dos Ciclos (Quando a Fatura Fecha?)</h3>
      <p className="text-gray-600 text-sm leading-relaxed">
        Cada cartão cadastrado nas Configurações possui dois parâmetros essenciais: o <strong>Dia de Fechamento da Fatura</strong> e o <strong>Dia de Pagamento da Fatura</strong> (vencimento).
      </p>

      <div className="space-y-4 mt-4">
        <div className="flex gap-4 items-start">
          <div className="bg-rose-100 text-rose-700 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-1 shadow-sm">1</div>
          <div>
            <h4 className="font-bold text-gray-800">O Dia de Fechamento (Corte)</h4>
            <p className="text-gray-600 text-sm mt-1">
              Determina se a compra entra no mês atual ou no mês seguinte:
              <br />
              • Compras feitas <strong>no dia ou antes do Fechamento</strong> entram na fatura do <strong>mês corrente</strong>.
              <br />
              • Compras feitas <strong>depois do Fechamento</strong> caem organicamente na fatura do <strong>mês seguinte</strong>.
              <br />
              <span className="text-xs text-gray-500 italic">Exemplo: Se o fechamento é dia 28, uma compra no dia 25 de Março cai em Março. Uma compra no dia 29 de Março cai na fatura de Abril.</span>
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-rose-100 text-rose-700 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-1 shadow-sm">2</div>
          <div>
            <h4 className="font-bold text-gray-800">O Pulo de Mês (Cálculo de Vencimento)</h4>
            <p className="text-gray-600 text-sm mt-1">
              Como o sistema sabe se a fatura fecha em um mês e vence no mesmo ou no outro?
              <br />
              • <strong>Vencimento menor que o Fechamento</strong> (Ex: Fecha dia 28, vence dia 7): O sistema entende que a fatura fechada num mês só é paga no mês subsequente. (Ex: ciclo fechado em Março vence em 07/Abril).
              <br />
              • <strong>Vencimento maior que o Fechamento</strong> (Ex: Fecha dia 10, vence dia 25): O pagamento ocorre dentro do mesmo mês do fechamento.
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-rose-100 text-rose-700 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-1 shadow-sm">3</div>
          <div>
            <h4 className="font-bold text-gray-800">Mês de Referência</h4>
            <p className="text-gray-600 text-sm mt-1">
              No Elo 57, a biblioteca de faturas é sempre organizada e exibida pelo <strong>Mês/Ano de seu Vencimento</strong> (Ex: Fatura de Junho de 2026).
            </p>
          </div>
        </div>
      </div>

      {/* Seção 2: Edição e Troca de Datas */}
      <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4 border-b pb-2">2. Edição de Compras e Ajustes de Fatura</h3>
      <p className="text-gray-600 text-sm leading-relaxed">
        Se você precisar editar o valor, a data da compra ou o vencimento de um lançamento de cartão, a inteligência do sistema entra em ação automaticamente:
      </p>

      <div className="bg-yellow-50 border border-yellow-200 p-5 rounded-lg flex gap-4 mt-2">
        <div className="text-2xl">⚡</div>
        <div>
          <h3 className="text-yellow-800 font-bold mb-2">Regra de Ouro da Organização</h3>
          <p className="text-yellow-700 text-sm">
            Toda vez que você edita a data de uma compra para uma data futura ou passada, o sistema recalcula de forma instantânea a qual fatura ela pertence. Ele desvincula o lançamento da fatura atual e o move para a nova fatura correspondente. Caso a fatura de destino ainda não exista no sistema, o próprio Elo 57 criará ela para você em background.
          </p>
        </div>
      </div>

      {/* Seção 3: Auditoria do Caixa (LIFO) */}
      <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4 border-b pb-2">3. Como Funciona a Auditoria das Faturas (Cachoeira de Dívida)</h3>
      <p className="text-gray-600 text-sm leading-relaxed">
        Às vezes, a equipe pode cometer um erro comum: registrar o pagamento da fatura de Março na aba ou comprovante da fatura de Abril. Para impedir que faturas fiquem marcadas incorretamente como "Em aberto" por mero erro operacional, o sistema roda a **Cachoeira de Dívida Retroativa**:
      </p>

      <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl flex gap-4 mt-2">
        <div className="text-3xl text-blue-500">💡</div>
        <div>
          <h3 className="text-blue-800 font-bold mb-2">A Lógica da Cachoeira</h3>
          <p className="text-blue-700 text-sm leading-relaxed">
            O sistema soma <strong>todas as despesas com cartão</strong> acumuladas na história e deduz <strong>todos os pagamentos realizados</strong>. Se o total pago cobrir as despesas das faturas anteriores, elas serão marcadas visualmente com o status verde <strong>"PAGO"</strong>, indiferente de onde o comprovante físico de pagamento foi anexado. O saldo devedor restante é acumulado sempre na fatura mais recente (futura).
          </p>
        </div>
      </div>

      {/* Seção 4: Importação por IA */}
      <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4 border-b pb-2">4. Anexando PDFs e Conciliação por Inteligência Artificial</h3>
      <p className="text-gray-600 text-sm leading-relaxed">
        Ao importar o PDF de um extrato de cartão de crédito no gerenciador de faturas, a Inteligência Artificial lê todas as compras, estornos e créditos automaticamente.
      </p>
      <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl flex gap-4 mt-2">
        <div className="text-3xl text-emerald-600">🪄</div>
        <div>
          <h3 className="text-emerald-800 font-bold mb-2">Ancoragem de Segurança</h3>
          <p className="text-emerald-700 text-sm leading-relaxed">
            Para garantir que a importação de uma fatura de meses passados não altere o fluxo de caixa histórico ou o Demonstrativo de Resultados (DRE) do mês atual, o sistema faz uma <strong>ancoragem temporal</strong>. A data de vencimento e pagamento dos lançamentos gerados pela IA são vinculados à data de vencimento daquela fatura ativa específica. Isso mantém a contabilidade blindada contra retrocessos.
          </p>
        </div>
      </div>
    </div>
  );
}
