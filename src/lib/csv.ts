/**
 * Minimal, dependency-free CSV encoder. Only escapes what RFC 4180 requires:
 * quotes, commas, and newlines. Dates are serialized as ISO-8601 strings;
 * nulls/undefined become empty cells. Purpose-built for the /leads and
 * /contacts exports — not a general-purpose serializer.
 */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | Date | null | undefined)[])[]
): string {
  const encodedHeader = headers.map(encodeCell).join(",");
  const encodedRows = rows.map((r) => r.map(encodeCell).join(",")).join("\r\n");
  return `${encodedHeader}\r\n${encodedRows}\r\n`;
}

function encodeCell(v: string | number | Date | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvFilename(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.csv`;
}
