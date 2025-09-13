//components\Tooltip.js
"use client";

// Adicionado o 'useCallback' para otimização
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ children, label, position = 'right' }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ALTERAÇÃO 1: A função de cálculo agora é "memorizada" pelo useCallback
  const updatePosition = useCallback(() => {
    if (triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      let top, left;

      switch (position) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'bottom':
          top = triggerRect.bottom + 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
          left = triggerRect.left - tooltipRect.width - 8;
          break;
        default: // right
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
          left = triggerRect.right + 8;
          break;
      }
      setCoords({ top: top, left: left });
    }
  }, [position]); // A função só será recriada se a 'position' mudar

  // ALTERAÇÃO 2: Trocamos o 'setTimeout' por este 'useEffect' inteligente
  useEffect(() => {
    if (visible) {
      // Ele espera o balão ser renderizado e SÓ ENTÃO calcula a posição
      updatePosition();
    }
  }, [visible, updatePosition]); // Ele roda sempre que o balão fica visível

  // ALTERAÇÃO 3: Simplificamos a função de mostrar, removendo o setTimeout
  const showTooltip = () => {
    setVisible(true);
  };

  const hideTooltip = () => {
    setVisible(false);
  };
  
  const TooltipPortal = ({ children }) => {
    if (!isMounted) return null;
    return createPortal(children, document.body);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>
      {visible && (
        <TooltipPortal>
          <div
            ref={tooltipRef}
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
            className="fixed w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md z-[9999]"
          >
            {label}
          </div>
        </TooltipPortal>
      )}
    </>
  );
}