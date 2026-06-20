"use client";

import { useState } from "react";
import { format } from "date-fns";

function localToISO(dateStr: string): string {
  const [datePart, timePart = "00:00"] = dateStr.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = (timePart || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}
import { IconPlus, IconLoader2, IconCheck, IconTrendingUp } from "@tabler/icons-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { useLanguage } from "@/lib/i18n";

export default function IncomePage() {
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd HH:mm"));
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast.error(t("valid_amount"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "income",
          amount: parsed,
          date: localToISO(date || format(new Date(), "yyyy-MM-dd HH:mm")),
          description: description.trim() || t("income"),
        }),
      });

      if (!res.ok) throw new Error();

      toast.success(t("income_recorded"));
      setSaved(true);
      setAmount("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error(t("income_save_failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("record_income")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("record_income_subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <IconTrendingUp className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">{t("new_income_entry")}</CardTitle>
              <CardDescription>{t("fill_details_below")}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">
                {t("income_amount")} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ฿
                </span>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">{t("date")}</Label>
              <DatePicker value={date} onChange={setDate} showTime />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">{t("description_optional")}</Label>
              <Input
                id="description"
                placeholder={t("eg_salary")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : saved ? (
                <IconCheck className="size-4" />
              ) : (
                <IconPlus className="size-4" />
              )}
              {saved ? t("saved") : t("confirm_save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
