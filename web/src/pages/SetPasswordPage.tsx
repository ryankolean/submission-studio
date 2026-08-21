import { useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { ApiError } from "../api/client.js";
import { useSession } from "../session-context.js";
import { PRODUCT_NAME } from "../config.js";

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";

export function SetPasswordPage() {
  const { api } = useSession();
  const [params] = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (token === null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
        <p role="alert" className="mt-4 text-sm text-rose-700">
          This link is missing its invite token. Ask for a new invite link.
        </p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
        <p className="mt-4 text-sm text-slate-700">
          Your password is set. You can sign in now.
        </p>
        <a href="#/login" className="mt-4 text-sm text-slate-900 underline">
          Go to sign in
        </a>
      </main>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // Checked here only to save a round trip; the server owns the real policy.
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/set-password", { token, password });
      setDone(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
      <p className="mt-1 text-sm text-slate-500">Choose a password to finish setting up.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">
            At least 12 characters. A memorable phrase beats a short scramble.
          </p>
        </div>

        <div>
          <label htmlFor="confirmation" className="block text-sm font-medium text-slate-700">
            Confirm password
          </label>
          <input
            id="confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className={inputClass}
          />
        </div>

        {error !== null && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving" : "Set password"}
        </button>
      </form>
    </main>
  );
}
