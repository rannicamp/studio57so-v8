// Caminho do ficheiro: components/crm/FunilManager.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUserCircle, faPlus, faGripVertical, faTimes } from '@fortawesome/free-solid-svg-icons';
import ContatoForm from '@/components/crm/ContatoForm';
import styles from '@/styles/crm/FunilManager.module.css';

// Este é o componente da janela (Modal) que agora vive dentro deste ficheiro
// para seguir o padrão do seu projeto e evitar erros.
const ModalInterno = ({ isOpen, onClose, children, title }) => {
    if (!isOpen) {
      return null;
    }
  
    return (
      <div className={styles.modalBackdrop} onClick={onClose}>
        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
          <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{title}</h2>
              <button className={styles.closeButton} onClick={onClose}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
          </div>
          <div className={styles.modalBody}>
              {children}
          </div>
        </div>
      </div>
    );
};


export default function FunilManager() {
    const [colunas, setColunas] = useState([]);
    const [contatos, setContatos] = useState({});
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedContato, setSelectedContato] = useState(null);

    // Estados para o drag and drop (arrastar e soltar)
    const [draggedItem, setDraggedItem] = useState(null);
    const [draggedOverColumn, setDraggedOverColumn] = useState(null);

    const fetchDados = useCallback(async () => {
        setLoading(true);
        try {
            // Busca as colunas do funil (os status)
            const { data: statusData, error: statusError } = await supabase
                .from('crm_status')
                .select('*')
                .order('ordem', { ascending: true });

            if (statusError) throw statusError;
            setColunas(statusData);

            // Busca os contatos e os dados do seu responsável
            const { data: contatosData, error: contatosError } = await supabase
                .from('crm_contatos')
                .select(`*, responsavel:id_responsavel (id_usuario, nome_usuario)`);

            if (contatosError) throw contatosError;

            // Organiza os contatos em suas respectivas colunas
            const contatosPorColuna = statusData.reduce((acc, coluna) => {
                acc[coluna.cod_status] = contatosData.filter(c => c.cod_status === coluna.cod_status);
                return acc;
            }, {});

            setContatos(contatosPorColuna);
        } catch (error) {
            console.error('Erro ao buscar dados do funil:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDados();
    }, [fetchDados]);

    // Função chamada quando um novo contato é criado com sucesso
    const handleContatoCriado = () => {
        fetchDados(); // Atualiza os dados na tela
        setIsFormModalOpen(false); // Fecha a janela do formulário
    };
    
    // Funções para a janela de detalhes do contato
    const openContatoDetalhes = (contato) => setSelectedContato(contato);
    const closeContatoDetalhes = () => setSelectedContato(null);

    // Funções para controlar o "arrastar e soltar"
    const handleDragStart = (e, item, codStatusOrigem) => {
        setDraggedItem({ ...item, codStatusOrigem });
        // Adiciona um efeito visual ao cartão que está a ser arrastado
        setTimeout(() => {
           if(e.target.closest(`.${styles.card}`)) {
              e.target.closest(`.${styles.card}`).classList.add(styles.dragging);
           }
        }, 0);
    };

    const handleDragEnd = (e) => {
        // Remove o efeito visual do cartão
        if(e.target.closest(`.${styles.card}`)) {
            e.target.closest(`.${styles.card}`).classList.remove(styles.dragging);
        }
        setDraggedItem(null);
        setDraggedOverColumn(null);
    };

    const handleDragOver = (e, codStatusDestino) => {
        e.preventDefault();
        // Adiciona um efeito visual na coluna de destino
        if (draggedOverColumn !== codStatusDestino) {
            setDraggedOverColumn(codStatusDestino);
        }
    };
    
    const handleDragLeave = () => setDraggedOverColumn(null);

    const handleDrop = async (e, codStatusDestino) => {
        e.preventDefault();
        setDraggedOverColumn(null);
        if (!draggedItem || draggedItem.codStatusOrigem === codStatusDestino) return;

        const { id, codStatusOrigem } = draggedItem;
        const contatosOrigemOriginal = contatos[codStatusOrigem];
        const contatosDestinoOriginal = contatos[codStatusDestino];
        const itemMovido = contatosOrigemOriginal.find(c => c.id === id);

        // 1. Atualiza a tela imediatamente (UI Otimista)
        const novosContatosOrigem = contatosOrigemOriginal.filter(c => c.id !== id);
        const novosContatosDestino = [...contatosDestinoOriginal, { ...itemMovido, cod_status: codStatusDestino }];
        
        setContatos(prev => ({
            ...prev,
            [codStatusOrigem]: novosContatosOrigem,
            [codStatusDestino]: novosContatosDestino,
        }));
        
        // 2. Tenta guardar a alteração no banco de dados
        const { error } = await supabase.from('crm_contatos').update({ cod_status: codStatusDestino }).match({ id });

        // 3. Se der erro no banco de dados, desfaz a alteração na tela
        if (error) {
            console.error('Erro ao mover contato:', error);
            setContatos(prev => ({ ...prev, [codStatusOrigem]: contatosOrigemOriginal, [codStatusDestino]: contatosDestinoOriginal }));
        }
    };

    if (loading) {
        return <div className={styles.loadingContainer}><FontAwesomeIcon icon={faSpinner} spin size="3x" /></div>;
    }

    return (
        <div className={styles.funilContainer}>
            <div className={styles.header}>
                <h1>Funil de Vendas</h1>
                <button onClick={() => setIsFormModalOpen(true)} className={styles.addButton}>
                    <FontAwesomeIcon icon={faPlus} /> Novo Contato
                </button>
            </div>

            {/* Janela para criar novo contato */}
            <ModalInterno isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title="Criar Novo Contato">
                <ContatoForm onContatoCriado={handleContatoCriado} />
            </ModalInterno>
            
            {/* Janela para ver detalhes do contato */}
            {selectedContato && (
                 <ModalInterno isOpen={true} onClose={closeContatoDetalhes} title="Detalhes do Contato">
                    <p><strong>Nome:</strong> {selectedContato.nome}</p>
                    <p><strong>Email:</strong> {selectedContato.email}</p>
                    <p><strong>Telefone:</strong> {selectedContato.telefone}</p>
                    <p><strong>Empresa:</strong> {selectedContato.empresa}</p>
                    <p><strong>Responsável:</strong> {selectedContato.responsavel?.nome_usuario || 'Não atribuído'}</p>
                </ModalInterno>
            )}

            {/* A grelha do Kanban */}
            <div className={styles.funilGrid}>
                {colunas.map(coluna => (
                    <div
                        key={coluna.cod_status}
                        className={`${styles.coluna} ${draggedOverColumn === coluna.cod_status ? styles.dragOver : ''}`}
                        onDragOver={(e) => handleDragOver(e, coluna.cod_status)}
                        onDrop={(e) => handleDrop(e, coluna.cod_status)}
                        onDragLeave={handleDragLeave}
                    >
                        <h3 className={styles.colunaTitulo}>{coluna.nome_status} ({contatos[coluna.cod_status]?.length || 0})</h3>
                        <div className={styles.cardContainer}>
                            {(contatos[coluna.cod_status] || []).map(contato => (
                                <div
                                    key={contato.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, contato, coluna.cod_status)}
                                    onDragEnd={handleDragEnd}
                                    className={styles.card}
                                    onClick={() => openContatoDetalhes(contato)}
                                >
                                    <div className={styles.dragHandle}>
                                        <FontAwesomeIcon icon={faGripVertical} />
                                    </div>
                                    <div className={styles.cardContent}>
                                        <h4>{contato.nome}</h4>
                                        <p>{contato.empresa}</p>
                                        <div className={styles.cardFooter}>
                                             <FontAwesomeIcon icon={faUserCircle} title={contato.responsavel?.nome_usuario || 'Não atribuído'} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}