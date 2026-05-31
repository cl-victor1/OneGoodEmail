// Resume parsing: PDF via unpdf, DOCX via mammoth, plain text passthrough.
// Runs only on the server (Node runtime) — see serverExternalPackages in next.config.ts.

export type SupportedMime =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain";

/** Extract plain text from an uploaded resume file. */
export async function parseResume(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return parsePdf(buffer);
  }

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return parseDocx(buffer);
  }

  // Fallback: treat as UTF-8 text (.txt, .md, pasted content).
  const text = buffer.toString("utf-8");
  if (!text.trim()) {
    throw new Error(`Unsupported or empty resume file: ${file.name}`);
  }
  return text;
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const result = Array.isArray(text) ? text.join("\n") : text;
  if (!result.trim()) {
    throw new Error("Could not extract text from PDF (is it a scanned image?)");
  }
  return result;
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  if (!value.trim()) {
    throw new Error("Could not extract text from DOCX");
  }
  return value;
}
