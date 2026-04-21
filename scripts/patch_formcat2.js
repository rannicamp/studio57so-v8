const fs = require('fs');
const file = 'components/financeiro/LancamentoForm/FormCategorizacao.js';
let c = fs.readFileSync(file, 'utf8');

const passivoBlock = `
 {/* Vincular a Passivo (Empréstimo) — aparece só para Despesas */}
 {formData.tipo === 'Despesa' && passivosDisponiveis.length > 0 && (
 <div className="p-3 border border-red-200 rounded-lg bg-red-50 mt-4">
 <label className="block text-[11px] font-bold text-red-700 uppercase tracking-wider mb-1.5">
 📉 Vincular a Passivo / Empréstimo (opcional)
 </label>
 <p className="text-xs text-red-600 mb-2">
 Esta despesa é o pagamento de um empréstimo ou passivo? Vincule aqui para abater a dívida automaticamente.
 </p>
 <select
 name="lancamento_passivo_id"
 value={formData.lancamento_passivo_id || ''}
 onChange={handleChange}
 className="w-full p-2 bg-white border border-red-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
 >
 <option value="">— Não vincular —</option>
 {passivosDisponiveis.map(p => (
 <option key={p.id} value={p.id}>
 {p.descricao} ({formatCurrency(p.valor)})
 </option>
 ))}
 </select>
 </div>
 )}
`;

c = c.replace('<div className="md:col-span-2 pt-2">', passivoBlock + '\n <div className="md:col-span-2 pt-2">');

fs.writeFileSync(file, c);
