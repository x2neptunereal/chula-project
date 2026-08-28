
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
    budgetUtilization: number;
    expensePerDay: number;
    medianExpensePerDay: number;
    transactionFrequency: number;
    largestTransactionRatio: number;
    categoryConcentration: number;
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

  const budgetUtilization = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
  const point1 = Math.min(50, (budgetUtilization / 120) * 50);

  const expensePerDay = totalExpense / days;

  const dailyExpenseMap = new Map<string, number>();
  for (const tx of expenses) {
    const key = dayKey(new Date(tx.date));
    dailyExpenseMap.set(key, (dailyExpenseMap.get(key) ?? 0) + tx.amount);
  }
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
        ? 15
        : 0;

  const transactionFrequency = expenseCount / days;
  const point3 = Math.min(15, (transactionFrequency / 2.5) * 15);

  const largestExpense = expenses.reduce((m, t) => Math.max(m, t.amount), 0);
  const largestTransactionRatio = totalExpense > 0 ? (largestExpense / totalExpense) * 100 : 0;
  const point4 = Math.min(10, (largestTransactionRatio / 70) * 10);

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

export type RecommendationKey =
  | "budget_low_risk_low"
  | "budget_low_risk_medhigh"
  | "budget_mid_risk_low"
  | "budget_mid_risk_medium"
  | "budget_mid_risk_highvhigh"
  | "budget_near_risk_low"
  | "budget_near_risk_medium"
  | "budget_near_risk_highvhigh"
  | "budget_over";

export function getRecommendationKey(
  budgetUtilization: number,
  riskLevel: RiskScoreResult["level"]
): RecommendationKey {
  if (budgetUtilization > 100) return "budget_over";

  if (budgetUtilization < 40) {
    return riskLevel === "low" ? "budget_low_risk_low" : "budget_low_risk_medhigh";
  }

  if (budgetUtilization < 80) {
    if (riskLevel === "low") return "budget_mid_risk_low";
    if (riskLevel === "medium") return "budget_mid_risk_medium";
    return "budget_mid_risk_highvhigh";
  }

  if (riskLevel === "low") return "budget_near_risk_low";
  if (riskLevel === "medium") return "budget_near_risk_medium";
  return "budget_near_risk_highvhigh";
}
