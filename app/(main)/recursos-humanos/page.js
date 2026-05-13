"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import RHManager from '../../../components/rh/RHManager';

export default function RecursosHumanosPage() {
 const { hasPermission, loading: authLoading } = useAuth();
 const router = useRouter();

 const canView = hasPermission('recursos_humanos', 'pode_ver') || hasPermission('funcionarios', 'pode_ver');

 useEffect(() => {
 if (!authLoading && !canView) {
 router.push('/');
 }
 }, [authLoading, canView, router]);

 if (authLoading || !canView) return null;

 return (
 <div className="h-full bg-gray-50 flex flex-col">
 <RHManager />
 </div>
 );
}