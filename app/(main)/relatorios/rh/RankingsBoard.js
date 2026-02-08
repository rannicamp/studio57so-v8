"use client";

import RankingAtrasos from './RankingAtrasos';
import RankingFaltas from './RankingFaltas';

export default function RankingsBoard({ mesRef }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6 mt-6 w-full animate-in fade-in duration-700">
      {/* A arquitetura agora é modular. 
          Se quiser adicionar "Ranking de Horas Extras", basta criar o arquivo
          RankingHorasExtras.js e importar aqui.
      */}
      
      <RankingAtrasos mesRef={mesRef} />
      
      <RankingFaltas mesRef={mesRef} />
      
    </div>
  );
}