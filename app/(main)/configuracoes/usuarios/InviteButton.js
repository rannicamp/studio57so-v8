'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import InviteUserModal from '@/components/configuracoes/usuarios/InviteUserModal';

// NOTA: Mudamos para 'export function' (sem default) para evitar o erro "got: object"
export function InviteButton({ roles }) {
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const router = useRouter();

    return (
        <>
            <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
            >
                <FontAwesomeIcon icon={faPaperPlane} />
                Convidar Usuário
            </button>

            <InviteUserModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                cargos={roles} 
                onSuccess={() => {
                    router.refresh(); 
                }}
            />
        </>
    );
}