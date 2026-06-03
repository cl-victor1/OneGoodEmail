"use client";

import { useState } from "react";
import type { RecipientConfidence, RecipientResult } from "@/types";

const BADGE: Record<RecipientConfidence, { label: string; className: string }> = {
  verified: { label: "✓ Verified", className: "border-green-800 bg-green-950/50 text-green-300" },
  likely: { label: "⚠ Confirm before sending", className: "border-amber-800 bg-amber-950/50 text-amber-300" },
  guess: { label: "💡 Suggested — verify", className: "border-neutral-700 bg-neutral-900 text-neutral-300" },
};

export function RecipientFinder({
  onResult,
}: {
  onResult: (result: RecipientResult | null) => void;
}) {
  const [companyOrUrl, setCompanyOrUrl] = useState("");
  const [founderName, setFounderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecipientResult | null>(null);

  async function handleFind(e: React.FormEvent) {
    e.preventDefault();
    const value = companyOrUrl.trim();
    if (!value) return;

    setError(null);
    setResult(null);
    onResult(null);
    setLoading(true);

    // Heuristic: anything with a dot and no spaces is treated as a URL/domain,
    // which lets us skip the domain search entirely.
    const looksLikeUrl = /\./.test(value) && !/\s/.test(value);
    const payload = looksLikeUrl
      ? { url: value, founderName: founderName.trim() || undefined }
      : { company: value, founderName: founderName.trim() || undefined };

    try {
      const res = await fetch("/api/find-recipient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't look up the recipient.");
      setResult(data as RecipientResult);
      onResult(data as RecipientResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't look up the recipient.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-md border border-neutral-800 bg-neutral-900/40 p-5">
      <div>
        <h2 className="text-sm font-medium">Find the recipient</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Company name, or paste the official site / job-posting URL. We'll find the founder's email.
        </p>
      </div>

      <form onSubmit={handleFind} className="space-y-3">
        <input
          value={companyOrUrl}
          onChange={(e) => setCompanyOrUrl(e.target.value)}
          placeholder="Acme AI  —  or  —  https://acme.ai"
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none focus:border-neutral-600"
        />
        <input
          value={founderName}
          onChange={(e) => setFounderName(e.target.value)}
          placeholder="Founder name (optional — speeds it up if you already know it)"
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none focus:border-neutral-600"
        />
        <button
          type="submit"
          disabled={loading || !companyOrUrl.trim()}
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Searching…" : "Find recipient"}
        </button>
      </form>

      {error && (
        <p className="rounded-md border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3 border-t border-neutral-800 pt-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs ${BADGE[result.confidence].className}`}>
              {BADGE[result.confidence].label}
            </span>
            {result.usedHunter && (
              <span className="rounded-full border border-neutral-700 px-2.5 py-0.5 text-xs text-neutral-400">
                via Hunter
              </span>
            )}
          </div>

          {result.email ? (
            <p className="font-mono text-base text-neutral-100">{result.email}</p>
          ) : (
            <p className="text-neutral-400">No address found.</p>
          )}

          {result.founder && (
            <p className="text-neutral-400">
              {result.founder.firstName} {result.founder.lastName}
              {result.founder.title ? ` · ${result.founder.title}` : ""}
              {result.domain ? ` · ${result.domain}` : ""}
            </p>
          )}

          <p className="text-neutral-500">{result.note}</p>

          {result.sources.length > 0 && (
            <details className="text-neutral-500">
              <summary className="cursor-pointer">Sources</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.sources.map((s, i) => (
                  <li key={i} className="break-all">
                    <a href={s} target="_blank" rel="noreferrer" className="hover:text-neutral-300 underline">
                      {s}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
