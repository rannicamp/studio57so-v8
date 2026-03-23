'use client';

import { useLayout } from '@/contexts/LayoutContext';
import { useEffect } from 'react';
import TutoriaisManager from '@/components/tutoriais/TutoriaisManager';

export default function TutoriaisPage() {
    const { setPageTitle } = useLayout();

    useEffect(() => {
        setPageTitle('Manuais e Tutoriais');
    }, [setPageTitle]);

    return (
        <div className="w-full p-4 md:p-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <TutoriaisManager />
        </div>
    );
}
