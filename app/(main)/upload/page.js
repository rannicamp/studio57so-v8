// app/(main)/upload/page.js
"use client";

import { useAuth } from '@/contexts/AuthContext';
import UploadFotosRdo from '@/components/UploadFotosRdo';

export default function TesteUploadPage() {
  const { user } = useAuth();

  // Se não estiver logado, evita erro, mas tenta mostrar algo
  if (!user) return <div className="p-10 text-center">Carregando usuário...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Ambiente de Teste (Bucket 'teste')</h1>
        
        {/* Carrega o componente sem precisar de RDO ID */}
        <UploadFotosRdo organizacaoId={user.organizacao_id} />
        
        <div className="mt-8 text-center">
             <a href="/painel" className="text-sm text-blue-600 underline">Voltar ao Painel</a>
        </div>
      </div>
    </div>
  );
}