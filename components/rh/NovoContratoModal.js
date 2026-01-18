// components/rh/NovoContratoModal.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, 
    faSave, 
    faSpinner, 
    faSearch, 
    faBuilding, 
    faUserTie 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function NovoContratoModal({ isOpen, onClose, onSuccess }) {
    const supabase = createClient();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(false);
    
    // Estados da Busca Inteligente
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedFornecedor, setSelectedFornecedor] = useState(null);
    const searchRef = useRef(null);
    
    // Formulário
    const [formData, setFormData] = useState({
        titulo: '',
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim: '',
        valor_total: '',
        descricao: ''
    });

    // Resetar estados ao abrir/fechar
    useEffect(() => {
        if (!isOpen) {
            setFormData({
                titulo: '',
                data_inicio: new Date().toISOString().split('T')[0],
                data_fim: '',
                valor_total: '',
                descricao: ''
            });
            setSelectedFornecedor(null);
            setSearchTerm('');
            setSearchResults([]);
        }
    }, [isOpen]);

    // Lógica de Busca (Debounce manual com setTimeout)
    useEffect(() => {
        // Se já tem um selecionado ou termo muito curto, não busca
        if (selectedFornecedor || searchTerm.length < 2) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            if (!user?.organizacao_id) return;
            
            setIsSearching(true);
            try {
                const { data, error } = await supabase
                    .from('contatos')
                    .select('id, nome, razao_social, cnpj, cpf, foto_url')
                    .eq('organizacao_id', user.organizacao_id)
                    .eq('tipo_contato', 'Fornecedor') // Filtra só fornecedores
                    .or(`nome.ilike.%${searchTerm}%,razao_social.ilike.%${searchTerm}%,cnpj.ilike.%${searchTerm}%`)
                    .limit(5);

                if (error) throw error;
                setSearchResults(data || []);
            } catch (error) {
                console.error("Erro na busca:", error);
            } finally {
                setIsSearching(false);
            }
        }, 300); // Espera 300ms após parar de digitar

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, user?.organizacao_id, selectedFornecedor]);

    // Selecionar Fornecedor
    const handleSelectFornecedor = (fornecedor) => {
        setSelectedFornecedor(fornecedor);
        setSearchTerm('');
        setSearchResults([]);
    };

    // Limpar Fornecedor
    const handleClearFornecedor = () => {
        setSelectedFornecedor(null);
        setSearchTerm('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedFornecedor) return toast.error('Selecione um fornecedor.');
        if (!formData.titulo) return toast.error('Dê um título ao contrato.');

        setLoading(true);
        try {
            const payload = {
                organizacao_id: user.organizacao_id,
                fornecedor_id: selectedFornecedor.id, // ID vindo da seleção
                titulo: formData.titulo,
                data_inicio: formData.data_inicio,
                data_fim: formData.data_fim || null,
                valor_total: formData.valor_total ? parseFloat(formData.valor_total) : 0,
                descricao: formData.descricao,
                status: 'Ativo'
            };

            const { error } = await supabase
                .from('contratos_terceirizados')
                .insert([payload]);

            if (error) throw error;

            toast.success('Contrato criado com sucesso!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar contrato.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-800">Novo Contrato de Prestação de Serviço</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-grow space-y-5">
                    
                    {/* --- ÁREA DE SELEÇÃO DE FORNECEDOR (TIPO FINANCEIRO) --- */}
                    <div className="relative" ref={searchRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quem é o Fornecedor?</label>
                        
                        {selectedFornecedor ? (
                            // ESTADO 1: Fornecedor Selecionado
                            <div className="flex items-center justify-between p-3 border border-blue-200 bg-blue-50 rounded-lg text-blue-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-700">
                                        <FontAwesomeIcon icon={selectedFornecedor.cnpj ? faBuilding : faUserTie} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{selectedFornecedor.nome || selectedFornecedor.razao_social}</p>
                                        <p className="text-xs text-blue-600 opacity-80">
                                            {selectedFornecedor.cnpj || selectedFornecedor.cpf || 'Documento não informado'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={handleClearFornecedor}
                                    className="text-blue-400 hover:text-red-500 p-2 transition-colors"
                                    title="Trocar fornecedor"
                                >
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                        ) : (
                            // ESTADO 2: Input de Busca
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Digite o nome, razão social ou CNPJ..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    autoFocus
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <FontAwesomeIcon icon={isSearching ? faSpinner : faSearch} spin={isSearching} />
                                </div>

                                {/* Lista de Resultados */}
                                {(searchTerm.length >= 2 && !selectedFornecedor) && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {searchResults.length === 0 && !isSearching ? (
                                            <div className="p-4 text-center text-gray-500 text-sm">
                                                Nenhum fornecedor encontrado.
                                                <br/>
                                                <span className="text-xs text-gray-400">Verifique a aba "Contatos" se ele está cadastrado como Fornecedor.</span>
                                            </div>
                                        ) : (
                                            <ul>
                                                {searchResults.map((f) => (
                                                    <li 
                                                        key={f.id}
                                                        onClick={() => handleSelectFornecedor(f)}
                                                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors flex items-center justify-between group"
                                                    >
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">
                                                                {f.nome || f.razao_social}
                                                            </p>
                                                            {f.cnpj && <p className="text-xs text-gray-500">CNPJ: {f.cnpj}</p>}
                                                            {f.cpf && <p className="text-xs text-gray-500">CPF: {f.cpf}</p>}
                                                        </div>
                                                        <FontAwesomeIcon icon={faBuilding} className="text-gray-300 group-hover:text-blue-400" />
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Título */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título do Contrato</label>
                        <input 
                            type="text" 
                            required
                            value={formData.titulo}
                            onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Ex: Manutenção de Ar Condicionado"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Data Início */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Início da Vigência</label>
                            <input 
                                type="date" 
                                required
                                value={formData.data_inicio}
                                onChange={(e) => setFormData({...formData, data_inicio: e.target.value})}
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {/* Data Fim */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fim da Vigência (Opcional)</label>
                            <input 
                                type="date" 
                                value={formData.data_fim}
                                onChange={(e) => setFormData({...formData, data_fim: e.target.value})}
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Valor */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Contrato (R$)</label>
                        <input 
                            type="number" 
                            step="0.01"
                            value={formData.valor_total}
                            onChange={(e) => setFormData({...formData, valor_total: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0,00"
                        />
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Observações / Detalhes</label>
                        <textarea 
                            rows="3"
                            value={formData.descricao}
                            onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Informações adicionais..."
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                        type="button"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        Salvar Contrato
                    </button>
                </div>
            </div>
        </div>
    );
}