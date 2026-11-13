"use client";

import { useActionState } from "react";
import { type SignInState, sendLink, verifyCode } from "./actions";

const empty: SignInState = { email: null, error: null };

const inputClass = "mt-2 w-full rounded-xl border border-line bg-transparent px-4 py-3 text-lg";
const buttonClass = "mt-4 w-full rounded-xl bg-accent px-5 py-3 font-medium text-background disabled:opacity-60";

export function SignInForm({ linkFailed }: { linkFailed: boolean }) {
  const [sent, send, sending] = useActionState(sendLink, empty);

  if (sent.email) {
    return (
      <>
        <CodeForm key={sent.email} email={sent.email} />
        <form action={send} className="mt-10">
          <input type="hidden" name="email" value={sent.email} />
          <button type="submit" disabled={sending} className="text-muted underline">
            Send a new email
          </button>
        </form>
      </>
    );
  }

  return (
    <form action={send} className="mt-10">
      {linkFailed && <p className="mb-6">That link has expired or was already used. Send a new one.</p>}
      <label htmlFor="email" className="block text-muted">
        Email
      </label>
      <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      <button type="submit" disabled={sending} className={buttonClass}>
        {sending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {sent.error && <p className="mt-4">{sent.error}</p>}
    </form>
  );
}

function CodeForm({ email }: { email: string }) {
  const [state, verify, verifying] = useActionState(verifyCode, { email, error: null });

  return (
    <form
      action={(formData) => {
        formData.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
        verify(formData);
      }}
      className="mt-10"
    >
      <p className="text-lg leading-relaxed">
        Check your email. Open the link, or type the code from the email here.
      </p>
      <label htmlFor="code" className="mt-6 block text-muted">
        Code
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        className={`${inputClass} tracking-widest`}
      />
      <button type="submit" disabled={verifying} className={buttonClass}>
        {verifying ? "Checking…" : "Sign in"}
      </button>
      {state.error && <p className="mt-4">{state.error}</p>}
    </form>
  );
}
