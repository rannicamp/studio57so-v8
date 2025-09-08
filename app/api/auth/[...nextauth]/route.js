import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';

// ##### INÍCIO DA NOVA LÓGICA #####
// Esta função é responsável por renovar o passe de acesso com o Facebook
async function refreshAccessToken(token) {
  try {
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${token.accessToken}`;
    
    const response = await fetch(url);
    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      // O Facebook não retorna um refresh token novo, então mantemos o original
      refreshToken: token.refreshToken, 
    };
  } catch (error) {
    console.error("Erro ao atualizar o token de acesso do Facebook", error);

    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}
// ##### FIM DA NOVA LÓGICA #####

export const authOptions = {
  strategy: 'jwt',
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
          scope: 'email,pages_show_list,leads_retrieval,pages_manage_ads,business_management,pages_read_engagement,instagram_manage_messages,pages_messaging,ads_read,read_insights',
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/',
    error: '/',
  },
  callbacks: {
    // ##### LÓGICA DO JWT ATUALIZADA #####
    async jwt({ token, account }) {
      // No login inicial, salvamos os dados do passe
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token; // O Facebook pode não fornecer isso sempre
        token.accessTokenExpires = Date.now() + (account.expires_in || 3600) * 1000;
        return token;
      }

      // Em acessos subsequentes, verificamos se o passe ainda é válido
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Se o passe expirou, tentamos renová-lo
      console.log("Token do Facebook expirado, tentando renovar...");
      return refreshAccessToken(token);
    },
    // ##### FIM DA ATUALIZAÇÃO DO JWT #####

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error; // Passa o erro para a sessão, se houver
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };