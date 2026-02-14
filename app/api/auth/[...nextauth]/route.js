// app/api/auth/[...nextauth]/route.js

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE (ADMIN) ---
// Usamos a chave de serviço (ou a anon se a service não estiver disponível) 
// para garantir que conseguimos gravar o token independente de permissão de tela.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// --- FUNÇÃO AUXILIAR: SALVAR NO BANCO ---
async function saveMetaTokenToDatabase(userId, tokens) {
  try {
    // 1. Descobrir a organização do usuário
    const { data: userLink, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('organizacao_id')
      .eq('id', userId) // Assumindo que o ID do NextAuth bate com o ID do usuário no seu banco
      .single();

    if (userError || !userLink) {
      console.error("Erro: Usuário sem organização vinculada.", userError);
      return;
    }

    // 2. Salvar/Atualizar na tabela SaaS
    const { error: upsertError } = await supabaseAdmin
      .from('integracoes_meta')
      .upsert({
        organizacao_id: userLink.organizacao_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null, // Facebook nem sempre manda refresh token
        token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organizacao_id' });

    if (upsertError) {
      console.error("Erro ao salvar token Meta no banco:", upsertError);
    } else {
      console.log("✅ Token Meta salvo com sucesso para Org:", userLink.organizacao_id);
    }

  } catch (error) {
    console.error("Erro crítico ao salvar token:", error);
  }
}

// --- RENOVAÇÃO DE TOKEN ---
async function refreshAccessToken(token) {
  try {
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${token.accessToken}`;
    
    const response = await fetch(url);
    const refreshedTokens = await response.json();

    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, 
    };
  } catch (error) {
    console.error("Erro ao atualizar token Facebook", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

// --- CONFIGURAÇÃO PRINCIPAL ---
export const authOptions = {
  strategy: 'jwt',
  // Removemos a configuração manual de cookies para evitar quebra entre domínios (elo57.com.br vs studio57)
  // O NextAuth gerencia isso automaticamente baseado na variável NEXTAUTH_URL
  
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        },
      },
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      authorization: {
        params: {
          // Escopos essenciais para Marketing e Leads
          scope: 'email,public_profile,leads_retrieval,ads_read,ads_management,pages_show_list,pages_manage_ads,pages_read_engagement,read_insights',
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // 1. JWT Callback: Acontece logo após o login ou quando a sessão é acessada
    async jwt({ token, account, user }) {
      
      // LOGIN INICIAL (Ou reconexão)
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = Date.now() + (account.expires_in || 3600) * 1000;
        token.provider = account.provider;
        
        // MÁGICA DO DEVONILDO: Se for Facebook, salva no banco para uso backend!
        if (account.provider === 'facebook') {
            // O 'user.id' do NextAuth geralmente mapeia para o ID da tabela users se configurado via adapter,
            // ou precisamos garantir que o email bata. 
            // NOTA: Para funcionar perfeito, o token.sub deve ser o UUID do usuário no Supabase.
            // Se você usa Supabase Auth separado do NextAuth, precisaremos ajustar como pegamos o ID.
            // Assumindo aqui que token.sub = ID do Usuário Logado.
            await saveMetaTokenToDatabase(token.sub, account); 
        }
        
        return token;
      }

      // Se o token ainda é válido, retorna ele
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Se expirou, tenta renovar
      if (token.provider === 'facebook') {
          console.log("Token Facebook expirado, renovando...");
          const newToken = await refreshAccessToken(token);
          
          // Se renovou com sucesso, atualiza no banco também!
          if (!newToken.error) {
             await saveMetaTokenToDatabase(token.sub, {
                 access_token: newToken.accessToken,
                 refresh_token: newToken.refreshToken,
                 expires_in: (newToken.accessTokenExpires - Date.now()) / 1000
             });
          }
          return newToken;
      }

      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.provider = token.provider;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };