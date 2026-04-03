// app/(main)/configuracoes/politicas/page.js
'use client'

import { useState, useEffect } from 'react'
import { getActivePlatformPolicies, getMyAcceptanceHistory } from './actions'
import PoliticasPublicas from '@/components/compliance/PoliticasPublicas'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

export default function PoliticasPage() {
 const [politicas, setPoliticas] = useState([])
 const [historico, setHistorico] = useState([])
 const [isLoading, setIsLoading] = useState(true)

 useEffect(() => {
 async function loadData() {
 setIsLoading(true)
 try {
 const [politicasData, historyData] = await Promise.all([
 getActivePlatformPolicies(),
 getMyAcceptanceHistory()
 ])

 setPoliticas(politicasData || [])
 setHistorico(historyData || [])
 } catch (error) {
 console.error("Erro ao carregar políticas:", error)
 } finally {
 setIsLoading(false)
 }
 }
 loadData()
 }, [])

 if (isLoading) {
 return (
 <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-500">
 <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-emerald-600" />
 <p className="animate-pulse">Sincronizando documentação legal...</p>
 </div>
 )
 }

 return (
 <div className="py-2">
 <PoliticasPublicas
 politicas={politicas}
 historico={historico}
 showHistory={true}
 />
 </div>
 )
}