"use client";

import { useState, useRef, useCallback } from "react";
import { format } from "date-fns";
import {
  IconMinus,
  IconLoader2,
  IconCheck,
  IconUpload,
  IconAlertTriangle,
  IconScan,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { parseSlipText, type ParsedSlip, type BankType } from "@/lib/slip-parser";
import { DatePicker } from "@/components/ui/date-picker";

// ─── Timezone helper ──────────────────────────────────────────────────────────
// new Date("yyyy-MM-dd HH:mm") is parsed as UTC on Node.js (Vercel) but local
// in browsers, causing a +7h shift. Using Date(y,m,d,h,min) always gives local
// time, then .toISOString() sends a proper UTC timestamp to the server.
function localToISO(dateStr: string): string {
  const [datePart, timePart = "00:00"] = dateStr.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = (timePart || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

// ─── Constants ───────────────────────────────────────────────────────────────
const BANK_LABELS: Record<BankType, string> = {
  krungthai: "Krungthai",
  truemoney: "TrueMoney",
  kbank: "K-Bank",
  unknown: "Unknown",
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface SlipEntry {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "scanning" | "done" | "duplicate" | "error";
  parsed: ParsedSlip | null;
  rawText?: string;
  // editable fields
  amount: string;
  date: string;
  description: string;
  transactionNumber: string;
  bank: BankType;
  errorMsg?: string;
}

// ─── OpenCV + Tesseract loaders ──────────────────────────────────────────────
let cvReady = false;
async function loadOpenCV(): Promise<void> {
  if (cvReady || typeof window === "undefined") return;
  return new Promise((resolve) => {
    if ((window as Window & { cv?: unknown }).cv) { cvReady = true; resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js";
    script.async = true;
    script.onload = () => { cvReady = true; resolve(); };
    script.onerror = () => resolve(); // fail silently, OCR still works without it
    document.body.appendChild(script);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CV = any;

async function preprocessImage(imgEl: HTMLImageElement): Promise<HTMLCanvasElement> {
  // Scale up 2× — Tesseract accuracy improves significantly at higher resolution.
  // Bank slip backgrounds (TrueMoney waves, Krungthai watermarks) are destroyed by
  // aggressive binary thresholding, so we only convert to grayscale and let Tesseract
  // handle the rest with its own internal thresholding.
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = imgEl.naturalWidth * scale;
  canvas.height = imgEl.naturalHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

  // Grayscale only — no harsh thresholding
  const cv: CV = (window as Window & { cv?: CV }).cv;
  if (cv) {
    try {
      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.imshow(canvas, gray);
      src.delete();
      gray.delete();
      return canvas;
    } catch {
      // fall through to manual grayscale
    }
  }

  // Fallback: manual grayscale via Canvas API
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = g;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function runOCR(canvas: HTMLCanvasElement): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["tha", "eng"]);
  const { data: { text } } = await worker.recognize(canvas);
  await worker.terminate();
  return text;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExpensesPage() {
  // Manual entry
  const [manualAmount, setManualAmount] = useState("");
  const [manualDate, setManualDate] = useState(format(new Date(), "yyyy-MM-dd HH:mm"));
  const [manualDesc, setManualDesc] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSaved, setManualSaved] = useState(false);

  // Slip upload
  const [slips, setSlips] = useState<SlipEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Manual submit ──────────────────────────────────────────────────────────
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(manualAmount);
    if (!parsed || parsed <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setManualLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "expense",
          amount: parsed,
          date: localToISO(manualDate || format(new Date(), "yyyy-MM-dd HH:mm")),
          description: manualDesc.trim() || "Expense",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Expense recorded");
      setManualSaved(true);
      setManualAmount("");
      setManualDate(format(new Date(), "yyyy-MM-dd"));
      setManualDesc("");
      setTimeout(() => setManualSaved(false), 2000);
    } catch {
      toast.error("Failed to save expense");
    } finally {
      setManualLoading(false);
    }
  }

  // ── Slip file handling ─────────────────────────────────────────────────────
  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) { toast.error("Please upload image files only"); return; }

    const newEntries: SlipEntry[] = arr.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
      parsed: null,
      amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      transactionNumber: "",
      bank: "unknown",
    }));

    setSlips((prev) => [...prev, ...newEntries]);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }

  function removeSlip(id: string) {
    setSlips((prev) => prev.filter((s) => s.id !== id));
  }

  function updateSlip(id: string, patch: Partial<SlipEntry>) {
    setSlips((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  // ── OCR + parse a single slip ──────────────────────────────────────────────
  const scanSlip = useCallback(async (slip: SlipEntry) => {
    updateSlip(slip.id, { status: "scanning" });

    try {
      await loadOpenCV(); // optional — used only for grayscale conversion; canvas fallback is fine too

      // Load image
      const img = new Image();
      img.src = slip.preview;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Failed to load image"));
      });

      const canvas = await preprocessImage(img);
      const text = await runOCR(canvas);
      console.log("[OCR raw text]", text); // debug: see what Tesseract extracted
      const parsed = parseSlipText(text);

      // Duplicate check
      if (parsed.transactionNumber) {
        const checkRes = await fetch("/api/slips/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionNumber: parsed.transactionNumber }),
        });
        const checkData = await checkRes.json();
        if (checkData.isDuplicate) {
          updateSlip(slip.id, {
            status: "duplicate",
            parsed,
            rawText: text,
            transactionNumber: parsed.transactionNumber ?? "",
            errorMsg: "This slip has already been recorded.",
          });
          return;
        }
      }

      updateSlip(slip.id, {
        status: "done",
        parsed,
        rawText: text,
        transactionNumber: parsed.transactionNumber ?? "",
        amount: parsed.amount ? String(parsed.amount) : "",
        // Use full date+time from OCR; fall back to current datetime only if nothing was parsed
        date: format(parsed.date ?? new Date(), "yyyy-MM-dd HH:mm"),
        bank: parsed.bank,
        description: `Slip (${BANK_LABELS[parsed.bank]})`,
      });
    } catch (err) {
      updateSlip(slip.id, {
        status: "error",
        errorMsg: err instanceof Error ? err.message : "OCR failed",
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function scanAll() {
    const pending = slips.filter((s) => s.status === "pending");
    if (!pending.length) { toast.info("No slips to scan"); return; }
    for (const slip of pending) {
      await scanSlip(slip);
    }
    toast.success(`Scanned ${pending.length} slip(s)`);
  }

  // ── Save confirmed slips ───────────────────────────────────────────────────
  async function saveSlips() {
    const ready = slips.filter((s) => s.status === "done");
    if (!ready.length) { toast.info("No confirmed slips to save"); return; }

    let saved = 0;
    for (const slip of ready) {
      const amount = parseFloat(slip.amount);
      if (!amount || amount <= 0) {
        toast.error(`Invalid amount for slip ${slip.transactionNumber || slip.file.name}`);
        continue;
      }
      try {
        const res = await fetch("/api/slips/check", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionNumber: slip.transactionNumber || `manual-${Date.now()}`,
            bank: slip.bank,
            amount,
            date: localToISO(slip.date),
            description: slip.description || `Slip (${BANK_LABELS[slip.bank]})`,
          }),
        });
        if (res.ok) {
          saved++;
          removeSlip(slip.id);
        } else {
          const d = await res.json();
          toast.error(d.error ?? "Failed to save slip");
        }
      } catch {
        toast.error("Network error saving slip");
      }
    }

    if (saved > 0) toast.success(`${saved} expense(s) saved from slips`);
  }

  const pendingCount = slips.filter((s) => s.status === "pending").length;
  const doneCount = slips.filter((s) => s.status === "done").length;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Record Expenses</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Enter manually or upload bank slips</p>
      </div>

      {/* ── Manual entry ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
              <IconMinus className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">Manual Entry</CardTitle>
              <CardDescription>Enter expense details directly</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-amount">
                  Amount (THB) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">฿</span>
                  <Input
                    id="m-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="pl-7"
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-date">Date</Label>
                <DatePicker
                  value={manualDate}
                  onChange={setManualDate}
                  showTime
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-desc">Description (optional)</Label>
              <Input
                id="m-desc"
                placeholder="e.g. Grocery shopping, Electricity bill…"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full sm:w-auto sm:self-end gap-2 bg-rose-600 hover:bg-rose-700 text-white"
              disabled={manualLoading}
            >
              {manualLoading ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : manualSaved ? (
                <IconCheck className="size-4" />
              ) : (
                <IconPlus className="size-4" />
              )}
              {manualSaved ? "Saved!" : "Confirm & Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Slip upload ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <IconScan className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">Upload Bank Slips</CardTitle>
              <CardDescription>
                Supports Krungthai, TrueMoney, and K-Bank. Duplicate slips are automatically detected.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 px-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
              <IconUpload className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Drop slip images here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WEBP — multiple files supported</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Slip list */}
          {slips.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{slips.length} slip(s) loaded</span>
                <div className="flex gap-2">
                  {pendingCount > 0 && (
                    <Button size="sm" variant="outline" onClick={scanAll} className="gap-1.5 text-xs">
                      <IconScan className="size-3.5" />
                      Scan {pendingCount} slip(s)
                    </Button>
                  )}
                  {doneCount > 0 && (
                    <Button size="sm" onClick={saveSlips} className="gap-1.5 text-xs">
                      <IconCheck className="size-3.5" />
                      Confirm {doneCount} expense(s)
                    </Button>
                  )}
                </div>
              </div>

              {slips.map((slip) => (
                <SlipCard
                  key={slip.id}
                  slip={slip}
                  onRemove={() => removeSlip(slip.id)}
                  onScan={() => scanSlip(slip)}
                  onUpdate={(patch) => updateSlip(slip.id, patch)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── SlipCard ─────────────────────────────────────────────────────────────────
function SlipCard({
  slip,
  onRemove,
  onScan,
  onUpdate,
}: {
  slip: SlipEntry;
  onRemove: () => void;
  onScan: () => void;
  onUpdate: (patch: Partial<SlipEntry>) => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const statusColors: Record<SlipEntry["status"], string> = {
    pending: "bg-zinc-100 text-zinc-600",
    scanning: "bg-amber-100 text-amber-700",
    done: "bg-emerald-100 text-emerald-700",
    duplicate: "bg-orange-100 text-orange-700",
    error: "bg-rose-100 text-rose-700",
  };
  const statusLabels: Record<SlipEntry["status"], string> = {
    pending: "Pending scan",
    scanning: "Scanning…",
    done: "Ready",
    duplicate: "Duplicate",
    error: "Error",
  };

  return (
    <div className="rounded-2xl border bg-card p-4 flex flex-col gap-3">
      {/* ── Lightbox overlay ── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slip.preview}
            alt="slip enlarged"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Thumbnail — click to enlarge */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slip.preview}
          alt="slip"
          className="size-16 rounded-xl object-cover border shrink-0 cursor-zoom-in hover:opacity-80 transition-opacity"
          onClick={() => setLightboxOpen(true)}
        />

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{slip.file.name}</span>
            <Badge className={`${statusColors[slip.status]} ml-auto shrink-0`}>
              {statusLabels[slip.status]}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {(slip.file.size / 1024).toFixed(0)} KB
          </span>
          {slip.status === "pending" && (
            <Button size="xs" variant="outline" onClick={onScan} className="w-fit gap-1 mt-1 text-xs">
              <IconScan className="size-3" /> Scan
            </Button>
          )}
          {slip.status === "scanning" && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
              <IconLoader2 className="size-3 animate-spin" /> Running OCR…
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground"
          onClick={onRemove}
        >
          <IconTrash className="size-3.5" />
        </Button>
      </div>

      {/* Duplicate / error notice */}
      {(slip.status === "duplicate" || slip.status === "error") && (
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
          slip.status === "duplicate"
            ? "bg-orange-50 text-orange-700 dark:bg-orange-900/20"
            : "bg-rose-50 text-rose-700 dark:bg-rose-900/20"
        }`}>
          <IconAlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <span className="flex-1">{slip.errorMsg}</span>
          {slip.status === "duplicate" && slip.transactionNumber && (
            <button
              type="button"
              className="underline underline-offset-2 shrink-0 font-medium hover:opacity-70"
              onClick={async () => {
                await fetch("/api/slips/check", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ transactionNumber: slip.transactionNumber }),
                });
                onScan(); // re-scan now that the record is cleared
              }}
            >
              Clear &amp; retry
            </button>
          )}
        </div>
      )}

      {/* Editable fields when OCR is done */}
      {slip.status === "done" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Transaction No.</Label>
            <Input
              className="h-7 text-xs"
              value={slip.transactionNumber}
              onChange={(e) => onUpdate({ transactionNumber: e.target.value })}
              placeholder="e.g. REF123456"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Bank</Label>
            <Input
              className="h-7 text-xs"
              value={BANK_LABELS[slip.bank]}
              readOnly
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Amount (THB) *</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">฿</span>
              <Input
                className="h-7 text-xs pl-6"
                type="number"
                min="0.01"
                step="0.01"
                value={slip.amount}
                onChange={(e) => onUpdate({ amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Date</Label>
            <DatePicker
              value={slip.date}
              onChange={(v) => onUpdate({ date: v })}
              size="sm"
              showTime
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Input
              className="h-7 text-xs"
              value={slip.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="e.g. Payment for groceries"
            />
          </div>

          {/* Raw OCR text — for debugging empty results */}
          {slip.rawText !== undefined && (
            <div className="sm:col-span-2 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground text-left underline underline-offset-2 w-fit"
              >
                {showRaw ? "Hide" : "Show"} raw OCR text
              </button>
              {showRaw && (
                <textarea
                  readOnly
                  value={slip.rawText || "(empty — OCR returned no text)"}
                  className="w-full text-xs font-mono rounded-lg border bg-muted/40 p-2 resize-none h-32 text-muted-foreground"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
