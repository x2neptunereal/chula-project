import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Transaction, { type ITransaction } from "@/lib/models/Transaction";
import User from "@/lib/models/User";
import { getSession } from "@/lib/auth";
import { computeStatBlock, periodToStartDate, type StatBlock } from "@/lib/stats";

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " บาท";
}

function statBlockLines(label: string, s: StatBlock): string[] {
  return [
    `${label}`,
    `  ยอดรวม (Total):     ${fmt(s.total)}`,
    `  จำนวนรายการ (Count): ${s.count}`,
    `  เฉลี่ย (Average):    ${fmt(s.average)}`,
    `  มัธยฐาน (Median):    ${fmt(s.median)}`,
    `  ฐานนิยม (Mode):      ${s.mode.length ? s.mode.map(fmt).join(", ") : "-"}`,
    `  สูงสุด (Max):        ${fmt(s.max)}`,
    `  ต่ำสุด (Min):        ${fmt(s.min)}`,
    "",
  ];
}

const CATEGORY_TH: Record<string, string> = {
  entertainment: "ความบันเทิง",
  shopping: "ช้อปปิ้ง",
  investment_transport_recurring: "ลงทุน/เดินทาง/ค่าใช้จ่ายประจำ",
  basic_utilities: "สาธารณูปโภคขั้นพื้นฐาน",
};

/**
 * GET /api/export?period=7|30|custom
 * When period=custom, also requires startDate=yyyy-MM-dd&endDate=yyyy-MM-dd.
 * Self-service export — returns a plain .txt report for the signed-in user's own data.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;
  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period");

  let startDate: Date | null;
  let endDate: Date;
  let periodLabel: string;
  let fileTag: string;

  if (periodParam === "custom") {
    const startParam = searchParams.get("startDate");
    const endParam = searchParams.get("endDate");
    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: "startDate and endDate are required for a custom range" },
        { status: 400 }
      );
    }
    startDate = new Date(`${startParam}T00:00:00.000`);
    endDate = new Date(`${endParam}T23:59:59.999`);
    if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    periodLabel = `Custom (${startParam} to ${endParam})`;
    fileTag = `custom_${startParam}_to_${endParam}`;
  } else {
    const period = periodParam === "7" ? "7" : "30"; // only 7 or 30 allowed, default 30
    startDate = periodToStartDate(period);
    endDate = new Date();
    periodLabel = `Last ${period} days`;
    fileTag = `${period}d`;
  }

  await connectDB();

  const user = await User.findById(userId).lean();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const transactions = (await Transaction.find({
    userId,
    ...(startDate ? { date: { $gte: startDate, $lte: endDate } } : {}),
  })
    .sort({ date: 1 }) // sort by time, oldest first
    .lean()) as unknown as ITransaction[];

  const incomeAmounts = transactions.filter((t) => t.type === "income").map((t) => t.amount);
  const expenseAmounts = transactions.filter((t) => t.type === "expense").map((t) => t.amount);

  const incomeStats = computeStatBlock(incomeAmounts);
  const expenseStats = computeStatBlock(expenseAmounts);
  const balance = incomeStats.total - expenseStats.total;
  const now = new Date();

  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push("รายงานสรุปสถิติทางการเงิน (Financial Summary Report)");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(`ผู้ใช้ (User):        ${user.username} (${user.email})`);
  lines.push(`ช่วงเวลา (Period):    ${periodLabel}`);
  lines.push(
    `ตั้งแต่ - ถึง (Range): ${startDate ? startDate.toISOString().slice(0, 10) : "-"} to ${endDate
      .toISOString()
      .slice(0, 10)}`
  );
  lines.push(`สร้างเมื่อ (Generated): ${now.toISOString()}`);
  lines.push("");
  lines.push("-".repeat(60));
  lines.push("");
  lines.push(...statBlockLines("รายรับ (Income)", incomeStats));
  lines.push(...statBlockLines("รายจ่าย (Expense)", expenseStats));
  lines.push("-".repeat(60));
  lines.push(`ยอดคงเหลือ (Balance): ${fmt(balance)}`);
  lines.push("-".repeat(60));
  lines.push("");
  lines.push(`รายการธุรกรรมทั้งหมด (All Transactions, sorted by time) — ${transactions.length} รายการ`);
  lines.push("");

  if (transactions.length === 0) {
    lines.push("(ไม่มีรายการในช่วงเวลานี้ / No transactions in this period)");
  } else {
    transactions.forEach((tx, i) => {
      const dt = new Date(tx.date).toISOString().slice(0, 16).replace("T", " ");
      const typeLabel = tx.type === "income" ? "รายรับ" : "รายจ่าย";
      const sign = tx.type === "income" ? "+" : "-";
      const category = tx.type === "expense" && tx.category ? CATEGORY_TH[tx.category] ?? tx.category : "";
      const desc = tx.description ? ` | ${tx.description}` : "";
      const catStr = category ? ` | ${category}` : "";
      lines.push(
        `${String(i + 1).padStart(3, " ")}. ${dt} | ${typeLabel} | ${sign}${fmt(tx.amount)}${catStr}${desc}`
      );
    });
  }

  lines.push("");
  lines.push("=".repeat(60));

  const body = lines.join("\n");
  const safeName = user.username.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `stats_${safeName}_${fileTag}_${now.toISOString().slice(0, 10)}.txt`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
