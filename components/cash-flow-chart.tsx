"use client";

import { useMemo, useState } from "react";
import { format, parseISO, addDays, subDays, startOfDay } from "date-fns";
import { Area, ComposedChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLanguage } from "@/lib/i18n";

interface Transaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description?: string;
}

type RangePreset = "7d" | "30d" | "90d" | "all" | "custom";

function buildSeries(transactions: Transaction[], from?: string, to?: string) {
  if (transactions.length === 0) return [];

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Daily totals
  const daily: Record<string, { income: number; expense: number }> = {};
  for (const tx of sorted) {
    const key = format(parseISO(tx.date), "yyyy-MM-dd");
    daily[key] ??= { income: 0, expense: 0 };
    if (tx.type === "income") daily[key].income += tx.amount;
    else daily[key].expense += tx.amount;
  }

  const firstDay = startOfDay(parseISO(sorted[0].date));
  const lastDay = startOfDay(new Date());
  const minDate = from ? startOfDay(new Date(from)) : firstDay;
  const maxDate = to ? startOfDay(new Date(to)) : lastDay;

  const points: { date: string; income: number; expense: number; balance: number }[] = [];
  let running = 0;
  let cursor = firstDay;

  while (cursor <= maxDate) {
    const key = format(cursor, "yyyy-MM-dd");
    const d = daily[key] ?? { income: 0, expense: 0 };
    running += d.income - d.expense;
    if (cursor >= minDate) {
      points.push({ date: key, income: d.income, expense: d.expense, balance: running });
    }
    cursor = addDays(cursor, 1);
  }

  return points;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(amount);
}

export function CashFlowChart({ transactions }: { transactions: Transaction[] }) {
  const { t } = useLanguage();
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [visible, setVisible] = useState({ income: true, expense: true, balance: true });

  const { from, to } = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    switch (preset) {
      case "7d":
        return { from: format(subDays(new Date(), 6), "yyyy-MM-dd"), to: today };
      case "30d":
        return { from: format(subDays(new Date(), 29), "yyyy-MM-dd"), to: today };
      case "90d":
        return { from: format(subDays(new Date(), 89), "yyyy-MM-dd"), to: today };
      case "custom":
        return { from: customFrom || undefined, to: customTo || undefined };
      default:
        return { from: undefined, to: undefined };
    }
  }, [preset, customFrom, customTo]);

  const data = useMemo(() => buildSeries(transactions, from, to), [transactions, from, to]);

  const chartConfig: ChartConfig = {
    income: { label: t("total_income"), color: "#10b981" },
    expense: { label: t("total_expenses"), color: "#f43f5e" },
    balance: { label: t("balance"), color: "var(--foreground)" },
  };

  function toggle(key: keyof typeof visible) {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{t("cash_flow")}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{t("cash_flow_subtitle")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(["7d", "30d", "90d", "all"] as const).map((p) => (
              <Button
                key={p}
                size="xs"
                variant={preset === p ? "secondary" : "ghost"}
                onClick={() => setPreset(p)}
                className="text-xs"
              >
                {t(p === "all" ? "range_all" : (`range_${p}` as const))}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom range pickers */}
        <div className="flex items-center gap-2">
          <DatePicker
            value={customFrom}
            onChange={(v) => {
              setCustomFrom(v);
              setPreset("custom");
            }}
            className="w-full"
            placeholder={t("start_date")}
          />
          <DatePicker
            value={customTo}
            onChange={(v) => {
              setCustomTo(v);
              setPreset("custom");
            }}
            className="w-full"
            placeholder={t("end_date")}
          />
        </div>

        {/* Series toggles */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => toggle("income")}
            className={`flex items-center gap-1.5 text-xs transition-opacity ${
              visible.income ? "" : "opacity-40"
            }`}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: chartConfig.income.color }} />
            {t("total_income")}
          </button>
          <button
            type="button"
            onClick={() => toggle("expense")}
            className={`flex items-center gap-1.5 text-xs transition-opacity ${
              visible.expense ? "" : "opacity-40"
            }`}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: chartConfig.expense.color }} />
            {t("total_expenses")}
          </button>
          <button
            type="button"
            onClick={() => toggle("balance")}
            className={`flex items-center gap-1.5 text-xs transition-opacity ${
              visible.balance ? "" : "opacity-40"
            }`}
          >
            <span className="size-2.5 rounded-full bg-foreground" />
            {t("balance")}
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t("no_chart_data")}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => format(parseISO(d), "d MMM")}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) =>
                  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(d) => format(parseISO(String(d)), "d MMM yyyy")}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                }
              />
              {visible.balance && (
                <Area
                  type="monotone"
                  dataKey="balance"
                  name="balance"
                  stroke="var(--color-balance)"
                  strokeWidth={2}
                  fill="url(#balanceFill)"
                  dot={false}
                />
              )}
              {visible.income && (
                <Line
                  type="monotone"
                  dataKey="income"
                  name="income"
                  stroke="var(--color-income)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {visible.expense && (
                <Line
                  type="monotone"
                  dataKey="expense"
                  name="expense"
                  stroke="var(--color-expense)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
