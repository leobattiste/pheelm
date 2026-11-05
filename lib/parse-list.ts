export type Line = { title: string; year: number | null };

/** Splits one CSV row, honouring quoted fields. */
function csvRow(line: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Reads a pasted list. Works with a Letterboxd list export (CSV with Name and Year columns),
 * or one film per line: "Title (1999)", "Title, 1999", "12. Title (1999)" or just "Title".
 */
export function parseList(text: string): Line[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  // A CSV export: find its header row and the Name and Year columns.
  const headerAt = lines.findIndex((l) => /(^|,)"?name"?(,|$)/i.test(l) && /(^|,)"?year"?(,|$)/i.test(l));
  if (headerAt >= 0) {
    const head = csvRow(lines[headerAt]).map((h) => h.toLowerCase());
    const ni = head.indexOf("name");
    const yi = head.indexOf("year");
    return lines.slice(headerAt + 1).flatMap((l) => {
      const row = csvRow(l);
      const title = row[ni];
      const year = Number(row[yi]);
      return title ? [{ title, year: Number.isInteger(year) && year > 1880 ? year : null }] : [];
    });
  }

  return lines.flatMap((raw) => {
    const l = raw.replace(/^\s*(?:#?\d+[.)]|\-|•)\s+/, "");
    const m = l.match(/^(.*?)[\s,]*\(?((?:18|19|20)\d{2})\)?\s*$/);
    const title = (m ? m[1] : l).trim().replace(/[,–—-]\s*$/, "").trim();
    return title ? [{ title, year: m ? Number(m[2]) : null }] : [];
  });
}
