"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
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
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

interface Transaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description?: string;
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
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`flex size-8 items-center justify-center rounded-xl ${colorClass}`}>
            <Icon className="size-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {loading ? (
          <Skeleton className="h-8 w-36" />
        ) : (
          <span
            className={`text-2xl font-bold tracking-tight ${
              isBalance && amount < 0 ? "text-rose-600 dark:text-rose-400" : ""
            }`}
          >
            {formatCurrency(amount)}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  // Edit state
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({ type: "expense", amount: "", date: "", description: "" });
  const [editLoading, setEditLoading] = useState(false);

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

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpenses;

  // Use all transactions for summary (no filter), but we only have filtered ones
  // Refetch all for summary separately if filters are active
  const hasFilter = typeFilter !== "all" || !!dateFrom || !!dateTo || !!search;

  const filteredTransactions = transactions.filter((tx) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(q) ||
      String(tx.amount).includes(q)
    );
  });

  // For summary always show all-time totals separately
  const [allTotals, setAllTotals] = useState({ income: 0, expenses: 0 });

  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((d) => {
        const txs: Transaction[] = d.transactions ?? [];
        setAllTotals({
          income: txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
          expenses: txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
        });
      })
      .catch(() => {});
  }, [transactions]); // refresh when list changes

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

  function openEdit(tx: Transaction) {
    setEditTx(tx);
    setEditForm({
      type: tx.type,
      amount: String(tx.amount),
      date: tx.date ? format(parseISO(tx.date), "yyyy-MM-dd HH:mm") : "",
      description: tx.description ?? "",
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
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("tx_updated"));
      setEditTx(null);
      fetchTransactions();
    } catch {
      toast.error(t("tx_update_failed"));
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("overview_title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("overview_subtitle")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          title={t("total_income")}
          amount={allTotals.income}
          icon={IconTrendingUp}
          colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          loading={loading}
        />
        <SummaryCard
          title={t("total_expenses")}
          amount={allTotals.expenses}
          icon={IconTrendingDown}
          colorClass="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          loading={loading}
        />
        <SummaryCard
          title={t("balance")}
          amount={allTotals.income - allTotals.expenses}
          icon={IconMathAvg}
          colorClass="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          loading={loading}
          isBalance
        />
      </div>

      {/* Transaction list */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            {/* Title row */}
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("transactions")}</CardTitle>
              {hasFilter && (
                <Button variant="ghost" size="xs" onClick={clearFilters} className="gap-1 text-xs">
                  <IconX className="size-3" /> {t("clear")}
                </Button>
              )}
            </div>

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
                    <SelectItem value="expense">{t("expenses_only")}</SelectItem>
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
                <div key={tx._id} className="flex items-center gap-3 py-3 group">
                  {/* Type indicator */}
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

                  {/* Info — takes all remaining space */}
                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    {/* Row 1: description + amount */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {tx.description || (tx.type === "income" ? t("income") : t("expense"))}
                      </span>
                      <span className={`text-sm font-semibold shrink-0 ${
                        tx.type === "income"
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
                      <Button variant="ghost" size="icon-sm" className="text-muted-foreground shrink-0" onClick={() => openEdit(tx)}>
                        <IconPencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive shrink-0" onClick={() => handleDelete(tx._id)}>
                        <IconTrash className="size-3.5" />
                      </Button>
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
    </div>
  );
}
