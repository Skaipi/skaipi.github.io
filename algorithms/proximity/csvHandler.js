export class CSVHandler {
  constructor() {
    this.maxPoints = 10_000;
    this.delimiter = ",";
  }

  async loadFile(file) {
    if (!(file instanceof File)) throw new Error("file must be a File instance.");
    const text = await file.text();
    return this.loadText(text);
  }

  loadText(text) {
    const { points, errors, meta } = this._parse(text);
    this.points = points;
    return { points, errors, meta };
  }

  _parse(text) {
    if (typeof text !== "string") throw new Error("Input must be a string.");
    const maxPoints = this.maxPoints;

    // Normalize newlines; keep original line indices for error messages
    const rawLines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

    // Find first non-empty, non-comment line for delimiter detection (unless forced)
    const forcedDelim = this.delimiter;
    let detectedDelim = forcedDelim;
    if (!detectedDelim) {
      const sample = rawLines.find((l) => l.trim() && !l.trim().startsWith("#"));
      detectedDelim = this._detectDelimiter(sample || "");
    }

    const points = [];
    const errors = [];
    let headerDecided = false;
    let hasHeader = false;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (let i = 0; i < rawLines.length; i++) {
      const lineNo = i + 1;
      const line = rawLines[i];

      if (!line || !line.trim()) continue;
      if (line.trim().startsWith("#")) continue;

      const fields = this._parseCsvLine(line, detectedDelim).map((s) => s.trim());

      if (fields.length < 2) {
        errors.push(`Line ${lineNo}: expected at least 2 columns, got ${fields.length}.`);
        continue;
      }

      if (!headerDecided) {
        const a = this._toNumber(fields[0]);
        const b = this._toNumber(fields[1]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
          hasHeader = true;
          headerDecided = true;
          continue; // skip header row
        }
        headerDecided = true;
      }

      const x = this._toNumber(fields[0]);
      const y = this._toNumber(fields[1]);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        errors.push(`Line ${lineNo}: non-numeric x/y ("${fields[0]}", "${fields[1]}").`);
        continue;
      }

      points.push([x, y]);

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      if (points.length >= maxPoints) {
        errors.push(`Stopped: reached max-points=${maxPoints}.`);
        break;
      }
    }

    const meta = points.length
      ? { delimiter: detectedDelim, hasHeader, count: points.length, bbox: { minX, minY, maxX, maxY } }
      : null;

    return { points, errors, meta };
  }

  _detectDelimiter(sampleLine) {
    // Heuristic: pick delimiter with max splits for a likely CSV header/row.
    const cands = [",", ";", "\t", "|"];
    let best = ",";
    let bestScore = -1;
    for (const d of cands) {
      const fields = this._parseCsvLine(sampleLine, d);
      const score = fields.length;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  _parseCsvLine(line, delim) {
    // Minimal RFC4180-ish line parser (handles quotes + escaped quotes).
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (inQuotes) {
        if (ch === '"') {
          const next = line[i + 1];
          if (next === '"') {
            // escaped quote
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        continue;
      }

      if (ch === delim) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }
    out.push(cur);
    return out;
  }

  _toNumber(s) {
    // Accept numbers in quotes, and tolerate surrounding whitespace.
    // Note: This intentionally does NOT accept locale commas as decimal separators.
    const t = String(s)
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .replace(/^'(.*)'$/, "$1")
      .trim();
    if (t === "") return NaN;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }
}
