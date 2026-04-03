// app/(main)/configuracoes/indices/page.js
'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect } from 'react'
import { useLayout } from '@/contexts/LayoutContext'
import IndicesManager from '@/components/configuracoes/IndicesManager'

export default function IndicesPage() {
 const { setPageTitle } = useLayout()

 useEffect(() => {
 if (setPageTitle) {
 setPageTitle('Gestão de Índices Financeiros')
 }
 }, [setPageTitle])

 return (
 <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
 <IndicesManager />
 </div>
 )
}
