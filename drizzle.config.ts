import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Only needed for db:migrate / db:push; db:generate works without it.
    url: process.env.DATABASE_URL ?? "",
  },
});
