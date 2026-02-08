// components/crm/ContatoCardCRM.js
"use client";

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useRef, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faEllipsisV, faStickyNote, faBullhorn, faHome, faTasks, faPhone, 
    faUserTie, faSpinner, faTimes, faPlus, faTrash, faGlobe 
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'; // Importamos o ícone do Zap
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

export default function ContatoCardCRM({
    funilEntry, onDragStart, allColumns, onMoveToColumn, onOpenNotesModal,
    availableProducts, onAssociateProduct, onDissociateProduct,
    onAssociateCorretor, onCardClick, onAddActivity, onDeleteCard,
    onStartWhatsApp // <--- Recebendo a nova função
}) {
    const supabase = createClient();
    const { organizacao_id } = useAuth();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const corretorDropdownRef = useRef(null);

    const [isEditingCorretor, setIsEditingCorretor] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState('');

    const { data: searchResults = [], isLoading: isSearching } = useQuery({
        queryKey: ['searchCorretores', debouncedSearchTerm, organizacao_id],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('buscar_contatos_geral', {
                p_search_term: debouncedSearchTerm,
                p_organizacao_id: organizacao_id
            });
            if (error) {
                console.error("Erro ao buscar corretores:", error);
                toast.error("Falha na busca de corretores.");
                return [];
            }
            return data || [];
        },
        enabled: !!debouncedSearchTerm && !!organizacao_id,
    });

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
            if (corretorDropdownRef.current && !corretorDropdownRef.current.contains(event.target)) setIsEditingCorretor(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const productIdsInteresse = useMemo(() =>
        new Set((funilEntry.produtos_interesse || []).map(p => p.produto.id)),
        [funilEntry.produtos_interesse]
    );
    const filteredAvailableProducts = useMemo(() =>
        availableProducts.filter(p => !productIdsInteresse.has(p.id)),
        [availableProducts, productIdsInteresse]
    );

    if (!funilEntry || !funilEntry.contatos) return <div className="bg-red-100 p-3 rounded-md shadow">Erro ao carregar contato.</div>;

    const contato = funilEntry.contatos;
    const cardNumber = funilEntry.numero_card;
    const currentColumnId = funilEntry.coluna_id;
    const isMetaLead = contato.origem === 'Meta Lead Ad';
    
    const adName = contato?.meta_ad_name;
    const campaignName = contato?.meta_campaign_name;

    const handleAddProduct = () => {
        if (!selectedProductId) {
            toast.error("Selecione uma unidade para adicionar.");
            return;
        }
        onAssociateProduct(funilEntry.id, selectedProductId);
        setSelectedProductId('');
        setIsAddingProduct(false);
    };

    const handleDeleteCardClick = (e) => {
        e.stopPropagation();
        toast("Confirmar Exclusão do Card", {
            description: `Tem certeza que deseja excluir o card #${cardNumber} (${displayName}) do funil? O contato não será apagado.`,
            action: {
                label: "Excluir Card",
                onClick: () => onDeleteCard(funilEntry.id),
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' },
        });
        setIsDropdownOpen(false);
    };

    const handleSelectCorretor = (corretorId) => { onAssociateCorretor(funilEntry.id, corretorId); setIsEditingCorretor(false); setSearchTerm(''); };
    const handleClearCorretor = () => onAssociateCorretor(funilEntry.id, null);
    const formatDate = (dateString) => dateString ? format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A';
    const displayName = contato.razao_social || contato.nome || 'Nome Indisponível';
    const displayPhone = contato.telefones?.[0]?.telefone || contato.telefones?.[0] || 'Sem telefone'; // Proteção extra para telefone
    const handleMoveClick = (columnId) => { onMoveToColumn(funilEntry.id, columnId); setIsDropdownOpen(false); };
    const handleOpenNotes = () => { onOpenNotesModal(funilEntry.id, contato.id); setIsDropdownOpen(false); };
    const handleAddActivityClick = (e) => { e.stopPropagation(); onAddActivity(contato); setIsDropdownOpen(false); };
    const handleCardDragStart = (e) => { e.stopPropagation(); onDragStart(e); };

    // --- NOVO: Função para abrir o WhatsApp ---
    const handleWhatsClick = (e) => {
        e.stopPropagation();
        if (onStartWhatsApp) {
            onStartWhatsApp(funilEntry); // Passa o funilEntry completo ou o contato
        }
    };

    return (
        <div draggable onDragStart={handleCardDragStart} onClick={() => onCardClick(funilEntry)} className="relative bg-white p-3 rounded-md shadow border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition-shadow duration-200 text-left group">
            
            {/* Cabeçalho com Nome e Menu */}
            <div className="flex justify-between items-start mb-2">
                <div className="flex-grow pr-8"> 
                    <p className="font-semibold text-gray-800 text-sm leading-tight">
                        <span className="text-blue-600 font-bold">#{cardNumber}</span> {displayName}
                    </p> 
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <FontAwesomeIcon icon={faPhone} /> {displayPhone}
                    </p>
                </div>
                <div className="absolute top-2 right-3 z-10" ref={dropdownRef}>
                    <button onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }} className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 transition-colors">
                        <FontAwesomeIcon icon={faEllipsisV} size="sm" />
                    </button>
                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
                            <button onClick={handleAddActivityClick} className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"><FontAwesomeIcon icon={faTasks} className="mr-2" /> Adicionar Atividade</button>
                            <button onClick={(e) => { e.stopPropagation(); handleOpenNotes(); }} className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"><FontAwesomeIcon icon={faStickyNote} className="mr-2" /> Ver/Adicionar Notas</button>
                            <div className="border-t border-gray-200 my-1"></div>
                            <button onClick={handleDeleteCardClick} className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"><FontAwesomeIcon icon={faTrash} className="mr-2" /> Excluir Card</button>
                            <div className="border-t border-gray-200 my-1"></div>
                            <p className="px-3 py-2 text-xs text-gray-500 border-b">Mover para:</p>
                            {allColumns.filter(col => col.id !== currentColumnId).map(column => (<button key={column.id} onClick={(e) => { e.stopPropagation(); handleMoveClick(column.id); }} className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">{column.nome}</button>))}
                        </div>
                    )}
                </div>
            </div>

            {/* Unidades de Interesse */}
            <div className="mt-2 space-y-2">
                <label className="flex items-center text-xs text-gray-500 font-medium"><FontAwesomeIcon icon={faHome} className="mr-2" /> Unidades de Interesse:</label>
                {(funilEntry.produtos_interesse || []).length > 0 ? (
                    <ul className="space-y-1">
                        {(funilEntry.produtos_interesse).map(item => (
                            <li key={item.id} className="text-sm flex justify-between items-center group/prod bg-gray-100 p-1.5 rounded">
                                <span>{item.produto.unidade} ({item.produto.tipo})</span>
                                <button onClick={(e) => { e.stopPropagation(); onDissociateProduct(item.id); }} className="text-red-500 hover:text-red-700 opacity-0 group-hover/prod:opacity-100 transition-opacity" title="Remover unidade">
                                    <FontAwesomeIcon icon={faTrash} size="xs" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (<p className="text-xs text-gray-400 px-2">Nenhuma unidade associada.</p>)}

                {!isAddingProduct ? (
                    <button onClick={(e) => { e.stopPropagation(); setIsAddingProduct(true); }} className="w-full text-center text-xs p-1 mt-1 rounded border-2 border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 hover:border-gray-400 transition-colors">
                        <FontAwesomeIcon icon={faPlus} className="mr-1" /> Adicionar Unidade
                    </button>
                ) : (
                    <div className="p-2 bg-gray-50 rounded space-y-2 border border-gray-200" onClick={(e) => e.stopPropagation()}>
                        <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="w-full p-1.5 border border-gray-300 rounded-md text-sm">
                            <option value="">-- Selecione uma unidade --</option>
                            {filteredAvailableProducts.map(product => (
                                <option key={product.id} value={product.id}>{product.unidade} ({product.tipo})</option>
                            ))}
                        </select>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setIsAddingProduct(false)} className="text-xs px-2 py-1 rounded hover:bg-gray-200">Cancelar</button>
                            <button onClick={handleAddProduct} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Adicionar</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Corretor Responsável */}
            <div className="mt-2" ref={corretorDropdownRef}>
                <label className="flex items-center text-xs text-gray-500 font-medium mb-1"><FontAwesomeIcon icon={faUserTie} className="mr-2" /> Corretor Responsável:</label>
                {isEditingCorretor ? (
                    <div className="relative">
                        <input type="text" placeholder="Digite para buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full p-1.5 border border-gray-300 rounded-md text-sm" autoFocus />
                        {isSearching && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />}
                        {searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {searchResults.map(corretor => (<div key={corretor.id} onClick={(e) => { e.stopPropagation(); handleSelectCorretor(corretor.id); }} className="p-2 text-sm hover:bg-gray-100 cursor-pointer">{corretor.nome || corretor.razao_social}</div>))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between p-1.5 border border-transparent rounded-md">
                        <span className="text-sm font-medium text-gray-800">{funilEntry.corretores ? (funilEntry.corretores.nome || funilEntry.corretores.razao_social) : '-- Nenhum --'}</span>
                        <div className='flex items-center gap-2'>
                            {funilEntry.corretor_id && (<button onClick={(e) => { e.stopPropagation(); handleClearCorretor(); }} className="text-xs text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTimes} /></button>)}
                            <button onClick={(e) => { e.stopPropagation(); setIsEditingCorretor(true); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                                {funilEntry.corretor_id ? 'Trocar' : 'Adicionar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Etiquetas de Origem (Meta, Site, etc) */}
            <div className="mt-3 space-y-1">
                {isMetaLead ? (
                    <>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <FontAwesomeIcon icon={faBullhorn} /> Meta Lead
                        </span>
                        <div className="text-xs text-gray-600 mt-2 space-y-1">
                            {campaignName && <p><strong>Campanha:</strong> {campaignName}</p>}
                            {adName && <p><strong>Anúncio:</strong> {adName}</p>}
                        </div>
                    </>
                ) : contato.origem ? (
                     <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                         <FontAwesomeIcon icon={faGlobe} /> {contato.origem}
                    </span>
                ) : null}
            </div>

            {/* Rodapé com Data e Botão WhatsApp */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-400">
                    <p>Criado em: {formatDate(funilEntry.created_at)}</p>
                </div>

                {/* BOTÃO DO WHATSAPP (A novidade!) */}
                <button
                    onClick={handleWhatsClick}
                    className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all shadow-sm transform hover:scale-110"
                    title="Iniciar conversa no WhatsApp"
                >
                    <FontAwesomeIcon icon={faWhatsapp} size="lg" />
                </button>
            </div>
        </div>
    );
}