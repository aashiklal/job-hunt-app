/**
 * Guards against decompression bombs in uploaded DOCX files (a DOCX is a ZIP).
 *
 * The upload size limit only bounds the compressed bytes. A 5 MB DOCX whose
 * document.xml inflates to gigabytes would pass it and then exhaust memory
 * inside mammoth or jszip. This reads the uncompressed sizes each entry
 * declares in the ZIP central directory, without inflating anything, and
 * refuses the file before any parser touches it.
 *
 * Declared sizes can lie. This stops the common bomb shape cheaply; the
 * platform memory limit remains the backstop for a forged directory.
 */

export const MAX_ZIP_UNCOMPRESSED_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_ZIP_ENTRIES = 1000;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
const ZIP64_MARKER = 0xffffffff;

export class ZipLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipLimitError";
  }
}

function findEndOfCentralDirectory(buf: Buffer): number {
  const stop = Math.max(0, buf.length - EOCD_MIN_SIZE - MAX_COMMENT_SIZE);
  for (let i = buf.length - EOCD_MIN_SIZE; i >= stop; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

/**
 * Throws ZipLimitError when the archive is not a readable ZIP, uses ZIP64,
 * has too many entries, or declares more uncompressed bytes than allowed.
 */
export function assertZipWithinLimits(
  buf: Buffer,
  maxBytes: number = MAX_ZIP_UNCOMPRESSED_BYTES,
  maxEntries: number = MAX_ZIP_ENTRIES
): void {
  if (buf.length < EOCD_MIN_SIZE) throw new ZipLimitError("Not a ZIP file.");

  const eocd = findEndOfCentralDirectory(buf);
  if (eocd < 0) throw new ZipLimitError("Not a ZIP file.");

  const entryCount = buf.readUInt16LE(eocd + 10);
  const directoryOffset = buf.readUInt32LE(eocd + 16);
  if (directoryOffset === ZIP64_MARKER || entryCount === 0xffff) {
    throw new ZipLimitError("ZIP64 archives are not supported.");
  }
  if (entryCount > maxEntries) {
    throw new ZipLimitError("The file contains too many parts.");
  }

  let offset = directoryOffset;
  let total = 0;
  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== CENTRAL_HEADER_SIGNATURE) {
      throw new ZipLimitError("The file is corrupted.");
    }
    const uncompressed = buf.readUInt32LE(offset + 24);
    if (uncompressed === ZIP64_MARKER) {
      throw new ZipLimitError("ZIP64 archives are not supported.");
    }
    total += uncompressed;
    if (total > maxBytes) {
      throw new ZipLimitError("The file expands to more than the allowed size.");
    }
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    offset += 46 + nameLength + extraLength + commentLength;
  }
}
