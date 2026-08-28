export type BankType = "krungthai" | "truemoney" | "kbank" | "unknown";

export interface ParsedSlip {
  transactionNumber: string | null;
  amount: number | null;
  date: Date | null;
  bank: BankType;
}

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

export function extractTransactionNumber(text: string): string | null {
  const patterns = [
    /หมายเลขการท[าำ]รายการ[:\s#]*([\dA-Za-z\-]+)/,
    /หมายเลขท[าำ]รายการ[:\s#]*([\dA-Za-z\-]+)/,
    /รหัสธุรกรรม[:\s#]*([\dA-Za-z\-]+)/,
    /รหัสอ้างอิง[:\s#]*([\dA-Za-z\-]+)/,
    /รหัส[^\n]{0,12}?(?:อิง|รรม)[:\s#]*([\dA-Za-z\-]+)/,
    /เลข[฀-๿\s]{0,10}?รายการ[\s\S]{0,60}?(\d{6,}[A-Za-z0-9]*(?:\s[A-Z0-9]{2,8})?)/,
    /เลขอ้างอิง[:\s#]*([\dA-Za-z\-]+)/,
    /Transaction\s*(?:ID|No\.?|Number)[:\s#]*([\dA-Za-z\-]+)/i,
    /Ref(?:erence)?\.?\s*(?:No\.?)?[:\s#]*([\dA-Za-z\-]{6,})/i,
    /(?:^|\s)([A-Z]{2,5}\d{8,}[A-Z0-9]*)(?:\s|$)/m,
    /(?:^|\s)(\d{10,20})(?:\s|$)/m,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) {
      const val = match[1].trim().replace(/\s+/g, "");
      if (val.length >= 4) return val;
    }
  }
  return null;
}

export function extractAmount(text: string): number | null {
  const candidates: number[] = [];

  const labelPatterns = [
    /จ[าำ]นวน(?:เงิน)?[\s\S]{0,40}?([\d,]+\.\d{1,2})\s*(?:บาท|THB|฿)/,
    /ยอด[฀-๿]*[\s\S]{0,40}?([\d,]+\.\d{1,2})\s*(?:บาท|THB|฿)/,
    /Amount\s+in\s+THB[\s\S]{0,20}?฿?\s*([\d,]+\.\d{1,2})/i,
    /Amount[:\s]+([\d,]+\.\d{1,2})/i,
    /THB\s+([\d,]+\.\d{1,2})/i,
  ];

  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const val = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0) candidates.push(val);
    }
  }

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

  const euroFormat = text.matchAll(/(\d{1,3})\.(\d{3})\.(\d{2})\b/g);
  for (const m of euroFormat) {
    const val = parseFloat(m[1] + m[2] + "." + m[3]);
    if (!isNaN(val) && val > 0 && val < 10_000_000) candidates.push(val);
  }

  const droppedDecimal = text.matchAll(/(\d{1,3},\d{3})(\d{2})\s*บาท/g);
  for (const m of droppedDecimal) {
    const reconstructed = parseFloat(m[1].replace(/,/g, "") + "." + m[2]);
    if (!isNaN(reconstructed) && reconstructed > 0) candidates.push(reconstructed);
  }

  const noCommaDropped = text.matchAll(/(?<!\d)(\d{5,6})\s*บาท/g);
  for (const m of noCommaDropped) {
    const reconstructed = parseFloat(m[1]) / 100;
    if (!isNaN(reconstructed) && reconstructed > 0) candidates.push(reconstructed);
  }

  const anyAmount = text.matchAll(/([\d,]+\.\d{2})/g);
  for (const m of anyAmount) {
    const val = parseFloat(m[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0 && val < 10_000_000) candidates.push(val);
  }

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => b - a)[0];
}

function beToce(year: number): number {
  if (year < 100) year += 2500;
  if (year > 2500) year -= 543;
  return year;
}

function normalizeDigits(text: string): string {
  return text.replace(/[๐-๙]/g, (c) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(c)));
}

function extractTimeNear(text: string, afterIndex: number): { h: number; m: number; s: number } | null {
  const window = text.slice(afterIndex, afterIndex + 120);

  const colonTime = window.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?/);
  if (colonTime) {
    return {
      h: parseInt(colonTime[1]),
      m: parseInt(colonTime[2]),
      s: colonTime[3] ? parseInt(colonTime[3]) : 0,
    };
  }

  const dotTime = window.match(/(?:เวลา|time)[^\d]*([01]?\d|2[0-3])\.([0-5]\d)/i);
  if (dotTime) {
    return { h: parseInt(dotTime[1]), m: parseInt(dotTime[2]), s: 0 };
  }

  return null;
}

function extractTimeGlobal(text: string): { h: number; m: number; s: number } | null {
  const labeled = text.match(/(?:เวลา|time)[^\d]{0,3}([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?/i);
  if (labeled) {
    return {
      h: parseInt(labeled[1]),
      m: parseInt(labeled[2]),
      s: labeled[3] ? parseInt(labeled[3]) : 0,
    };
  }

  const hms = text.match(/\b([01]?\d|2[0-3]):([0-5]\d):([0-5]\d)\b/);
  if (hms) return { h: parseInt(hms[1]), m: parseInt(hms[2]), s: parseInt(hms[3]) };

  const hm = text.match(/(?:^|[\s\n])([01]\d|2[0-3]):([0-5]\d)(?=[\s\n]|$)/m);
  if (hm) return { h: parseInt(hm[1]), m: parseInt(hm[2]), s: 0 };

  return null;
}

function applyTime(date: Date, time: { h: number; m: number; s: number } | null): Date {
  if (!time) return date;
  const d = new Date(date);
  d.setHours(time.h, time.m, time.s, 0);
  return d;
}

export function extractDate(text: string): Date | null {
  text = normalizeDigits(text);

  const thaiMonthMap: Record<string, number> = {
    "ม.ค.": 0, "มกราคม": 0, "มค": 0,
    "ก.พ.": 1, "กุมภาพันธ์": 1, "กพ": 1,
    "มี.ค.": 2, "มีนาคม": 2, "มีค": 2,
    "เม.ย.": 3, "เมษายน": 3, "เมย": 3,
    "พ.ค.": 4, "พฤษภาคม": 4, "พค": 4, "พด": 4, "W.A.": 4, "w.a.": 4, "WA": 4, "wa": 4,
    "มิ.ย.": 5, "มิถุนายน": 5, "มิย": 5,
    "ก.ค.": 6, "กรกฎาคม": 6, "กค": 6,
    "ส.ค.": 7, "สิงหาคม": 7, "สค": 7,
    "ก.ย.": 8, "กันยายน": 8, "กย": 8,
    "ต.ค.": 9, "ตุลาคม": 9, "ตค": 9,
    "พ.ย.": 10, "พฤศจิกายน": 10, "พย": 10, "พน": 10,
    "ธ.ค.": 11, "ธันวาคม": 11, "ธค": 11,
  };

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
        const monthChars = tl[2].replace(/[\s.]/g, "");
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

  for (const [monthStr, monthIdx] of Object.entries(thaiMonthMap)) {
    const flexible = monthStr.includes(".")
      ? monthStr.replace(/\./g, "\\.?\\s*").trimEnd()
      : monthStr;
    const regex = new RegExp(`(\\d{1,2})[\\s.]{0,3}${flexible}[^\\d]{0,6}(\\d{2,4})`);
    const match = text.match(regex);
    if (match) {
      const year = beToce(parseInt(match[2]));
      const date = new Date(year, monthIdx, parseInt(match[1]));
      if (!isNaN(date.getTime())) {
        const time = extractTimeNear(text, match.index! + match[0].length)
          ?? extractTimeGlobal(text);
        return applyTime(date, time);
      }
    }
  }

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

function normalizeThaiText(text: string): string {
  text = text.replace(/ํา/g, "ำ");
  text = normalizeDigits(text);
  return text;
}

export function parseSlipText(text: string): ParsedSlip {
  const t = normalizeThaiText(text);
  return {
    bank: detectBank(t),
    transactionNumber: extractTransactionNumber(t),
    amount: extractAmount(t),
    date: extractDate(t),
  };
}
