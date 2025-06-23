// rannicamp/teste-netlify/teste-netlify-1f74408eafb3943aeb9eb92a02aecae60eaac333/components/sidebar.js
"use client";

import Link from 'next/link';

const Sidebar = () => {
  // Array com os itens e os links corrigidos
  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/empresas/cadastro', label: 'Cadastro de Empresa' },
    { href: '/empreendimentos/cadastro', label: 'Cadastro de Empreendimento' },
    { href: '/funcionarios/cadastro', label: 'Cadastro de Funcionário' },
    { href: '/atividades', label: 'Painel de Atividades' },
    { href: '/rdo', label: 'Diário de Obra (RDO)' }, // NOVO LINK AQUI
  ];

  return (
    <aside className="bg-white shadow-lg w-[260px] h-full fixed left-0 top-0 z-20">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Studio 57</h1>
      </div>
      <nav>
        <ul>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center p-4 pl-6 text-gray-700 hover:bg-gray-100">
                <span className="text-base font-medium">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;