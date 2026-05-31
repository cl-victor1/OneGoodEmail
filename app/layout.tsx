import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneGoodEmail — Resume + JD → Outreach Email",
  description:
    "Upload your resume, paste a job description, and get one good, human-sounding outreach email.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
