import React from 'react';

const SparklesIcon = ({ className = "w-5 h-5", active = true, colorOverride = null }) => {
  const defaultColor = active ? "#F97316" : "#cbd5e1";
  const fillColor = colorOverride || defaultColor;

  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* Estrela Maior */}
      <path 
        d="M10 4C10 8.41828 13.5817 12 18 12C13.5817 12 10 15.5817 10 20C10 15.5817 6.41828 12 2 12C6.41828 12 10 8.41828 10 4Z" 
        fill={fillColor} 
      />
      {/* Estrela Menor */}
      <path 
        d="M18 2C18 4.20914 19.7909 6 22 6C19.7909 6 18 7.7909 18 10C18 7.7909 16.2091 6 14 6C16.2091 6 18 4.20914 18 2Z" 
        fill={fillColor} 
      />
    </svg>
  );
};

export default SparklesIcon;
