// Caminho: relatorios/radar/actions.js
'use server';

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function getRadarStats(periodo = 30, somenteMarketing = true) {
 try {
 // 1. Correção Next.js 15: cookies() agora é uma promessa e precisa de await
 const cookieStore = await cookies();

 // 2. Correção do Erro Fatal: O createClient também retorna uma promessa!
 // Sem o 'await' aqui, a variável 'supabase' vira uma Promessa pendente,
 // e promessas não têm a função .rpc(). Por isso dava o erro.
 const supabase = await createClient(cookieStore);

 // Agora sim, 'supabase' é o cliente real e tem o método .rpc
 const { data, error } = await supabase
 .rpc('get_radar_stats', { dias_atras: periodo, somente_marketing: somenteMarketing });

 if (error) {
 console.error('❌ Erro no RPC Radar (Supabase):', error.message);
 return null; }

 return data;

 } catch (err) {
 console.error('❌ Erro fatal ao buscar estatísticas (Actions):', err);
 return null;
 }
}

export async function resolveMetaIds(idsArray) {
   if (!idsArray || idsArray.length === 0) return {};
   
   try {
      const cookieStore = await cookies();
      const supabase = await createClient(cookieStore);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      // Pega organização
      const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
      if (!userData?.organizacao_id) return {};

      // Pega token do meta
      const { data: integracao } = await supabase.from('integracoes_meta')
         .select('access_token').eq('organizacao_id', userData.organizacao_id).single();
      
      if (!integracao?.access_token) return {};

      // Busca por lote na Graph API
      const idsParam = idsArray.join(',');
      const faceUrl = `https://graph.facebook.com/v19.0/?ids=${idsParam}&fields=name,campaign{name},adset{name}&access_token=${integracao.access_token}`;
      
      const resposta = await fetch(faceUrl);
      const dados = await resposta.json();
      
      const resultados = {};
      for (const id in dados) {
         if (dados[id] && dados[id].name) {
             resultados[id] = dados[id].name;
         }
      }
      return resultados;
   } catch (error) {
      console.error('Erro na resolução de IDs em lote:', error);
      return {};
   }
}

export async function getDicionarioContatos() {
   try {
      const cookieStore = await cookies();
      const supabase = await createClient(cookieStore);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
      if (!userData?.organizacao_id) return {};

      // Busca todos os contatos que tem meta_ad_id ou meta_adset_id preenchidos (dicionário massivo)
      const { data, error } = await supabase
         .from('contatos')
         .select('meta_ad_id, meta_ad_name, meta_adset_id, meta_adset_name, meta_campaign_id, meta_campaign_name')
         .eq('organizacao_id', userData.organizacao_id)
         .not('meta_ad_id', 'is', null);

      if (error) {
         console.error('Erro ao buscar dicionário contatos:', error);
         return {};
      }

      const dictMapeado = {};
      if (data) {
         data.forEach(c => {
            if (c.meta_ad_id && c.meta_ad_name) dictMapeado[c.meta_ad_id] = c.meta_ad_name;
            if (c.meta_adset_id && c.meta_adset_name) dictMapeado[c.meta_adset_id] = c.meta_adset_name;
            if (c.meta_campaign_id && c.meta_campaign_name) dictMapeado[c.meta_campaign_id] = c.meta_campaign_name;
         });
      }
      return dictMapeado;

   } catch (error) {
      console.error('Erro no dicionario de contatos:', error);
      return {};
   }
}