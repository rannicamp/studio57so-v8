import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>
            )}
        </span>
    );
};

const CategoryOption = ({ category, level = 0 }) => (
    <>
        <option key={category.id} value={category.id}>
            {'\u00A0'.repeat(level * 4)}
            {category.nome}
        </option>
        {category.children && category.children.map(child => (
            <CategoryOption key={child.id} category={child} level={level + 1} />
        ))}
    </>
);

export default function FormCategorizacao({
    formData, handleChange, dropdownData, empresas,
    favorecidoSearchTerm, handleFavorecidoSearch, handleClearFavorecido,
    handleSelectFavorecido, favorecidoSearchResults, hierarchicalCategorias,
    ativosDisponiveis = []
}) {
    return (
        <div className="space-y-4 pt-4 border-t mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">Status</label>
                    <select name="status" value={formData.status || 'Pendente'} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                        <option value="Pendente">Pendente</option>
                        <option value="Pago">Pago</option>
                    </select>
                </div>
                {formData.status === 'Pago' && (
                    <div className="animate-fade-in">
                        <label className="block text-sm font-medium">Data do Pagamento</label>
                        <input type="date" name="data_pagamento" value={formData.data_pagamento || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md bg-green-50" />
                    </div>
                )}
            </div>

            {formData.form_type === 'transferencia' ? (
                <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in">
                    <legend className="font-semibold text-sm">Contas</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div>
                            <label className="block text-sm font-medium">De (Origem)*</label>
                            <select name="conta_origem_id" value={formData.conta_origem_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                                <option value="">Selecione...</option>
                                {dropdownData?.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Para (Destino)*</label>
                            <select name="conta_destino_id" value={formData.conta_destino_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                                <option value="">Selecione...</option>
                                {dropdownData?.contas.filter(c => c.id !== formData.conta_origem_id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                    </div>
                </fieldset>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Conta*</label>
                        <select name="conta_id" value={formData.conta_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Selecione...</option>
                            {dropdownData?.contas
                                .filter(c => c.tipo !== 'Conta de Ativo' && c.tipo !== 'Conta de Passivo')
                                .map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Categoria</label>
                        <select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Selecione...</option>
                            {hierarchicalCategorias.map(c => <CategoryOption key={c.id} category={c} />)}
                        </select>
                    </div>
                    <div className="md:col-span-2 relative">
                        <label className="block text-sm font-medium">Favorecido / Fornecedor</label>
                        <input type="text" value={favorecidoSearchTerm} onChange={handleFavorecidoSearch} disabled={!!formData.favorecido_contato_id} placeholder={formData.favorecido_contato_id ? '' : 'Digite para buscar...'} className="mt-1 w-full p-2 border rounded-md" />
                        {formData.favorecido_contato_id && (
                            <button type="button" onClick={handleClearFavorecido} className="absolute right-2 top-8 text-gray-500 hover:text-red-600">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        )}
                        {favorecidoSearchTerm && !formData.favorecido_contato_id && (
                            <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                                {favorecidoSearchResults.map(contato => (
                                    <li key={contato.id} onClick={() => handleSelectFavorecido(contato)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                                        <HighlightedText text={contato.nome || contato.razao_social} highlight={favorecidoSearchTerm} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Empresa</label>
                        <select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md bg-blue-50" disabled={!!formData.empreendimento_id}>
                            <option value="">Nenhuma</option>
                            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Empreendimento</label>
                        <select name="empreendimento_id" value={formData.empreendimento_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Nenhum</option>
                            {dropdownData?.empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Etapa da Obra</label>
                        <select name="etapa_id" value={formData.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!formData.empreendimento_id}>
                            <option value="">Nenhuma</option>
                            {dropdownData?.etapas.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)}
                        </select>
                    </div>
                </div>
            )}

            {/* Vincular a Ativo Patrimonial — aparece só para Receitas */}
            {formData.tipo === 'Receita' && ativosDisponiveis.length > 0 && (
                <div className="p-3 border border-green-200 rounded-lg bg-green-50">
                    <label className="block text-[11px] font-bold text-green-700 uppercase tracking-wider mb-1.5">
                        📈 Vincular a Ativo Patrimonial (opcional)
                    </label>
                    <p className="text-xs text-green-600 mb-2">
                        Esta receita é proveniente da venda de um ativo? Vincule aqui e o valor será descontado do patrimônio automaticamente.
                    </p>
                    <select
                        name="lancamento_ativo_id"
                        value={formData.lancamento_ativo_id || ''}
                        onChange={handleChange}
                        className="w-full p-2 bg-white border border-green-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500 transition-colors"
                    >
                        <option value="">— Não vincular —</option>
                        {ativosDisponiveis.map(a => (
                            <option key={a.id} value={a.id}>
                                {a.descricao} ({formatCurrency(a.valor)})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="md:col-span-2 pt-2">
                <label className="block text-sm font-medium">Observações</label>
                <textarea name="observacoes" value={formData.observacoes || ''} onChange={handleChange} rows="3" placeholder="Detalhes..." className="mt-1 w-full p-2 border rounded-md"></textarea>
            </div>
        </div>
    );
}
