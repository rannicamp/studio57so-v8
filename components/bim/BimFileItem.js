'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheckSquare, faSquare, faClock, faEllipsisV, faCloudUploadAlt, 
  faPen, faDatabase, faTrash, faCog, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

const BimFileItem = React.memo(({ file, isActive, isSelected, onFileSelect, onToggleModel, onAction }) => {
  const supabase = createClientComponentClient();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [localStatus, setLocalStatus] = useState(file.status || 'Processando');
  const [progressText, setProgressText] = useState('');
  const menuRef = useRef(null);

  // Compatibilidade de status de tradução
  const isProcessing = localStatus === 'Processando' || localStatus === 'processing' || localStatus === 'Processando_Autodesk';
  const isError = localStatus === 'Erro';

  // Fecha o menu flutuante ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Polling para Tradução Autodesk
  useEffect(() => {
    let intervalId;
    if (isProcessing && file.urn_autodesk) {
      const checkTranslationStatus = async () => {
        try {
          const rawUrn = file.urn_autodesk.replace(/^urn:/, '');
          const res = await fetch('/api/aps/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urn: rawUrn })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
              setLocalStatus('Concluido');
              await supabase.from('projetos_bim').update({ status: 'Concluido' }).eq('id', file.id);

              // Catalogar pranchas 2D e vistas 3D em background (BIM 2.0)
              fetch('/api/aps/vistas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  urn: file.urn_autodesk,
                  projetoBimId: file.id,
                  organizacaoId: file.organizacao_id
                })
              }).then(vRes => vRes.json()).then(vData => {
                if (vData.success) {
                  console.log('[BIM Vistas] Catalogadas com sucesso:', vData.message);
                } else {
                  console.warn('[BIM Vistas] Falha ao catalogar:', vData.error || vData.message);
                }
              }).catch(vErr => {
                console.warn('[BIM Vistas] Erro na requisição:', vErr);
              });

            } else if (data.status === 'failed' || data.status === 'timeout') {
              setLocalStatus('Erro');
              await supabase.from('projetos_bim').update({ status: 'Erro' }).eq('id', file.id);
            } else {
              setProgressText(data.progress ? `PROGRESSO: ${data.progress}` : 'TRADUZINDO...');
            }
          } else if (res.status === 404) {
            setProgressText('INICIANDO...');
          }
        } catch (err) {
          console.error('Erro no polling BIM:', err);
        }
      };

      checkTranslationStatus();
      intervalId = setInterval(checkTranslationStatus, 7000);
    }

    return () => { if (intervalId) clearInterval(intervalId); }
  }, [isProcessing, file.urn_autodesk, file.id, file.organizacao_id, supabase]);

  const handleMenuAction = (e, type) => {
    e.stopPropagation();
    e.preventDefault();
    setIsMenuOpen(false);
    onAction(type, file);
  };

  return (
    <div 
      onClick={(e) => { 
        if (isMenuOpen) return;
        e.stopPropagation(); 
        if (!isProcessing && !isError) onFileSelect(file); 
      }} 
      className={`group relative p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3
        ${isActive 
          ? 'border-l-4 border-l-blue-600 border-blue-200 bg-blue-50/20 shadow-sm' 
          : isSelected 
            ? 'border-l-4 border-l-blue-400 border-gray-200 bg-white shadow-sm' 
            : 'border-l-4 border-l-transparent border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm'
        } 
        ${isProcessing ? 'opacity-80 cursor-wait' : 'hover:scale-[1.01]'}
        ${isMenuOpen ? 'z-40 ring-2 ring-blue-100' : 'z-10'}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Checkbox de Federação */}
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (!isProcessing && !isError) onToggleModel(file); 
          }} 
          className={`p-1 transition-colors flex items-center justify-center shrink-0 
            ${isActive ? 'text-blue-600' : isSelected ? 'text-blue-500' : 'text-gray-300 hover:text-blue-500'}`}
          disabled={isProcessing || isError}
        >
          {isProcessing ? (
            <FontAwesomeIcon icon={faCog} spin className="text-blue-500 text-[10px]" />
          ) : isError ? (
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 text-[10px]" />
          ) : (
            <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} className="text-[12px]" />
          )}
        </button>

        {/* Informações do Arquivo */}
        <div className="min-w-0 flex-1">
          <p 
            className={`text-[11px] font-bold truncate leading-tight 
              ${isActive ? 'text-blue-900 font-extrabold' : 'text-gray-700 font-semibold'}`}
            title={file.nome_arquivo}
          >
            {file.nome_arquivo}
          </p>
          
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {/* Badge da Disciplina */}
            <span 
              className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border 
                ${isActive 
                  ? 'bg-blue-100 text-blue-800 border-blue-200' 
                  : 'bg-gray-100 text-gray-500 border-gray-200'}`}
            >
              {file.disciplina_sigla}
            </span>
            {/* Nome do Empreendimento */}
            <span 
              className="text-[9px] text-gray-400 font-bold truncate max-w-[100px]" 
              title={file.empreendimento_nome}
            >
              {file.empreendimento_nome}
            </span>
            {/* Versão e Data */}
            <span className="text-[8px] text-gray-400 font-semibold">
              v{file.versao} • {new Date(file.criado_em).toLocaleDateString('pt-BR')}
            </span>
          </div>

          {/* Progresso de Tradução */}
          {isProcessing && (
            <p className="text-[8px] text-blue-500 font-extrabold uppercase mt-1 flex items-center gap-1">
              <FontAwesomeIcon icon={faCog} spin />
              {progressText || 'PROCESSANDO...'}
            </p>
          )}
        </div>
      </div>

      {/* Menu de Contexto Flutuante */}
      {!isProcessing && !isError && (
        <div className="relative shrink-0" ref={menuRef}>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setIsMenuOpen(!isMenuOpen); 
            }} 
            className={`p-1 px-2 rounded hover:bg-black/5 transition-all text-gray-400 hover:text-gray-600`}
          >
            <FontAwesomeIcon icon={faEllipsisV} className="text-[9px]" />
          </button>

          {isMenuOpen && (
            <div 
              className="absolute right-0 top-6 w-40 bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 origin-top-right"
              style={{ zIndex: 9999 }}
            >
              <div className="px-3 py-1.5 border-b border-gray-50 bg-gray-50/50">
                <p className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider">Ações</p>
              </div>
              <button 
                onClick={(e) => handleMenuAction(e, 'version')} 
                className="w-full text-left px-3.5 py-2 text-[10px] font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors"
              >
                <FontAwesomeIcon icon={faCloudUploadAlt} className="w-3 text-blue-400" /> Atualizar Versão
              </button>
              <button 
                onClick={(e) => handleMenuAction(e, 'edit')} 
                className="w-full text-left px-3.5 py-2 text-[10px] font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors"
              >
                <FontAwesomeIcon icon={faPen} className="w-3 text-blue-400" /> Editar / Mover
              </button>
              <button 
                onClick={(e) => handleMenuAction(e, 'sync')} 
                className="w-full text-left px-3.5 py-2 text-[10px] font-black text-blue-700 bg-blue-50/50 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors border-y border-blue-50"
              >
                <FontAwesomeIcon icon={faDatabase} className="w-3" /> Sincronizar DB
              </button>
              <button 
                onClick={(e) => handleMenuAction(e, 'trash')} 
                className="w-full text-left px-3.5 py-2 text-[10px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
              >
                <FontAwesomeIcon icon={faTrash} className="w-3 text-red-400" /> Excluir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

BimFileItem.displayName = 'BimFileItem';
export default BimFileItem;