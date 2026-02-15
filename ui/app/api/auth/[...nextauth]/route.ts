import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import KeycloakProvider from "next-auth/providers/keycloak";

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID || "",
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
      issuer: process.env.KEYCLOAK_ISSUER,
    }),
    CredentialsProvider({
      name: "Keycloak Direct",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          const params = new URLSearchParams();
          params.append("client_id", process.env.KEYCLOAK_CLIENT_ID || "");
          params.append("client_secret", process.env.KEYCLOAK_CLIENT_SECRET || "");
          params.append("grant_type", "password");
          params.append("username", credentials.username);
          params.append("password", credentials.password);
          params.append("scope", "openid profile email");

          const res = await fetch(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
          });

          const data = await res.json();

          if (!res.ok) {
            console.error("Keycloak Error:", data);
            return null;
          }

          // TODO: utiliser une lib JWT pour vérifier la signature
          const accessToken = data.access_token;
          const decoded = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());

          return {
            id: decoded.sub,
            name: decoded.preferred_username || decoded.name,
            email: decoded.email,
            accessToken: accessToken,
          };
        } catch (e) {
          console.error("Auth Exception:", e);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.id = user.id;
      }
      // TODO: gérer le refresh token ici
      return token;
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      session.user.id = token.id;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
