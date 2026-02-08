// app/(main)/upload/page.js
"use client";

import UploadFotosRdo from '@/components/rdo/UploadFotosRdo';
import Link from 'next/link';

export default function PaginaUploadSimples() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-md mx-auto">
        
        <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-800">
                Upload de Arquivos
            </h1>
            <p className="text-sm text-gray-500">Sistema de Teste</p>
        </div>

        {/* Carrega o componente sem passar nenhum parâmetro */}
        <UploadFotosRdo />

        <div className="mt-8 text-center">
             <Link href="/painel" className="text-sm text-blue-600 underline">
                Voltar ao Painel
             </Link>
        </div>

      </div>
    </div>
  );
}