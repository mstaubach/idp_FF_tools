import type { DefaultSession } from "next-auth";
import type { Plan } from "@/lib/auth/entitlements";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan: Plan;
    } & DefaultSession["user"];
  }

  interface User {
    plan: Plan;
  }
}
