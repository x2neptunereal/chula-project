"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  IconUsersGroup,
  IconTrendingUp,
  IconTrendingDown,
  IconMathAvg,
  IconLoader2,
  IconDownload,
  IconArrowLeft,
  IconCalendar,
  IconShieldLock,
  IconPercentage,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useLanguage } from "@/lib/i18n";
import { isAdminEmail } from "@/lib/admin";
import { computeRiskScore } from "@/lib/risk-score";

interface UserSummary {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
}

interface Transaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description?: string;
  category?: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(amount);
}

function StatPill({
  title,
  amount,
  icon: Icon,
  colorClass,
  loading,
}: {
  title: string;
  amount: number;
  icon: React.ElementType;
  colorClass: string;
  loading?: boolean;
}) {
  return (
    <Card className="gap-2">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`flex size-8 items-center justify-center rounded-xl ${colorClass}`}>
            <Icon className="size-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-36" />
        ) : (
          <span className="text-2xl font-bold tracking-tight">{formatCurrency(amount)}</span>
        )}
      </CardContent>
    </Card>
  );
}

function MetricPill({
  title,
  value,
  loading,
}: {
  title: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <Card className="gap-2">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground leading-tight min-h-9 flex items-start">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-7 w-20" /> : <span className="text-xl font-bold tracking-tight">{value}</span>}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [detailTransactions, setDetailTransactions] = useState<Transaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [exportPeriod, setExportPeriod] = useState<"7" | "30" | "60" | "all" | "custom">("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [exporting, setExporting] = useState(false);

  const customRangeValid = !!customStart && !!customEnd && customStart <= customEnd;
  const exportDisabled =
    exporting || (exportPeriod === "custom" && !customRangeValid);

  // Admin gate
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (isAdminEmail(d.user?.email)) {
          setAllowed(true);
        } else {
          router.replace("/overview");
        }
      })
      .catch(() => router.replace("/overview"))
      .finally(() => setCheckingAuth(false));
  }, [router]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) fetchUsers();
  }, [allowed, fetchUsers]);

  const openUser = useCallback((u: UserSummary) => {
    setSelectedUser(u);
  }, []);

  // Re-fetch the selected user's transactions whenever the period selector
  // (the same dropdown that drives the export) changes, so the displayed
  // stats — including Budget Utilization & Risk Score — track the chosen range.
  useEffect(() => {
    if (!selectedUser) return;
    if (exportPeriod === "custom" && !customRangeValid) return;

    let cancelled = false;
    setDetailLoading(true);
    const params = new URLSearchParams({ userId: selectedUser.id, period: exportPeriod });
    if (exportPeriod === "custom") {
      params.set("startDate", customStart);
      params.set("endDate", customEnd);
    }
    fetch(`/api/admin/user-detail?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDetailTransactions(data.transactions ?? []);
      })
      .catch(() => {
        if (!cancelled) setDetailTransactions([]);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUser, exportPeriod, customStart, customEnd, customRangeValid]);

  const detailTotals = useMemo(() => {
    const income = detailTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = detailTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expenses };
  }, [detailTransactions]);

  const spendingRate =
    detailTotals.income > 0 ? (detailTotals.expenses / detailTotals.income) * 100 : 0;

  // Risk Score for the selected user, over the selected period range.
  const riskScore = useMemo(() => {
    const today = new Date();
    let fromDate: Date;
    let toDate: Date;
    if (exportPeriod === "custom" && customRangeValid) {
      fromDate = new Date(customStart);
      toDate = new Date(customEnd);
    } else if (exportPeriod === "all") {
      toDate = today;
      fromDate =
        detailTransactions.length > 0
          ? detailTransactions.reduce(
              (earliest, tx) => (new Date(tx.date) < earliest ? new Date(tx.date) : earliest),
              new Date(detailTransactions[0].date)
            )
          : today;
    } else {
      const dayOffsets: Record<string, number> = { "7": 6, "30": 29, "60": 59 };
      const days = dayOffsets[exportPeriod] ?? 29;
      toDate = today;
      fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - days);
    }
    return computeRiskScore(detailTransactions, fromDate, toDate);
  }, [detailTransactions, exportPeriod, customStart, customEnd, customRangeValid]);

  const riskLevelLabel: Record<typeof riskScore.level, string> = {
    low: t("risk_low"),
    medium: t("risk_medium"),
    high: t("risk_high"),
    very_high: t("risk_very_high"),
  };
  const riskLevelColorClass: Record<typeof riskScore.level, string> = {
    low: "text-emerald-600 dark:text-emerald-400",
    medium: "text-amber-600 dark:text-amber-400",
    high: "text-orange-600 dark:text-orange-400",
    very_high: "text-rose-600 dark:text-rose-400",
  };
  const riskLevelBadgeClass: Record<typeof riskScore.level, string> = {
    low: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    medium: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    high: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    very_high: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  };
  const riskLevelDesc: Record<typeof riskScore.level, string> = {
    low: t("risk_desc_low"),
    medium: t("risk_desc_medium"),
    high: t("risk_desc_high"),
    very_high: t("risk_desc_very_high"),
  };

  async function handleExport() {
    if (!selectedUser) return;
    if (exportPeriod === "custom" && !customRangeValid) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ userId: selectedUser.id, period: exportPeriod });
      if (exportPeriod === "custom") {
        params.set("startDate", customStart);
        params.set("endDate", customEnd);
      }
      const res = await fetch(`/api/admin/export?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? `stats_${selectedUser.username}_${exportPeriod}.txt`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center py-24">
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <IconShieldLock className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin_title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("admin_subtitle")}</p>
        </div>
      </div>

      {!selectedUser ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconUsersGroup className="size-4" /> {t("admin_users")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {usersLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("admin_no_users")}</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openUser(u)}
                    className="flex items-center gap-3 py-3 text-left hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">{u.username}</span>
                      <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(u.totalIncome)}
                      </span>
                      <span className="text-xs text-rose-600 dark:text-rose-400">
                        -{formatCurrency(u.totalExpense)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 w-16 text-right">
                      {u.transactionCount} {t("admin_tx_count_suffix")}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setSelectedUser(null)}>
              <IconArrowLeft className="size-4" /> {t("admin_back_to_users")}
            </Button>

            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={exportPeriod}
                onValueChange={(v) => setExportPeriod(v as "7" | "30" | "60" | "all" | "custom")}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{t("admin_last_7_days")}</SelectItem>
                  <SelectItem value="30">{t("admin_last_30_days")}</SelectItem>
                  <SelectItem value="60">{t("admin_last_60_days")}</SelectItem>
                  <SelectItem value="all">{t("admin_all_time")}</SelectItem>
                  <SelectItem value="custom">{t("admin_custom_range")}</SelectItem>
                </SelectContent>
              </Select>

              {exportPeriod === "custom" && (
                <>
                  <DatePicker
                    value={customStart}
                    onChange={setCustomStart}
                    placeholder={t("start_date")}
                    className="w-36"
                  />
                  <DatePicker
                    value={customEnd}
                    onChange={setCustomEnd}
                    placeholder={t("end_date")}
                    className="w-36"
                  />
                </>
              )}

              <Button size="sm" className="gap-1.5" onClick={handleExport} disabled={exportDisabled}>
                {exporting ? <IconLoader2 className="size-4 animate-spin" /> : <IconDownload className="size-4" />}
                {t("admin_export_txt")}
              </Button>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold">{selectedUser.username}</h2>
            <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatPill
              title={t("total_income")}
              amount={detailTotals.income}
              icon={IconTrendingUp}
              colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
              loading={detailLoading}
            />
            <StatPill
              title={t("total_expenses")}
              amount={detailTotals.expenses}
              icon={IconTrendingDown}
              colorClass="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
              loading={detailLoading}
            />
            <StatPill
              title={t("balance")}
              amount={detailTotals.income - detailTotals.expenses}
              icon={IconMathAvg}
              colorClass="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              loading={detailLoading}
            />
          </div>

          {/* Budget Utilization & Risk Score */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin_budget_utilization_risk")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="gap-2">
                  <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {t("spending_rate")}
                      </CardTitle>
                      <div className="flex size-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                        <IconPercentage className="size-4" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {detailLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <span
                        className={`text-2xl font-bold tracking-tight ${spendingRate > 100 ? "text-rose-600 dark:text-rose-400" : ""
                          }`}
                      >
                        {spendingRate.toFixed(1)}%
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{t("spending_rate_desc")}</p>
                  </CardContent>
                </Card>

                <Card className="gap-2">
                  <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {t("risk_score")}
                      </CardTitle>
                      <div className={`flex size-8 items-center justify-center rounded-xl ${riskLevelBadgeClass[riskScore.level]}`}>
                        <IconAlertTriangle className="size-4" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {detailLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold tracking-tight ${riskLevelColorClass[riskScore.level]}`}>
                          {riskScore.riskScore.toFixed(1)}
                        </span>
                        <Badge variant="outline" className={`${riskLevelBadgeClass[riskScore.level]} border-0`}>
                          {riskLevelLabel[riskScore.level]}
                        </Badge>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{riskLevelDesc[riskScore.level]}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricPill
                  title={t("admin_expense_per_day")}
                  value={formatCurrency(riskScore.metrics.expensePerDay)}
                  loading={detailLoading}
                />
                <MetricPill
                  title={t("admin_transaction_frequency")}
                  value={riskScore.metrics.transactionFrequency.toFixed(2)}
                  loading={detailLoading}
                />
                <MetricPill
                  title={t("admin_largest_transaction_ratio")}
                  value={`${riskScore.metrics.largestTransactionRatio.toFixed(1)}%`}
                  loading={detailLoading}
                />
                <MetricPill
                  title={t("admin_category_concentration")}
                  value={`${riskScore.metrics.categoryConcentration.toFixed(1)}%`}
                  loading={detailLoading}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("transactions")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {detailLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : detailTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{t("no_transactions_yet")}</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {detailTransactions.map((tx) => (
                    <div key={tx._id} className="flex items-center gap-3 py-3">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
                          tx.type === "income"
                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                        }`}
                      >
                        {tx.type === "income" ? (
                          <IconTrendingUp className="size-4" />
                        ) : (
                          <IconTrendingDown className="size-4" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            {tx.description || (tx.type === "income" ? t("income") : t("expense"))}
                          </span>
                          <span
                            className={`text-sm font-semibold shrink-0 ${
                              tx.type === "income"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {tx.type === "income" ? "+" : "-"}
                            {formatCurrency(tx.amount)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <IconCalendar className="size-3 shrink-0" />
                          {new Date(tx.date).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
