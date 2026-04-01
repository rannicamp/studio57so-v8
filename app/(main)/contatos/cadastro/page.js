//app\(main)\contatos\cadastro\page.js
"use client"; // Necessário para usar o hook useEffect

import { useEffect } from 'react';
import ContatoForm from '../../../../components/contatos/ContatoForm';
import Link from 'next/link';
import { useLayout } from '../../../../contexts/LayoutContext'; // Importar

export default function CadastroContatoPage() {
  const { setPageTitle } = useLayout(); // Usar o hook

  useEffect(() => {
    setPageTitle('Cadastro de Novo Contato'); // Define o título no Header
  }, [setPageTitle]);

  return (
    <div className="space-y-6">
      {/* O título <h1> foi removido daqui */}
      <div className="bg-white rounded-lg shadow p-6">
        <ContatoForm />
      </div>
    </div>
  );
}