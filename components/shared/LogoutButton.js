"use client";

import { createClient } from '@/utils/supabase/client'; // Caminho corrigido com @
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

export default function LogoutButton() {
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 transition-colors rounded-md hover:bg-red-50 hover:text-red-700 w-full"
    >
      <FontAwesomeIcon icon={faSignOutAlt} className="w-5 h-5" />
      <span>Sair</span>
    </button>
  );
}