import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { readAuthConfig } from "@/lib/auth-config";

const configuration = readAuthConfig(process.env);
// Auth.js uses AUTH_URL for its request/callback origin. Keep it stable on Vercel.
if (configuration.origin) process.env.AUTH_URL = configuration.origin;

export const { handlers, auth } = NextAuth({
  secret: configuration.secret,
  providers: [
    Google({
      clientId: configuration.clientId,
      clientSecret: configuration.clientSecret,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "select_account consent",
          response_type: "code",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.expiresAt = account.expires_at;
        token.refreshToken = account.refresh_token;
        token.oauthScope = account.scope;
      }
      return token;
    },
  },
});

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    expiresAt?: number;
    refreshToken?: string;
    oauthScope?: string;
  }
}
