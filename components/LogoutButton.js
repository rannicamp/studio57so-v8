"use client";

import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button onClick={handleLogout} style={{ marginLeft: '10px', cursor: 'pointer', background: 'orangered', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>
      Sair
    </button>
  );
}