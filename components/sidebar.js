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
    { href: '/rdo', label: 'Diário de Obra (RDO)' },
  ];

  // IMPORTANTE: Troque o valor de "src" pela URL pública do seu logo no Supabase
  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";

  return (
    <aside className="bg-white shadow-lg w-[260px] h-full fixed left-0 top-0 z-20">
      <div className="p-6 flex items-center justify-center">
        {/* A tag h1 foi substituída por uma imagem */}
        <Link href="/">
          <img src={logoUrl} alt="Logo Studio 57" className="h-12 w-auto" />
        </Link>
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