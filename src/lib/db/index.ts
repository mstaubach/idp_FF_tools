import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let db: Db | null = null;

/**
 * Lazily-initialized Drizzle client. Nothing connects at module load, so the
 * app still builds and serves the Sleeper-only tools without DATABASE_URL —
 * only the auth/profile routes require it at runtime.
 */
export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Account features require a Postgres database."
      );
    }
    // prepare: false keeps the client compatible with transaction-mode
    // poolers (Neon, Supabase pgbouncer).
    db = drizzle(postgres(url, { prepare: false }), { schema });
  }
  return db;
}

export { schema };
