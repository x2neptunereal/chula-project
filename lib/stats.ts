export interface StatBlock {
  total: number;
  average: number;
  median: number;
  mode: number[];
  max: number;
  min: number;
  count: number;
}

const EMPTY_BLOCK: StatBlock = {
  total: 0,
  average: 0,
  median: 0,
  mode: [],
  max: 0,
  min: 0,
  count: 0,
};

/** Computes total/average/median/mode/max/min over a list of amounts. */
export function computeStatBlock(amounts: number[]): StatBlock {
  if (amounts.length === 0) return { ...EMPTY_BLOCK };

  const sorted = [...amounts].sort((a, b) => a - b);
  const total = sorted.reduce((s, n) => s + n, 0);
  const average = total / sorted.length;

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const freq = new Map<number, number>();
  for (const n of sorted) freq.set(n, (freq.get(n) ?? 0) + 1);
  const maxFreq = Math.max(...freq.values());
  const mode =
    maxFreq > 1
      ? [...freq.entries()].filter(([, c]) => c === maxFreq).map(([v]) => v).sort((a, b) => a - b)
      : [];

  return {
    total,
    average,
    median,
    mode,
    max: sorted[sorted.length - 1],
    min: sorted[0],
    count: sorted.length,
  };
}

export function periodToStartDate(period: "7" | "30" | "60" | "90" | "all"): Date | null {
  if (period === "all") return null;
  const days = { "7": 7, "30": 30, "60": 60, "90": 90 }[period];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}
