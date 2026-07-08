"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";
import { ADMIN_EMAIL } from "@/lib/admin";

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
}: {
  title: string;
  amount: number;
  icon: React.ElementType;
  colorClass: string;
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
        <span className="text-2xl font-bold tracking-tight">{formatCurrency(amount)}</span>
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

  const [exportPeriod, setExportPeriod] = useState<"7" | "30">("30");
  const [exporting, setExporting] = useState(false);

  // Admin gate
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.email === ADMIN_EMAIL) {
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

  const openUser = useCallback(async (u: UserSummary) => {
    setSelectedUser(u);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/user-detail?userId=${u.id}&period=all`);
      const data = await res.json();
      setDetailTransactions(data.transactions ?? []);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function handleExport() {
    if (!selectedUser) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/export?userId=${selectedUser.id}&period=${exportPeriod}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? `stats_${selectedUser.username}_${exportPeriod}d.txt`;

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

            <div className="flex items-center gap-2">
              <Select value={exportPeriod} onValueChange={(v) => setExportPeriod(v as "7" | "30")}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{t("admin_last_7_days")}</SelectItem>
                  <SelectItem value="30">{t("admin_last_30_days")}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="gap-1.5" onClick={handleExport} disabled={exporting}>
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
              amount={selectedUser.totalIncome}
              icon={IconTrendingUp}
              colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
            />
            <StatPill
              title={t("total_expenses")}
              amount={selectedUser.totalExpense}
              icon={IconTrendingDown}
              colorClass="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
            />
            <StatPill
              title={t("balance")}
              amount={selectedUser.balance}
              icon={IconMathAvg}
              colorClass="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            />
          </div>

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
