import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Profile } from "@/lib/profile/types";
import { PLANS } from "@/lib/auth/entitlements";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  plan: text("plan", { enum: PLANS }).notNull().default("free"),
  // The Sleeper profile (username + saved leagues) previously kept only in
  // localStorage; stored as-is so the client shape and DB shape never drift.
  profile: jsonb("profile").$type<Profile>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
