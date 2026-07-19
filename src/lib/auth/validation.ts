import { z } from "zod";

// bcrypt only hashes the first 72 bytes, so longer passwords are rejected
// rather than silently truncated.
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(50).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(72),
});

const savedLeagueSchema = z.object({
  leagueId: z.string().regex(/^\d+$/, "Sleeper league IDs are numeric"),
  name: z.string().trim().min(1).max(100),
});

/** Mirrors `Profile` in src/lib/profile/types.ts — the shape synced to the DB. */
export const profileSchema = z
  .object({
    sleeperUsername: z.string().trim().min(1).max(50),
    sleeperUserId: z.string().regex(/^\d+$/, "Sleeper user IDs are numeric"),
    leagues: savedLeagueSchema.array().min(1).max(50),
    primaryLeagueId: z.string().regex(/^\d+$/),
  })
  .refine(
    (p) => p.leagues.some((l) => l.leagueId === p.primaryLeagueId),
    { message: "primaryLeagueId must be one of the saved leagues" }
  );

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
