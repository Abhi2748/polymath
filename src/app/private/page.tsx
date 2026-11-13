import type { Metadata } from "next";

export const metadata: Metadata = { title: "Private · Polymath" };

export default function PrivatePage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="text-2xl">This site is private.</p>
    </main>
  );
}
