import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in · Polymath" };

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-16">
      <h1 className="text-4xl font-semibold">Polymath</h1>
      <Suspense fallback={null}>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignIn({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const { error } = await searchParams;
  return <SignInForm linkFailed={error === "link"} />;
}
