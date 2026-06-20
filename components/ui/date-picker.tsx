"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { IconCalendar, IconClock } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/lib/i18n";

interface DatePickerProps {
  /**
   * Controlled value.
   * Without showTime: "yyyy-MM-dd"
   * With showTime:    "yyyy-MM-dd HH:mm"
   */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Match the small height used in slip cards */
  size?: "default" | "sm";
  disabled?: boolean;
  /** Also show an hour / minute picker below the calendar */
  showTime?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
  size = "default",
  disabled,
  showTime = false,
}: DatePickerProps) {
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const resolvedPlaceholder = placeholder ?? t("pick_a_date");

  // ── Parse incoming value ────────────────────────────────────────────────────
  const { datePart, timePart } = React.useMemo(() => {
    if (!value) return { datePart: "", timePart: "00:00" };
    if (showTime && value.includes(" ")) {
      const [d, t] = value.split(" ");
      return { datePart: d, timePart: t ?? "00:00" };
    }
    return { datePart: value, timePart: "00:00" };
  }, [value, showTime]);

  const selected = React.useMemo(() => {
    if (!datePart) return undefined;
    const d = parse(datePart, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [datePart]);

  const [hour, minute] = timePart.split(":").map(Number);

  // ── Emit helper ─────────────────────────────────────────────────────────────
  function emit(day: Date | undefined, h: number, m: number) {
    if (!day) return;
    const dateStr = format(day, "yyyy-MM-dd");
    if (showTime) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      onChange(`${dateStr} ${hh}:${mm}`);
    } else {
      onChange(dateStr);
    }
  }

  function handleSelectDay(day: Date | undefined) {
    if (!day) return;
    emit(day, hour, minute);
    if (!showTime) setOpen(false); // auto-close when no time picker
  }

  function handleHour(delta: number) {
    const next = (hour + delta + 24) % 24;
    emit(selected, next, minute);
  }

  function handleMinute(delta: number) {
    const next = (minute + delta + 60) % 60;
    emit(selected, hour, next);
  }

  // ── Display label ────────────────────────────────────────────────────────────
  const label = React.useMemo(() => {
    if (!selected) return null;
    const dateLabel = format(selected, "MM/dd/yyyy");
    if (showTime) {
      const hh = String(hour).padStart(2, "0");
      const mm = String(minute).padStart(2, "0");
      return `${dateLabel}  ${hh}:${mm}`;
    }
    return dateLabel;
  }, [selected, showTime, hour, minute]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center rounded-lg border border-input bg-transparent px-3 text-sm transition-colors",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-input dark:border-transparent dark:focus-visible:border-ring",
            size === "sm" ? "h-7 gap-1.5 px-2.5 text-xs" : "h-9 gap-2",
            !selected ? "text-muted-foreground dark:text-foreground/50" : "text-foreground",
            className
          )}
        >
          <IconCalendar className={cn("shrink-0 text-muted-foreground", size === "sm" ? "size-3" : "size-4")} />
          {label ?? resolvedPlaceholder}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelectDay}
          defaultMonth={selected}
          initialFocus
        />

        {/* ── Time picker ─────────────────────────────────────────────────── */}
        {showTime && (
          <div className="border-t px-3 py-2.5 flex items-center gap-3">
            <IconClock className="size-4 text-muted-foreground shrink-0" />

            {/* Hour */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleHour(-1)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground text-xs select-none"
              >
                ‹
              </button>
              <span className="w-8 text-center text-sm font-mono tabular-nums">
                {String(hour).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => handleHour(1)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground text-xs select-none"
              >
                ›
              </button>
            </div>

            <span className="text-muted-foreground font-mono">:</span>

            {/* Minute */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleMinute(-5)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground text-xs select-none"
              >
                ‹
              </button>
              <span className="w-8 text-center text-sm font-mono tabular-nums">
                {String(minute).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => handleMinute(5)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground text-xs select-none"
              >
                ›
              </button>
            </div>

            <Button
              size="xs"
              className="ml-auto"
              onClick={() => setOpen(false)}
            >
              {t("done")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
