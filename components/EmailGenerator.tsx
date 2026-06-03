"use client";

import { useState } from "react";
import type { GenerateResponse, RecipientResult } from "@/types";
import { ResultEditor } from "@/components/ResultEditor";
import { RecipientFinder } from "@/components/RecipientFinder";

export function EmailGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [recipient, setRecipient] = useState<RecipientResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/generate", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setResult(data as GenerateResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <RecipientFinder onResult={setRecipient} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="Resume" hint="PDF, DOCX, or TXT">
          <input
            type="file"
            name="resume"
            accept=".pdf,.docx,.txt"
            required
            className="block w-full text-sm text-neutral-300 file:mr-4 file:rounded-md file:border-0 file:bg-neutral-800 file:px-4 file:py-2 file:text-sm file:text-neutral-100 hover:file:bg-neutral-700"
          />
        </Field>

        <Field label="Job description" hint="Paste the full posting">
          <textarea
            name="jobDescription"
            required
            rows={8}
            placeholder="Paste the job description here…"
            className="w-full resize-y rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none focus:border-neutral-600"
          />
        </Field>

        <Field
          label="Writing-style sample"
          hint="Optional — paste an email you wrote so the draft matches your voice"
        >
          <textarea
            name="styleSample"
            rows={4}
            placeholder="Optional…"
            className="w-full resize-y rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none focus:border-neutral-600"
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Drafting…" : "Generate email"}
        </button>
      </form>

      {error && (
        <p className="rounded-md border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && <ResultEditor result={result} recipient={recipient} />}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal text-neutral-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
