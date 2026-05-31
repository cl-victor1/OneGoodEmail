"use client";

import { useState } from "react";
import type { GenerateResponse } from "@/types";

export function ResultEditor({ result }: { result: GenerateResponse }) {
  const { email, profile, requirements } = result;
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="space-y-6 border-t border-neutral-800 pt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your draft</h2>
        <button
          onClick={copy}
          className="rounded-md border border-neutral-700 px-4 py-1.5 text-sm hover:bg-neutral-800"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Subject</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none focus:border-neutral-600"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Body</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          className="w-full resize-y rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm leading-relaxed outline-none focus:border-neutral-600"
        />
      </label>

      {email.revisionNotes?.length > 0 && (
        <Details summary="What the AI-taste pass changed">
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-400">
            {email.revisionNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </Details>
      )}

      <Details summary="Pipeline insight (profile + JD match)">
        <div className="grid gap-4 text-sm text-neutral-400 sm:grid-cols-2">
          <div>
            <p className="mb-1 font-medium text-neutral-300">Your highlights</p>
            <ul className="list-disc space-y-1 pl-5">
              {profile.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-neutral-300">Role must-haves</p>
            <ul className="list-disc space-y-1 pl-5">
              {requirements.mustHaves.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      </Details>
    </section>
  );
}

function Details({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-md border border-neutral-800 bg-neutral-900/50 p-4">
      <summary className="cursor-pointer text-sm font-medium text-neutral-300">
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
