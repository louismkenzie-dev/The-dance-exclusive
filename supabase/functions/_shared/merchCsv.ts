// Mirror of src/lib/merchCsv.ts — KEEP THE TWO IN SYNC.
// merchCsv.test.ts fails if they ever disagree.
//
/**
 * Writing the print run as a CSV for Amie's partner to open in Excel.
 *
 * This is the one place in the merchandise feature with a genuine security edge. A parent chooses
 * the personalisation text, so every cell in the "Front"/"Back"/"Sleeve" columns is
 * attacker-controlled input that lands in a third party's spreadsheet.
 *
 * Three separate hazards, all handled here rather than at the input:
 *
 * 1. FORMULA INJECTION. Excel, LibreOffice and Sheets execute a cell beginning with = + - @ (or a
 *    tab/CR) as a formula. A field like =HYPERLINK(...) or a DDE payload can exfiltrate data or
 *    prompt the user to run something. Prefixed with an apostrophe, which those applications strip
 *    on display, so the printer sees the name and not a formula.
 * 2. QUOTING. Commas, quotes and newlines inside a name would otherwise shift every following
 *    column, which for a printer means the wrong name on the wrong garment.
 * 3. ENCODING. Without a UTF-8 BOM, Excel on Windows reads the file as Latin-1 and "Chloé"
 *    becomes "ChloÃ©" — and then gets printed that way.
 *
 * Input validation is deliberately NOT the defence here. "Anne-Marie" starts with a letter but
 * "-Evie" is a legal thing to want printed, and refusing it with a confusing error would be worse
 * than escaping it properly at the boundary that actually cares.
 */

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

export const UTF8_BOM = "﻿";

/**
 * One CSV field: neutralised against formula execution, then quoted per RFC 4180.
 * Null and undefined become an empty cell rather than the text "null".
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  if (FORMULA_PREFIXES.some((p) => text.startsWith(p))) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * A complete CSV document, BOM included, CRLF line endings (what Excel expects).
 * `rows` are data rows; `header` is written first.
 */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [csvRow(header), ...rows.map(csvRow)];
  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/** Base64 for an email attachment, UTF-8 safe (btoa alone mangles anything non-ASCII). */
export function csvToBase64(csv: string): string {
  const bytes = new TextEncoder().encode(csv);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
