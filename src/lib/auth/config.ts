import type { NextAuthConfig } from "next-auth";
import { isPlan } from "./entitlements";

/**
 * Import-light part of the Auth.js config. Route protection lives in
 * src/proxy.ts (which reads the session JWT directly); the Credentials
 * provider — which pulls in the database client and bcrypt — is added only
 * in src/auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      // On sign-in, persist our custom fields into the JWT.
      if (user) {
        token.id = user.id;
        token.plan = user.plan;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.plan = isPlan(token.plan) ? token.plan : "free";
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
