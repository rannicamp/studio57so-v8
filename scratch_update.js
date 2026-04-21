const fs = require('fs');

function updateLancamentosModal() {
    let path = 'c:/Projetos/studio57so-v8/components/financeiro/LancamentoFormModal.js';
    let content = fs.readFileSync(path, 'utf8');

    // 1. Modificar a query em LancamentoFormModal
    content = content.replace("eq('tipo', 'Ativo')", "in('tipo', ['Ativo', 'Passivo'])");
    content = content.replace("select('id, descricao, valor')", "select('id, descricao, valor, tipo')");

    fs.writeFileSync(path, content, 'utf8');
}

function updateFormCategorizacao() {
    let path = 'c:/Projetos/studio57so-v8/components/financeiro/LancamentoForm/FormCategorizacao.js';
    let content = fs.readFileSync(path, 'utf8');

    // Regex para substituir a seção inteira do Select de Ativos (da linha 174 à 196 aproximadamente)
    // Procuraríamos por '{formData.tipo === 'Receita' && ativosDisponiveis.length > 0 && (' e subtituiríamos o bloco todo.
    // Para simplificar vamos achar o offset exato:
    const searchString = "{/* Vincular a Ativo Patrimonial — aparece só para Receitas */}";
    const endIndex = content.indexOf("</select>", content.indexOf(searchString)) + 19; // +19 para incluir '</div>\n  )}'
    
    // Na verdade, um replace customizado é mais seguro:
    let newBlock = `  {/* Vincular a Patrimonial — aparece para Receitas e Despesas */}
  {(formData.tipo === 'Receita' || formData.tipo === 'Despesa') && ativosDisponiveis.length > 0 && (
    <div className={"p-3 border rounded-lg mt-4 " + (formData.tipo === 'Receita' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50')}>
      <label className={"block text-[11px] font-bold uppercase tracking-wider mb-1.5 " + (formData.tipo === 'Receita' ? 'text-green-700' : 'text-red-700')}>
        📈 Vincular a Patrimônio (Ativo / Passivo) (opcional)
      </label>
      <p className={"text-xs mb-2 " + (formData.tipo === 'Receita' ? 'text-green-600' : 'text-red-600')}>
        {formData.tipo === 'Receita' 
          ? 'Esta receita é proveniente da venda/baixa de um ativo? Vincule aqui.' 
          : 'Esta despesa é de pagamento/abatimento de passivo (dívida)? Vincule aqui para abater o saldo devedor.'}
      </p>
      <select
        name="lancamento_ativo_id"
        value={formData.lancamento_ativo_id || ''}
        onChange={handleChange}
        className={"w-full p-2 bg-white border rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 transition-colors " + (formData.tipo === 'Receita' ? 'border-green-300 focus:ring-green-500' : 'border-red-300 focus:ring-red-500')}
      >
        <option value="">— Não vincular —</option>
        {ativosDisponiveis.map(a => (
          <option key={a.id} value={a.id}>
            [{a.tipo}] {a.descricao} ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.valor)})
          </option>
        ))}
      </select>
    </div>
  )}`;

    // Vamos encontrar o bloco existente:
    const regex = /\{\/\* Vincular a Ativo Patrimonial — aparece só para Receitas \*\/\}[\s\S]*?\n  \)\}/;
    content = content.replace(regex, newBlock);

    fs.writeFileSync(path, content, 'utf8');
}

try {
    updateLancamentosModal();
    updateFormCategorizacao();
    console.log("Sucesso!");
} catch (e) {
    console.error(e);
}
