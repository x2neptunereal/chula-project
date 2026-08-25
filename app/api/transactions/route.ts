import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/lib/models/Transaction";
import { EXPENSE_CATEGORIES, ExpenseCategory } from "@/lib/expense-categories";
import Slip from "@/lib/models/Slip";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "income" | "expense" | null
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { userId: session.userId };

  if (type && (type === "income")) {
    filter.type = type;
  } else if (type && EXPENSE_CATEGORIES.includes(type as ExpenseCategory)) {
    filter.category = type;
  }
  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  const transactions = await Transaction.find(filter).sort({ date: -1 }).lean();

  return NextResponse.json({ transactions });
}

// A naive "yyyy-MM-dd HH:mm" string with no timezone offset is parsed by
// `new Date()` using the *host's* local timezone — which happens to match
// Thailand (UTC+7) on a local dev machine, but is UTC on Vercel, causing
// saved times to shift by 7 hours in production. Explicitly assume Thailand
// time for any string that doesn't already carry an offset ("Z" or
// "+HH:mm"/"-HH:mm"), so parsing is identical regardless of where this runs.
/** Accepts "yyyy-MM-dd", "yyyy-MM-dd HH:mm", or full ISO strings */
function parseDate(s?: string): Date {
  if (!s) return new Date();
  let iso = s.trim().replace(" ", "T");
  if (!iso.includes("T")) iso += "T00:00:00";
  const hasOffset = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasOffset ? iso : `${iso}+07:00`);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { type, amount, date, description, category } = await request.json();

    if (!type || !amount) {
      return NextResponse.json({ error: "type and amount are required" }, { status: 400 });
    }
    if (!["income", "expense"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }
    if (category && !EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    await connectDB();

    // Mongoose's enum validator rejects "" outright (only `undefined` counts as
    // "unset"), so normalize a blank category before saving — otherwise income
    // transactions, or expenses submitted without picking a category, fail.
    const normalizedCategory = category ? category : undefined;

    const transaction = await Transaction.create({
      userId: session.userId,
      type,
      amount,
      date: parseDate(date),
      description: description ?? "",
      category: normalizedCategory,
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Create transaction error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Bulk delete — body: { ids: string[] } */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    await connectDB();

    const result = await Transaction.deleteMany({
      _id: { $in: ids },
      userId: session.userId,
    });

    // Also remove any linked slip records so those slips can be re-uploaded later
    await Slip.deleteMany({ transactionId: { $in: ids }, userId: session.userId });

    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Bulk delete transactions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
