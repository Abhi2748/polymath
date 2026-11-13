import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StateLabel } from "@/components/StateLabel";
import { getMap } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Map · Polymath" };

export default function MapPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <h1 className="text-3xl font-semibold">Map</h1>
      <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
        <Realms />
      </Suspense>
    </main>
  );
}

async function Realms() {
  await connection();
  const realms = await getMap(await requireUserId());

  return (
    <div className="mt-8 space-y-14">
      {realms.map((realm) => (
        <section key={realm.id} aria-labelledby={`realm-${realm.id}`}>
          <h2 id={`realm-${realm.id}`} className="text-2xl font-semibold">
            {realm.name}
          </h2>
          <div className="mt-6 space-y-10">
            {realm.fields.map((field) => (
              <section key={field.code} aria-labelledby={`field-${field.code}`}>
                <h3 id={`field-${field.code}`} className="text-lg font-medium text-muted">
                  {field.name}
                </h3>
                <ol className="mt-2 divide-y divide-line border-y border-line">
                  {field.topics.map((topic) => (
                    <li key={topic.id}>
                      <Link
                        href={`/topic/${topic.id}`}
                        className="flex items-baseline justify-between gap-4 py-3"
                      >
                        <span>{topic.title}</span>
                        <StateLabel state={topic.state} />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
