"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, parseISO, subDays } from "date-fns";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconMathAvg,
  IconLoader2,
  IconPencil,
  IconTrash,
  IconFilter,
  IconCalendar,
  IconX,
  IconCheck,
  IconSearch,
  IconSaladFilled,
  IconCarFilled,
  IconBallpenFilled,
  IconShoppingCartFilled,
  IconDeviceGamepad2Filled,
  IconReceiptFilled,
  IconHeartFilled,
  IconGiftFilled,
  IconDownload,
  IconPercentage,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { EXPENSE_CATEGORIES, CATEGORY_LABEL_KEYS, type ExpenseCategory } from "@/lib/expense-categories";
import { computeRiskScore } from "@/lib/risk-score";

interface Transaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description?: string;
  category?: ExpenseCategory;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(amount);
}

function SummaryCard({
  title,
  amount,
  icon: Icon,
  colorClass,
  loading,
  isBalance,
}: {
  title: string;
  amount: number;
  icon: React.ElementType;
  colorClass: string;
  loading: boolean;
  isBalance?: boolean;
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
          <span
            className={`text-2xl font-bold tracking-tight ${isBalance && amount < 0 ? "text-rose-600 dark:text-rose-400" : ""
              }`}
          >
            {formatCurrency(amount)}
          </span>
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

export default function OverviewPage() {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<("all" | "income") | ExpenseCategory>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  // Edit state
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState<{ type: string; amount: string; date: string; description: string; category: ExpenseCategory | "" }>({ type: "expense", amount: "", date: "", description: "", category: "" });
  const [editLoading, setEditLoading] = useState(false);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Summary range state — drives the stat cards, the chart, and the export
  const [exportPeriod, setExportPeriod] = useState<"7" | "30" | "60" | "90" | "all" | "custom">("all");
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exporting, setExporting] = useState(false);

  const exportRangeValid = !!exportStart && !!exportEnd && exportStart <= exportEnd;
  const exportDisabled = exporting || (exportPeriod === "custom" && !exportRangeValid);

  // Resolve the summary range to concrete yyyy-MM-dd bounds
  const { summaryFrom, summaryTo } = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (exportPeriod === "custom") {
      return exportRangeValid
        ? { summaryFrom: exportStart, summaryTo: exportEnd }
        : { summaryFrom: undefined, summaryTo: undefined };
    }
    if (exportPeriod === "all") {
      return { summaryFrom: undefined, summaryTo: today };
    }
    const days = { "7": 6, "30": 29, "60": 59, "90": 89 }[exportPeriod];
    return {
      summaryFrom: format(subDays(new Date(), days), "yyyy-MM-dd"),
      summaryTo: today,
    };
  }, [exportPeriod, exportStart, exportEnd, exportRangeValid]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch {
      toast.error(t("tx_load_failed"));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const hasFilter = typeFilter !== "all" || !!dateFrom || !!dateTo || !!search;

  const filteredTransactions = transactions.filter((tx) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(q) ||
      String(tx.amount).includes(q)
    );
  });

  // For summary cards + chart: pull transactions scoped to the summary range
  // (same range used by the Export control) separately from the list filters.
  const [summaryTransactions, setSummaryTransactions] = useState<Transaction[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (exportPeriod === "custom" && !exportRangeValid) return;
    setSummaryLoading(true);
    const params = new URLSearchParams();
    if (summaryFrom) params.set("dateFrom", summaryFrom);
    if (summaryTo) params.set("dateTo", summaryTo);
    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setSummaryTransactions(d.transactions ?? []);
      })
      .catch(() => { })
      .finally(() => setSummaryLoading(false));
  }, [summaryFrom, summaryTo, exportPeriod, exportRangeValid, transactions]); // refresh when list changes

  const summaryTotals = {
    income: summaryTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    expenses: summaryTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
  };

  const spendingRate =
    summaryTotals.income > 0 ? (summaryTotals.expenses / summaryTotals.income) * 100 : 0;

  // Risk Score — same summary range as the stat cards / chart / export.
  // "all time" has no explicit lower bound, so fall back to the earliest
  // transaction in the set (or today, if there are none) as the range start.
  const riskScore = useMemo(() => {
    const toDate = summaryTo ? new Date(summaryTo) : new Date();
    let fromDate: Date;
    if (summaryFrom) {
      fromDate = new Date(summaryFrom);
    } else if (summaryTransactions.length > 0) {
      fromDate = summaryTransactions.reduce(
        (earliest, tx) => (new Date(tx.date) < earliest ? new Date(tx.date) : earliest),
        new Date(summaryTransactions[0].date)
      );
    } else {
      fromDate = toDate;
    }
    return computeRiskScore(summaryTransactions, fromDate, toDate);
  }, [summaryTransactions, summaryFrom, summaryTo]);

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

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("tx_deleted"));
      fetchTransactions();
    } catch {
      toast.error(t("tx_delete_failed"));
    }
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filteredTransactions.length
        ? new Set()
        : new Set(filteredTransactions.map((tx) => tx._id))
    );
  }

  async function handleBulkDelete() {
    setBulkDeleteLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("tx_bulk_deleted"));
      setSelectedIds(new Set());
      setSelectMode(false);
      setBulkDeleteOpen(false);
      fetchTransactions();
    } catch {
      toast.error(t("tx_bulk_delete_failed"));
    } finally {
      setBulkDeleteLoading(false);
    }
  }

  async function handleExport() {
    if (exportPeriod === "custom" && !exportRangeValid) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ period: exportPeriod });
      if (exportPeriod === "custom") {
        params.set("startDate", exportStart);
        params.set("endDate", exportEnd);
      }
      const res = await fetch(`/api/export?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? `stats_${exportPeriod}.txt`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("export_failed"));
    } finally {
      setExporting(false);
    }
  }

  function openEdit(tx: Transaction) {
    setEditTx(tx);
    setEditForm({
      type: tx.type,
      amount: String(tx.amount),
      date: tx.date ? format(parseISO(tx.date), "yyyy-MM-dd HH:mm") : "",
      description: tx.description ?? "",
      category: tx.category ?? "",
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTx) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/transactions/${editTx._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editForm.type,
          amount: parseFloat(editForm.amount),
          date: editForm.date || undefined,
          description: editForm.description,
          category: editForm.type === "expense" ? editForm.category : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Request failed");
      }
      toast.success(t("tx_updated"));
      setEditTx(null);
      fetchTransactions();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t("tx_update_failed"));
    } finally {
      setEditLoading(false);
    }
  }

  function clearFilters() {
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("overview_title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("overview_subtitle")}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={exportPeriod}
            onValueChange={(v) => setExportPeriod(v as "7" | "30" | "60" | "90" | "all" | "custom")}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t("admin_last_7_days")}</SelectItem>
              <SelectItem value="30">{t("admin_last_30_days")}</SelectItem>
              <SelectItem value="60">{t("admin_last_60_days")}</SelectItem>
              <SelectItem value="90">{t("admin_last_90_days")}</SelectItem>
              <SelectItem value="all">{t("admin_all_time")}</SelectItem>
              <SelectItem value="custom">{t("admin_custom_range")}</SelectItem>
            </SelectContent>
          </Select>

          {exportPeriod === "custom" && (
            <>
              <DatePicker
                value={exportStart}
                onChange={setExportStart}
                placeholder={t("start_date")}
                className="w-36"
              />
              <DatePicker
                value={exportEnd}
                onChange={setExportEnd}
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          title={t("total_income")}
          amount={summaryTotals.income}
          icon={IconTrendingUp}
          colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          loading={summaryLoading}
        />
        <SummaryCard
          title={t("total_expenses")}
          amount={summaryTotals.expenses}
          icon={IconTrendingDown}
          colorClass="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          loading={summaryLoading}
        />
        <SummaryCard
          title={t("balance")}
          amount={summaryTotals.income - summaryTotals.expenses}
          icon={IconMathAvg}
          colorClass="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          loading={summaryLoading}
          isBalance
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
                {summaryLoading ? (
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
                {summaryLoading ? (
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
                <p className="text-xs text-muted-foreground mt-1">
                  {riskLevelDesc[riskScore.level]}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricPill
              title={t("admin_expense_per_day")}
              value={formatCurrency(riskScore.metrics.expensePerDay)}
              loading={summaryLoading}
            />
            <MetricPill
              title={t("admin_transaction_frequency")}
              value={riskScore.metrics.transactionFrequency.toFixed(2)}
              loading={summaryLoading}
            />
            <MetricPill
              title={t("admin_largest_transaction_ratio")}
              value={`${riskScore.metrics.largestTransactionRatio.toFixed(1)}%`}
              loading={summaryLoading}
            />
            <MetricPill
              title={t("admin_category_concentration")}
              value={`${riskScore.metrics.categoryConcentration.toFixed(1)}%`}
              loading={summaryLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cash flow chart */}
      <CashFlowChart transactions={summaryTransactions} from={summaryFrom} to={summaryTo} />

      {/* Transaction list */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            {/* Title row */}
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("transactions")}</CardTitle>
              <div className="flex items-center gap-1">
                {hasFilter && (
                  <Button variant="ghost" size="xs" onClick={clearFilters} className="gap-1 text-xs">
                    <IconX className="size-3" /> {t("clear")}
                  </Button>
                )}
                {filteredTransactions.length > 0 && (
                  <Button
                    variant={selectMode ? "secondary" : "ghost"}
                    size="xs"
                    onClick={toggleSelectMode}
                    className="gap-1 text-xs"
                  >
                    <IconCheck className="size-3" /> {selectMode ? t("cancel") : t("select")}
                  </Button>
                )}
              </div>
            </div>

            {/* Bulk selection bar */}
            {selectMode && (
              <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={
                      filteredTransactions.length > 0 &&
                      selectedIds.size === filteredTransactions.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size > 0
                      ? `${selectedIds.size} ${t("selected_count")}`
                      : t("select_all")}
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="xs"
                  className="gap-1 text-xs"
                  disabled={selectedIds.size === 0}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <IconTrash className="size-3" /> {t("delete_selected")}
                  {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                </Button>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search_placeholder")}
                className="pl-8 w-full"
              />
            </div>

            {/* Type + date filters */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-1">
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("all_types")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_types")}</SelectItem>
                    <SelectItem value="income">{t("income_only")}</SelectItem>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {t(CATEGORY_LABEL_KEYS[cat])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DatePicker value={dateFrom} onChange={setDateFrom} className="w-full" placeholder={t("start_date")} />
              <DatePicker value={dateTo} onChange={setDateTo} className="w-full" placeholder={t("end_date")} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IconMathAvg stroke={2} className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {hasFilter ? t("no_match_filters") : t("no_transactions_yet")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border -mx-0">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx._id}
                  className={`flex items-center gap-3 py-3 group ${selectMode ? "cursor-pointer" : ""
                    }`}
                  onClick={() => selectMode && toggleSelected(tx._id)}
                >
                  {/* Checkbox (select mode only) */}
                  {selectMode && (
                    <Checkbox
                      checked={selectedIds.has(tx._id)}
                      onCheckedChange={() => toggleSelected(tx._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                  )}

                  {/* Type indicator */}
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${tx.type === "income"
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                      }`}
                  >
                    {tx.type === "income" ? (
                      <IconTrendingUp className="size-4" />
                    ) : (
                      (() => {
                        switch (tx.category) {
                          case "food_drinks":
                            return <IconSaladFilled className="size-4" />;
                          case "travel":
                            return <IconCarFilled className="size-4" />;
                          case "education":
                            return <IconBallpenFilled className="size-4" />;
                          case "shopping":
                            return <IconShoppingCartFilled className="size-4" />;
                          case "entertainment":
                            return <IconDeviceGamepad2Filled className="size-4" />;
                          case "recurring_expenses":
                            return <IconReceiptFilled className="size-4" />;
                          case "health":
                            return <IconHeartFilled className="size-4" />;
                          case "social_gifts":
                            return <IconGiftFilled className="size-4" />;
                          default:
                            return <IconTrendingDown className="size-4" />;
                        }
                      })()
                    )}
                  </div>

                  {/* Info — takes all remaining space */}
                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    {/* Row 1: description + amount */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {tx.description || (tx.type === "income" ? t("income") : t("expense"))}
                      </span>
                      <span className={`text-sm font-semibold shrink-0 ${tx.type === "income"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                        }`}>
                        {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </span>
                    </div>
                    {/* Row 2: date + badge + actions */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1 flex-1 whitespace-nowrap">
                        <IconCalendar className="size-3 shrink-0" />
                        {tx.date ? format(parseISO(tx.date), "d MMM yyyy") : "—"}
                        {tx.date && (
                          <span className="text-muted-foreground/60">· {format(parseISO(tx.date), "HH:mm")}</span>
                        )}
                      </span>
                      {!selectMode && (
                        <>
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground shrink-0" onClick={() => openEdit(tx)}>
                            <IconPencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive shrink-0" onClick={() => handleDelete(tx._id)}>
                            <IconTrash className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editTx} onOpenChange={(open) => !open && setEditTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit_transaction")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("type")}</Label>
              <Select
                value={editForm.type}
                onValueChange={(v) => setEditForm((p) => ({ ...p, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t("income")}</SelectItem>
                  <SelectItem value="expense">{t("expense")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-amount">{t("amount_thb")}</Label>
              <Input
                id="edit-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-date">{t("date")}</Label>
              <DatePicker
                value={editForm.date}
                onChange={(v) => setEditForm((p) => ({ ...p, date: v }))}
                showTime
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-desc">{t("description_optional")}</Label>
              <Input
                id="edit-desc"
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                placeholder={t("eg_grocery")}
              />
            </div>

            {editForm.type === "expense" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-category">{t("expense_category")}</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, category: v as ExpenseCategory }))}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue placeholder={t("select_category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {t(CATEGORY_LABEL_KEYS[cat])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTx(null)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading && <IconLoader2 className="size-4 animate-spin" />}
                <IconCheck className="size-4" />
                {t("save_changes")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm bulk delete dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => !open && setBulkDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirm_bulk_delete_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("confirm_bulk_delete_desc")}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={bulkDeleteLoading}
              onClick={handleBulkDelete}
            >
              {bulkDeleteLoading && <IconLoader2 className="size-4 animate-spin" />}
              <IconTrash className="size-4" />
              {t("delete_selected")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
