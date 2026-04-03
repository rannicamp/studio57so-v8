"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileShield, faSpinner, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import ReactMarkdown from 'react-markdown'; // Se tivermos markdown no conteudo das politicas
export default function TermsUpdateEnforcer() {
 const supabase = createClient();
 const [isOpen, setIsOpen] = useState(false);
 const [politicasPendentes, setPoliticasPendentes] = useState([]);
 const [currentIndex, setCurrentIndex] = useState(0);
 const [userData, setUserData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [processing, setProcessing] = useState(false);
 const [temSessao, setTemSessao] = useState(false);

 useEffect(() => {
 async function checkCompliance() {
 setLoading(true);
 try {
 // 1. Pegar usuário logado
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) {
 setTemSessao(false);
 setLoading(false);
 return; // Ignora se não tá logado, o Auth cuidará dele depois.
 }

 setTemSessao(true);

 // 2. Buscar TODAS as políticas PLATAFORMA (Ativas no momento)
 const { data: politicasAtivas, error: polErr } = await supabase
 .from('politicas_plataforma')
 .select('*')
 .eq('is_active', true)
 .order('data_publicacao', { ascending: true });

 if (polErr) throw polErr;

 // Se não existir política lançada no sistema ainda, deixa passar
 if (!politicasAtivas || politicasAtivas.length === 0) {
 setIsOpen(false);
 return;
 }

 // 3. Pegar no banco o Perfil do Cliente com organização atual
 const { data: usuario, error: userErr } = await supabase
 .from('usuarios')
 .select('id, organizacao_id')
 .eq('id', session.user.id)
 .single();

 if (userErr) throw userErr;
 setUserData(usuario);

 // 4. Buscar a matriz de políticas que este usuário já assinou
 const { data: aceites, error: aceitesErr } = await supabase
 .from('usuario_aceite_politicas')
 .select('politica_id')
 .eq('usuario_id', session.user.id);

 if (aceitesErr) throw aceitesErr;

 // 5. A mágica da barreira: Subtração da Matriz (Matemática de Conjuntos)
 // Quais políticas que estão ATIVAS que ELE AINDA NÃO TEM assinatura?
 const assinaturasCompletadasIds = aceites?.map(a => a.politica_id) || [];
 const pendentes = politicasAtivas.filter(p => !assinaturasCompletadasIds.includes(p.id));

 if (pendentes.length > 0) {
 setPoliticasPendentes(pendentes);
 setCurrentIndex(0);
 setIsOpen(true); // OPA! Levanta a barreira (Tem documento pendente na fila)
 } else {
 setIsOpen(false); // Tudo em ordem, usuário já assinou tudo
 }

 } catch (error) {
 console.error("Erro ao verificar compliance:", error);
 } finally {
 setLoading(false);
 }
 }

 checkCompliance();
 }, [supabase]);

 const handleAcceptTerms = async () => {
 const politicaAtual = politicasPendentes[currentIndex];
 if (!politicaAtual || !userData) return;
 setProcessing(true);

 try {
 // Insere o Aceite Específico na nova tabela de Logs Relacionais
 const { error } = await supabase
 .from('usuario_aceite_politicas')
 .insert([{
 usuario_id: userData.id,
 organizacao_id: userData.organizacao_id, // Identificação do Contexto Comercial do Cliente
 politica_id: politicaAtual.id,
 tipo: politicaAtual.tipo,
 versao: politicaAtual.versao
 }]);

 if (error) {
 // Se tentou assinar duplicado por concorrência ou outro erro de constraints
 if (error.code !== '23505') throw error;
 }

 // Sucesso! Avança na fila
 if (currentIndex + 1 < politicasPendentes.length) {
 setCurrentIndex(prev => prev + 1); // Tem mais documento para assinar... Desliza na tela
 } else {
 setIsOpen(false); // Fila ZERADA. Baixa a porta
 }

 } catch (error) {
 console.error("Erro ao assinar termos:", JSON.stringify(error));
 alert(`Não foi possível salvar. Motivo: ${error.message || error.details || JSON.stringify(error)}`);
 } finally {
 setProcessing(false);
 }
 };


 // Renderizações
 const politicaAtiva = politicasPendentes[currentIndex];
 if (!temSessao || loading || !isOpen || !politicaAtiva) return null;

 const filaStatusStr = politicasPendentes.length > 1
 ? ` (Documento ${currentIndex + 1} de ${politicasPendentes.length})`
 : '';

 // A Barreira Visual
 return (
 <div className="fixed inset-0 z-[99999] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4">
 <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">

 {/* Header do Documento */}
 <div className="bg-emerald-600 p-6 flex items-start gap-4 flex-shrink-0">
 <div className="bg-white/20 p-3 rounded-xl">
 <FontAwesomeIcon icon={faFileShield} className="text-3xl text-emerald-50" />
 </div>
 <div>
 <h2 className="text-xl font-bold text-white tracking-wide">Atualização Obrigatória</h2>
 <p className="text-emerald-100 text-sm mt-1">
 {politicaAtiva.titulo || 'Nova Política Legal'} ({politicaAtiva.versao}){filaStatusStr}
 </p>
 </div>
 </div>

 {/* Corpo (Scrollável) */}
 <div className="p-8 overflow-y-auto flex-1 bg-slate-50 text-slate-700">
 <div className="prose prose-sm max-w-none prose-emerald">
 <p className="font-semibold text-slate-900 mb-6 flex justify-between items-center">
 <span>Para continuar utilizando a plataforma, precisamos que você leia e concorde com as regras.{filaStatusStr}</span>
 </p>

 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[300px] whitespace-pre-wrap">
 {/* Renderiza o texto injetado pelo Admin */}
 {politicaAtiva.conteudo || "Carregando o texto da política..."}
 </div>
 </div>
 </div>

 {/* Footer Fixado (Ação) */}
 <div className="p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0">
 <p className="text-xs text-slate-500 max-w-sm">
 Ao clicar em "Li e Aceito", um registro com o selo do seu aceite nesta versão ({politicaAtiva.versao}) será vinculado à sua conta legalmente.
 </p>

 <button
 onClick={handleAcceptTerms}
 disabled={processing}
 className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3 px-8 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-emerald-500/20 shadow-lg"
 >
 {processing ? (
 <><FontAwesomeIcon icon={faSpinner} spin /> Assinando Digitalmente...</>
 ) : (
 <><FontAwesomeIcon icon={faCheckCircle} /> Li e Aceito os Termos</>
 )}
 </button>
 </div>

 </div>
 </div>
 );
}
