/**
 * Removes LaTeX primitives that read or write files, run shell commands or
 * redefine the language, from a model-written document body.
 *
 * The body is written by a model from a job description the user pasted in,
 * so it is untrusted: an injected posting could make it emit \input{...} or
 * \write18{...}, which would run on the user's machine when they compile the
 * exported .tex. A resume body never needs any of these.
 *
 * TeX's ^^xx notation can spell a backslash (^^5c) and so rebuild any of the
 * commands below after this pass; it is stripped for the same reason.
 */
const DANGEROUS_COMMANDS = [
  "input",
  "include",
  "includeonly",
  "InputIfFileExists",
  "lstinputlisting",
  "verbatiminput",
  "write",
  "immediate",
  "openin",
  "openout",
  "read",
  "catcode",
  "def",
  "gdef",
  "edef",
  "xdef",
  "let",
  "csname",
  "directlua",
  "ShellEscape",
];

const COMMAND_PATTERN = new RegExp(
  `\\\\(?:${DANGEROUS_COMMANDS.join("|")})(?![A-Za-z])\\d*`,
  "g"
);

export function sanitizeLatexBody(body: string): string {
  return body.replace(/\^\^/g, "").replace(COMMAND_PATTERN, "");
}
