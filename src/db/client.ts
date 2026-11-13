import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

// DATABASE_URL points at the Supabase Session pooler (port 5432). Each serverless
// instance holds its own session, and the pooler caps sessions per project, so keep
// the per-instance pool small.
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

const sql =
  globalForDb.sql ??
  postgres(url, {
    ssl: "require",
    max: 1,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
