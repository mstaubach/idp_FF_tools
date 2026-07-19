import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { authConfig } from "@/lib/auth/config";
import { loginSchema } from "@/lib/auth/validation";
import { verifyPassword } from "@/lib/auth/passwords";
import { getDb, schema } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const db = getDb();
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, parsed.data.email))
          .limit(1);
        if (!user) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          plan: user.plan,
        };
      },
    }),
  ],
});
