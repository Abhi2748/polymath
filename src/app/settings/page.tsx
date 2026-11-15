import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import skeleton from "../../../data/skeleton.json";
import { getUserSettings } from "@/db/userSettings";
import { requireUserId } from "@/lib/auth";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings · Polymath" };

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <Link href="/map" className="text-sm text-muted">
        ← Map
      </Link>
      <h1 className="mt-8 text-3xl font-semibold">Settings</h1>
      <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  await connection();
  const settings = await getUserSettings(await requireUserId());

  const realms = skeleton.realms.map((realm) => ({
    id: realm.id,
    name: realm.name,
    fields: skeleton.fields.filter((f) => f.realm === realm.id).map((f) => ({ code: f.code, name: f.name })),
  }));
  const zones = Intl.supportedValuesOf("timeZone");
  const timeZones = zones.includes(settings.tz) ? zones : [settings.tz, ...zones];

  return <SettingsForm initial={settings} realms={realms} timeZones={timeZones} />;
}
