// components/crm/FunilManager.js

'use client';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { supabase } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUserCircle, faPlus, faGripVertical } from '@fortawesome/free-solid-svg-icons';

const FunilManager = ({ empreendimentoId }) => {
  const [colunas, setColunas] = useState([]);
  const [contatos, setContatos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (empreendimentoId) {
      fetchData();
    }
  }, [empreendimentoId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Buscar funil do empreendimento
      const { data: funilData, error: funilError } = await supabase
        .from('funis')
        .select('id')
        .eq('empreendimento_id', empreendimentoId)
        .single();

      if (funilError || !funilData) {
        throw new Error('Funil não encontrado para este empreendimento.');
      }

      const funilId = funilData.id;

      // Buscar colunas do funil
      const { data: colunasData, error: colunasError } = await supabase
        .from('colunas_funil')
        .select('*')
        .eq('funil_id', funilId)
        .order('ordem', { ascending: true });

      if (colunasError) throw colunasError;
      setColunas(colunasData);

      // Buscar contatos no funil
      const { data: contatosData, error: contatosError } = await supabase
        .from('contatos_no_funil')
        .select(`
          *,
          contatos:contato_id (
            id,
            nome,
            foto_url
          )
        `)
        .in('coluna_id', colunasData.map(c => c.id));

      if (contatosError) throw contatosError;

      const contatosPorColuna = colunasData.reduce((acc, coluna) => {
        acc[coluna.id] = contatosData
          .filter(c => c.coluna_id === coluna.id)
          .map(c => c.contatos);
        return acc;
      }, {});

      setContatos(contatosPorColuna);

    } catch (err) {
      console.error('Erro ao buscar dados do funil:', err);
      setError('Falha ao carregar o funil. Verifique se existe um funil cadastrado para este empreendimento.');
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      return;
    }

    const startColumnId = source.droppableId;
    const endColumnId = destination.droppableId;

    const contatoId = parseInt(draggableId.split('-')[1]);

    // Reorganizando na mesma coluna
    if (startColumnId === endColumnId) {
        // Lógica de reordenação local se necessário, por enquanto não faremos nada no DB
    } else {
        // Movendo para uma nova coluna
        const newContatos = { ...contatos };
        const [movedContato] = newContatos[startColumnId].splice(source.index, 1);
        if (!newContatos[endColumnId]) {
            newContatos[endColumnId] = [];
        }
        newContatos[endColumnId].splice(destination.index, 0, movedContato);
        setContatos(newContatos);

        try {
            const { error: updateError } = await supabase
                .from('contatos_no_funil')
                .update({ coluna_id: endColumnId, updated_at: new Date().toISOString() })
                .eq('contato_id', contatoId);

            if (updateError) {
                // Reverter o estado se a atualização falhar
                const revertedContatos = { ...contatos };
                const [revertedContato] = revertedContatos[endColumnId].splice(destination.index, 1);
                revertedContatos[startColumnId].splice(source.index, 0, revertedContato);
                setContatos(revertedContatos);
                alert('Falha ao mover o contato. Tente novamente.');
                console.error('Erro ao atualizar coluna do contato:', updateError);
            }
        } catch (err) {
            console.error('Erro na operação de arrastar e soltar:', err);
            alert('Um erro inesperado ocorreu.');
        }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-100 text-red-700 rounded-lg">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex space-x-4 p-4 overflow-x-auto bg-gray-100 min-h-screen">
        {colunas.map((coluna) => (
          <Droppable key={coluna.id} droppableId={coluna.id.toString()}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`bg-gray-200 rounded-lg p-3 w-80 flex-shrink-0 shadow ${snapshot.isDraggingOver ? 'bg-blue-100' : ''}`}
              >
                <h2 className="font-bold text-lg mb-4 text-gray-800 flex justify-between items-center">
                  {coluna.nome}
                  <button className="text-gray-500 hover:text-blue-600">
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </h2>
                <div className="space-y-3 min-h-[200px]">
                  {(contatos[coluna.id] || []).map((contato, index) => (
                    <Draggable key={`contato-${contato.id}`} draggableId={`contato-${contato.id}`} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`bg-white rounded-md p-4 shadow-sm border flex items-center space-x-3 ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}`}
                        >
                          <FontAwesomeIcon icon={faGripVertical} className="text-gray-400 cursor-grab" />
                          {contato.foto_url ? (
                            <img src={contato.foto_url} alt={contato.nome} className="w-10 h-10 rounded-full" />
                          ) : (
                            <FontAwesomeIcon icon={faUserCircle} className="w-10 h-10 text-gray-400" />
                          )}
                          <span className="font-medium text-gray-700">{contato.nome}</span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
};

export default FunilManager;