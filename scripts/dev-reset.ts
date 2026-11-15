import { eq, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { itemHistory, sessions, topicProgress } from "../src/db/schema";

// Deletes the ALLOWED_EMAIL user's progress, review history and sessions. Settings and flags stay.
async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("dev:reset is for development only and refuses to run in production.");
  }
  const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("ALLOWED_EMAIL is not set. Add it to .env.local.");

  const users = await db.execute<{ id: string }>(sql`select id from auth.users where lower(email) = ${email}`);
  const userId = users[0]?.id;
  if (!userId) throw new Error(`no signed-in user with the address ${email}; sign in once first`);

  const counts = await db.transaction(async (tx) => {
    const progress = await tx.delete(topicProgress).where(eq(topicProgress.userId, userId)).returning({ id: topicProgress.topicId });
    const history = await tx.delete(itemHistory).where(eq(itemHistory.userId, userId)).returning({ id: itemHistory.id });
    const sessionRows = await tx.delete(sessions).where(eq(sessions.userId, userId)).returning({ id: sessions.id });
    return { progress: progress.length, history: history.length, sessions: sessionRows.length };
  });

  console.log(
    `reset ${email}: deleted ${counts.progress} progress rows, ${counts.history} history rows, ${counts.sessions} sessions`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
