import { EmailGenerator } from "@/components/EmailGenerator";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">OneGoodEmail</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Upload your resume, paste the job description, and get one good
          outreach email — drafted from your strengths and de-AI&apos;d so it
          reads like you wrote it.
        </p>
      </header>
      <EmailGenerator />
    </main>
  );
}
