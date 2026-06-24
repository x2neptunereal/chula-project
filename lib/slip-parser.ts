export type BankType = "krungthai" | "truemoney" | "kbank" | "unknown";

export interface ParsedSlip {
  transactionNumber: string | null;
  amount: number | null;
  date: Date | null;
  bank: BankType;
}

/**
 * Detect which Thai bank issued the slip from OCR text.
 * KBank is checked BEFORE TrueMoney because K+ slips that transfer TO TrueMoney
 * contain "TRUE MONEY COMPANY LIMITED" as payee — we don't want that to win.
 */
export function detectBank(text: string): BankType {
  const t = text.toLowerCase();

  if (
    text.includes("กสิกร") ||
    text.includes("กสิกรไทย") ||
    t.includes("kbank") ||
    t.includes("k-bank") ||
    t.includes("kasikorn") ||
    text.includes("K+") ||
    t.includes("k plus") ||
    t.includes("k-plus")
  )
    return "kbank";

  if (
    text.includes("กรุงไทย") ||
    t.includes("krungthai") ||
    t.includes("ktb") ||
    text.includes("KTB")
  )
    return "krungthai";

  if (
    text.includes("ทรูมันนี่") ||
    text.includes("ทรูมันนี") ||
    t.includes("truemoney") ||
    t.includes("true money") ||
    t.includes("true wallet")
  )
    return "truemoney";

  return "unknown";
}

/** Extract transaction reference number */
export function extractTransactionNumber(text: string): string | null {
  const patterns = [
    // TrueMoney wallet: "หมายเลขการทำรายการ"
    /หมายเลขการท[าำ]รายการ[:\s#]*([\dA-Za-z\-]+)/,
    // older pattern without "การ"
    /หมายเลขท[าำ]รายการ[:\s#]*([\dA-Za-z\-]+)/,
    // Krungthai: "รหัสธุรกรรม"
    /รหัสธุรกรรม[:\s#]*([\dA-Za-z\-]+)/,
    // Krungthai ref: "รหัสอ้างอิง"
    /รหัสอ้างอิง[:\s#]*([\dA-Za-z\-]+)/,
    // Flexible fallback — OCR sometimes drops/mangles the ้ tone mark on อ้างอิง:
    // match "รหัส" + anything (up to 12 chars) + ending in "อิง" or "รรม" + value
    /รหัส[^\n]{0,12}?(?:อิง|รรม)[:\s#]*([\dA-Za-z\-]+)/,
    // KBank K+ and TrueMoney: "เลขที่รายการ" — value may be on the next line
    // Flexible Thai range handles garbled tone marks in "ที่"
    // Also captures optional space-separated suffix e.g. "2605091335599255 HLP8"
    /เลข[฀-๿\s]{0,10}?รายการ[\s\S]{0,60}?(\d{6,}[A-Za-z0-9]*(?:\s[A-Z0-9]{2,8})?)/,
    // Generic ref
    /เลขอ้างอิง[:\s#]*([\dA-Za-z\-]+)/,
    // English labels
    /Transaction\s*(?:ID|No\.?|Number)[:\s#]*([\dA-Za-z\-]+)/i,
    /Ref(?:erence)?\.?\s*(?:No\.?)?[:\s#]*([\dA-Za-z\-]{6,})/i,
    // Alphanumeric codes like "APIC1780639069424RQP" — require letters THEN digits
    // (avoids matching plain English words like "TRUE")
    /(?:^|\s)([A-Z]{2,5}\d{8,}[A-Z0-9]*)(?:\s|$)/m,
    // Long numeric strings (10–20 digits) — last resort
    /(?:^|\s)(\d{10,20})(?:\s|$)/m,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) {
      // Collapse any spaces within the captured value
      // e.g. "2605091335599255 HLP8" → "2605091335599255HLP8"
      const val = match[1].trim().replace(/\s+/g, "");
      if (val.length >= 4) return val;
    }
  }
  return null;
}

/** Extract amount in THB — returns the largest non-zero value found */
export function extractAmount(text: string): number | null {
  const candidates: number[] = [];

  // Specific label patterns — allow newline/whitespace between label and value
  const labelPatterns = [
    // จำนวนเงิน / จำนวน (label then value, may span line)
    /จ[าำ]นวน(?:เงิน)?[\s\S]{0,40}?([\d,]+\.\d{1,2})\s*(?:บาท|THB|฿)/,
    // ยอดโอน / ยอดชำระ / ยอดชำระทั้งหมด
    /ยอด[฀-๿]*[\s\S]{0,40}?([\d,]+\.\d{1,2})\s*(?:บาท|THB|฿)/,
    // "Amount in THB ฿ X,XXX.XX"
    /Amount\s+in\s+THB[\s\S]{0,20}?฿?\s*([\d,]+\.\d{1,2})/i,
    // Generic "Amount: X"
    /Amount[:\s]+([\d,]+\.\d{1,2})/i,
    // THB prefix
    /THB\s+([\d,]+\.\d{1,2})/i,
  ];

  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const val = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0) candidates.push(val);
    }
  }

  // Broad fallback: any "฿ X,XXX.XX" or "X,XXX.XX บาท" anywhere in the text
  const broadPatterns = [
    /฿\s*([\d,]+\.\d{1,2})/g,
    /([\d,]+\.\d{2})\s*บาท/g,
  ];

  for (const pattern of broadPatterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0) candidates.push(val);
    }
  }

  // OCR sometimes reads comma as period: "1,000.00" → "1.000.00"
  // Detect "X.XXX.XX" (first period = thousands separator, second = decimal)
  const euroFormat = text.matchAll(/(\d{1,3})\.(\d{3})\.(\d{2})\b/g);
  for (const m of euroFormat) {
    const val = parseFloat(m[1] + m[2] + "." + m[3]);
    if (!isNaN(val) && val > 0 && val < 10_000_000) candidates.push(val);
  }

  // OCR sometimes drops the decimal point: "3,000.00 บาท" → "3,00000 บาท"
  // Pattern: digit(s), comma, 3 digits, then exactly 2 more digits, then บาท
  const droppedDecimal = text.matchAll(/(\d{1,3},\d{3})(\d{2})\s*บาท/g);
  for (const m of droppedDecimal) {
    const reconstructed = parseFloat(m[1].replace(/,/g, "") + "." + m[2]);
    if (!isNaN(reconstructed) && reconstructed > 0) candidates.push(reconstructed);
  }

  // Also handle no-comma version: e.g. "32875" → 328.75 (5–6 digit integer before บาท)
  const noCommaDropped = text.matchAll(/(?<!\d)(\d{5,6})\s*บาท/g);
  for (const m of noCommaDropped) {
    const reconstructed = parseFloat(m[1]) / 100;
    if (!isNaN(reconstructed) && reconstructed > 0) candidates.push(reconstructed);
  }

  // Last-resort: find ANY "X,XXX.XX" or "XXX.XX" number in the text.
  // TrueMoney slips show "฿ 2,000.00" with no label/suffix — this catches those.
  // Also catches amounts where OCR misread ฿ as B or another character.
  const anyAmount = text.matchAll(/([\d,]+\.\d{2})/g);
  for (const m of anyAmount) {
    const val = parseFloat(m[1].replace(/,/g, ""));
    // Filter out fee-like zeros and unreasonably huge values (> 10M THB)
    if (!isNaN(val) && val > 0 && val < 10_000_000) candidates.push(val);
  }

  if (candidates.length === 0) return null;

  // Return the LARGEST value — fees are 0.00 (already filtered), real amount is biggest
  return candidates.sort((a, b) => b - a)[0];
}

/** Convert a Thai Buddhist Era year (BE) to Christian Era (CE) */
function beToce(year: number): number {
  // Handle 2-digit shorthand like "69" meaning พ.ศ. 2569
  if (year < 100) year += 2500;
  // Convert BE to CE
  if (year > 2500) year -= 543;
  return year;
}

/**
 * Convert Thai digits (๐–๙) to ASCII digits so regexes work correctly.
 * Also normalizes sara am OCR split (ํา → ำ).
 */
function normalizeDigits(text: string): string {
  return text.replace(/[๐-๙]/g, (c) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(c)));
}

/**
 * Extract time (HH, MM, SS) from text near a given index (within 120 chars after).
 * Looks for patterns like "13:35:09", "13:35", "เวลา 13.35", "13.35 น."
 */
function extractTimeNear(text: string, afterIndex: number): { h: number; m: number; s: number } | null {
  const window = text.slice(afterIndex, afterIndex + 120);

  // Standard HH:MM:SS or HH:MM (24-hour)
  const colonTime = window.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?/);
  if (colonTime) {
    return {
      h: parseInt(colonTime[1]),
      m: parseInt(colonTime[2]),
      s: colonTime[3] ? parseInt(colonTime[3]) : 0,
    };
  }

  // "เวลา 13.35" — Thai slips sometimes use dot instead of colon
  const dotTime = window.match(/(?:เวลา|time)[^\d]*([01]?\d|2[0-3])\.([0-5]\d)/i);
  if (dotTime) {
    return { h: parseInt(dotTime[1]), m: parseInt(dotTime[2]), s: 0 };
  }

  return null;
}

/** Extract the best time from anywhere in the text (fallback when date and time aren't adjacent) */
function extractTimeGlobal(text: string): { h: number; m: number; s: number } | null {
  // 1. Labeled: "เวลา HH:MM:SS" or "เวลา HH:MM" — most reliable
  const labeled = text.match(/(?:เวลา|time)[^\d]{0,3}([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?/i);
  if (labeled) {
    return {
      h: parseInt(labeled[1]),
      m: parseInt(labeled[2]),
      s: labeled[3] ? parseInt(labeled[3]) : 0,
    };
  }

  // 2. HH:MM:SS with word boundary — ref numbers don't have colons
  const hms = text.match(/\b([01]?\d|2[0-3]):([0-5]\d):([0-5]\d)\b/);
  if (hms) return { h: parseInt(hms[1]), m: parseInt(hms[2]), s: parseInt(hms[3]) };

  // 3. Bare HH:MM — last resort; require surrounding whitespace or line break
  //    to avoid matching version numbers like "v1:30" or partial ref codes
  const hm = text.match(/(?:^|[\s\n])([01]\d|2[0-3]):([0-5]\d)(?=[\s\n]|$)/m);
  if (hm) return { h: parseInt(hm[1]), m: parseInt(hm[2]), s: 0 };

  return null;
}

/** Apply time components to a Date object (mutates a copy) */
function applyTime(date: Date, time: { h: number; m: number; s: number } | null): Date {
  if (!time) return date;
  const d = new Date(date);
  d.setHours(time.h, time.m, time.s, 0);
  return d;
}

/** Parse Thai date formats and return a JS Date with time if available */
export function extractDate(text: string): Date | null {
  // Normalize Thai digits first so all regexes work on ASCII digits
  text = normalizeDigits(text);

  const thaiMonthMap: Record<string, number> = {
    // January
    "ม.ค.": 0, "มกราคม": 0, "มค": 0,
    // February
    "ก.พ.": 1, "กุมภาพันธ์": 1, "กพ": 1,
    // March
    "มี.ค.": 2, "มีนาคม": 2, "มีค": 2,
    // April
    "เม.ย.": 3, "เมษายน": 3, "เมย": 3,
    // May — "พด" / "พด." are common OCR misreads of "พค" / "พ.ค."
    "พ.ค.": 4, "พฤษภาคม": 4, "พค": 4, "พด": 4, "W.A.": 4, "w.a.": 4, "WA": 4, "wa": 4,
    // June
    "มิ.ย.": 5, "มิถุนายน": 5, "มิย": 5,
    // July
    "ก.ค.": 6, "กรกฎาคม": 6, "กค": 6,
    // August
    "ส.ค.": 7, "สิงหาคม": 7, "สค": 7,
    // September
    "ก.ย.": 8, "กันยายน": 8, "กย": 8,
    // October
    "ต.ค.": 9, "ตุลาคม": 9, "ตค": 9,
    // November — "พย" and "พน" are OCR variants
    "พ.ย.": 10, "พฤศจิกายน": 10, "พย": 10, "พน": 10,
    // December
    "ธ.ค.": 11, "ธันวาคม": 11, "ธค": 11,
  };

  // ── 0. Thai date+time line anchored on "น." (K-Bank / KTB) ──────────────────
  // Pattern: "[day][Thai month stuff][year] [HH:MM] น."
  // "น." (นาฬิกา) is a unique marker that Thai bank apps put after the time.
  // This strategy doesn't need to recognise the month name — it identifies the
  // month by scanning the captured middle chars against the month map, so even
  // heavily garbled OCR like "วด8พด. 69 13:35 น." is handled correctly.
  {
    const tlRe = /(\d{1,2})([^\d\n]{1,14})(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*น/;
    const tl = text.match(tlRe);
    if (tl) {
      const day  = parseInt(tl[1]);
      const year = beToce(parseInt(tl[3]));
      const h    = parseInt(tl[4]);
      const min  = parseInt(tl[5]);
      const s    = tl[6] ? parseInt(tl[6]) : 0;

      if (day >= 1 && day <= 31 && year >= 2020 && year <= 2100) {
        // Identify month from the Thai chars captured in group 2
        const monthChars = tl[2].replace(/[\s.]/g, ""); // strip spaces + dots
        let monthIdx = -1;
        for (const [monthStr, idx] of Object.entries(thaiMonthMap)) {
          const key = monthStr.replace(/\./g, "");
          if (monthChars.includes(key)) { monthIdx = idx; break; }
        }
        if (monthIdx >= 0) {
          const date = new Date(year, monthIdx, day);
          date.setHours(h, min, s, 0);
          return date;
        }
      }
    }
  }

  // ── 1. Thai month name (highest priority — unambiguous) ────────────────────
  // e.g. "9 พ.ค. 69", "04 มิ.ย. 2569", "วด8พด. 69" (OCR garbled)
  for (const [monthStr, monthIdx] of Object.entries(thaiMonthMap)) {
    // Allow dots/spaces to be optional in abbreviated forms (e.g. "พ.ค." → "พ\.?ค\.?")
    const flexible = monthStr.includes(".")
      ? monthStr.replace(/\./g, "\\.?\\s*").trimEnd()
      : monthStr;
    // Between day-digit and month: only spaces/dots (not Thai chars!) so we
    // don't greedily consume the month token itself. "8พด" → 0 space/dot chars.
    // Between month and year: allow any non-digit chars (handles "พด. 69" or "พ.ค. 69").
    const regex = new RegExp(`(\\d{1,2})[\\s.]{0,3}${flexible}[^\\d]{0,6}(\\d{2,4})`);
    const match = text.match(regex);
    if (match) {
      const year = beToce(parseInt(match[2]));
      const date = new Date(year, monthIdx, parseInt(match[1]));
      if (!isNaN(date.getTime())) {
        // Look for time right after the date match, then fall back to global search
        const time = extractTimeNear(text, match.index! + match[0].length)
          ?? extractTimeGlobal(text);
        return applyTime(date, time);
      }
    }
  }

  // ── 2. Labeled slash date — "วันที่ DD/MM/YY(YY)" ─────────────────────────
  // Only match when preceded by a Thai "date" label to avoid ref-number collisions
  const labeledSlash = text.match(
    /(?:วันที่|วันที|date)[^\d]{0,5}(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i
  );
  if (labeledSlash) {
    const d = parseInt(labeledSlash[1]);
    const m = parseInt(labeledSlash[2]);
    const y = beToce(parseInt(labeledSlash[3]));
    const date = new Date(y, m - 1, d);
    if (!isNaN(date.getTime()) && d <= 31 && m <= 12) {
      const time = extractTimeNear(text, labeledSlash.index! + labeledSlash[0].length)
        ?? extractTimeGlobal(text);
      return applyTime(date, time);
    }
  }

  // ── 3. Bare slash date — DD/MM/YYYY fallback ───────────────────────────────
  // Require a plausible day (≤31) and month (≤12) to avoid matching ref numbers
  const slashMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (slashMatch) {
    const d = parseInt(slashMatch[1]);
    const m = parseInt(slashMatch[2]);
    const y = beToce(parseInt(slashMatch[3]));
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime())) {
        const time = extractTimeNear(text, slashMatch.index! + slashMatch[0].length)
          ?? extractTimeGlobal(text);
        return applyTime(date, time);
      }
    }
  }

  return null;
}

/**
 * Tesseract OCR often outputs the Thai sara am character as two separate code points:
 * U+0E4D (mai han akat ํ) + U+0E32 (sara aa า) instead of U+0E33 (sara am ำ).
 * Normalize to the composed form so all regex patterns match correctly.
 */
function normalizeThaiText(text: string): string {
  // Compose sara am split by Tesseract
  text = text.replace(/ํา/g, "ำ");
  // Convert Thai digits ๐–๙ to ASCII 0–9
  text = normalizeDigits(text);
  return text;
}

/** Full parse: run all extractors on OCR text */
export function parseSlipText(text: string): ParsedSlip {
  const t = normalizeThaiText(text);
  return {
    bank: detectBank(t),
    transactionNumber: extractTransactionNumber(t),
    amount: extractAmount(t),
    date: extractDate(t),
  };
}
