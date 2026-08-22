// Risk Score — a 0–100 composite indicator of risky spending behavior over a
// date range, built from 5 weighted sub-metrics. Each sub-metric contributes
// a capped number of points; the sum is the Risk Score.
//
//   Point 1 (max 50): Budget Utilization  = (Expenses ÷ Income) × 100
//                      Point 1 = min(50, (Budget Utilization / 120) × 50)
//
//   Point 2 (max 15): Expense per Day     = Total Expense ÷ Days in range
//                      Median Expense/Day = median of each day's expense total
//                                           within the range (days with no
//                                           expenses count as 0)
//                      Point 2 = min(15, (Expense per Day / (2 × Median Expense per Day)) × 15)
//
//   Point 3 (max 15): Transaction Frequency = Number of Expense Items ÷ Days in range
//                      Point 3 = min(15, (Transaction Frequency / 2.5) × 15)
//
//   Point 4 (max 10): Largest Transaction Ratio = (largest single expense ÷ Total Expense) × 100
//                      Point 4 = min(10, (Largest Transaction Ratio / 70) × 10)
//
//   Point 5 (max 10): Category Concentration = (highest-total category's sum ÷ Total Expense) × 100
//                      Point 5 = min(10, (Category Concentration / 80) × 10)
//
// Risk Score = Point 1 + Point 2 + Point 3 + Point 4 + Point 5 (0–100, each
// point capped at its max so the total can never exceed 100).

export interface RiskTransaction {
  type: "income" | "expense";
  amount: number;
  date: string | Date;
  category?: string | null;
}

export interface RiskScoreResult {
  riskScore: number;
  level: "low" | "medium" | "high" | "very_high";
  points: {
    budgetUtilization: number;
    expensePerDay: number;
    transactionFrequency: number;
    largestTransactionRatio: number;
    categoryConcentration: number;
  };
  metrics: {
    budgetUtilization: number; // %
    expensePerDay: number; // THB/day
    medianExpensePerDay: number; // THB/day
    transactionFrequency: number; // items/day
    largestTransactionRatio: number; // %
    categoryConcentration: number; // %
    days: number;
    totalIncome: number;
    totalExpense: number;
    expenseCount: number;
  };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Computes the Risk Score for a set of transactions over an explicit date
 * range. `from`/`to` are inclusive calendar-day bounds (local Date objects
 * with time truncated is fine — only the day is used). Pass the same
 * transactions/range used for the period's other stats (e.g. summaryFrom /
 * summaryTo on Overview, or the admin export range) so all three stay
 * consistent.
 */
export function computeRiskScore(
  transactions: RiskTransaction[],
  from: Date,
  to: Date
): RiskScoreResult {
  const fromDay = new Date(from);
  fromDay.setHours(0, 0, 0, 0);
  const toDay = new Date(to);
  toDay.setHours(0, 0, 0, 0);

  const days = Math.max(
    1,
    Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000) + 1
  );

  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");

  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const expenseCount = expenses.length;

  // ── Point 1: Budget Utilization ──────────────────────────────────────────
  const budgetUtilization = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
  const point1 = Math.min(50, (budgetUtilization / 120) * 50);

  // ── Point 2: Expense per Day vs. Median Expense per Day ─────────────────
  const expensePerDay = totalExpense / days;

  const dailyExpenseMap = new Map<string, number>();
  for (const tx of expenses) {
    const key = dayKey(new Date(tx.date));
    dailyExpenseMap.set(key, (dailyExpenseMap.get(key) ?? 0) + tx.amount);
  }
  // Zero-expense days within the range count as 0 toward the median.
  const dailyTotals: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDay);
    d.setDate(d.getDate() + i);
    dailyTotals.push(dailyExpenseMap.get(dayKey(d)) ?? 0);
  }
  const medianExpensePerDay = median(dailyTotals);
  const point2 =
    medianExpensePerDay > 0
      ? Math.min(15, (expensePerDay / (2 * medianExpensePerDay)) * 15)
      : expensePerDay > 0
        ? 15 // any spending against a zero median is maximally anomalous
        : 0;

  // ── Point 3: Transaction Frequency ───────────────────────────────────────
  const transactionFrequency = expenseCount / days;
  const point3 = Math.min(15, (transactionFrequency / 2.5) * 15);

  // ── Point 4: Largest Transaction Ratio ───────────────────────────────────
  const largestExpense = expenses.reduce((m, t) => Math.max(m, t.amount), 0);
  const largestTransactionRatio = totalExpense > 0 ? (largestExpense / totalExpense) * 100 : 0;
  const point4 = Math.min(10, (largestTransactionRatio / 70) * 10);

  // ── Point 5: Category Concentration ──────────────────────────────────────
  const categoryTotals = new Map<string, number>();
  for (const tx of expenses) {
    const key = tx.category ?? "uncategorized";
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + tx.amount);
  }
  const highestCategoryTotal = categoryTotals.size > 0 ? Math.max(...categoryTotals.values()) : 0;
  const categoryConcentration = totalExpense > 0 ? (highestCategoryTotal / totalExpense) * 100 : 0;
  const point5 = Math.min(10, (categoryConcentration / 80) * 10);

  const riskScore = point1 + point2 + point3 + point4 + point5;

  let level: RiskScoreResult["level"];
  if (riskScore < 35) level = "low";
  else if (riskScore < 60) level = "medium";
  else if (riskScore < 80) level = "high";
  else level = "very_high";

  return {
    riskScore,
    level,
    points: {
      budgetUtilization: point1,
      expensePerDay: point2,
      transactionFrequency: point3,
      largestTransactionRatio: point4,
      categoryConcentration: point5,
    },
    metrics: {
      budgetUtilization,
      expensePerDay,
      medianExpensePerDay,
      transactionFrequency,
      largestTransactionRatio,
      categoryConcentration,
      days,
      totalIncome,
      totalExpense,
      expenseCount,
    },
  };
}
