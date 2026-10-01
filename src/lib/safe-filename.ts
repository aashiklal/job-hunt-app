/**
 * Reduces a caller-supplied download name to characters that are safe inside
 * a quoted Content-Disposition filename. Quotes, semicolons and line breaks
 * could otherwise break out of the header value.
 */
export function safeFilename(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned || fallback;
}
