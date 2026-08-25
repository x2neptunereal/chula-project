import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Slip from "@/lib/models/Slip";
import Transaction from "@/lib/models/Transaction";
import { getSession } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

// A naive "yyyy-MM-dd HH:mm" string with no timezone offset is parsed by
// `new Date()` using the *host's* local timezone — which happens to match
// Thailand (UTC+7) on a local dev machine, but is UTC on Vercel, causing
// saved times to shift by 7 hours in production. Explicitly assume Thailand
// time for any string that doesn't already carry an offset ("Z" or
// "+HH:mm"/"-HH:mm"), so parsing is identical regardless of where this runs.
function parseDate(s?: string): Date {
  if (!s) return new Date();
  let iso = s.trim().replace(" ", "T");
  if (!iso.includes("T")) iso += "T00:00:00";
  const hasOffset = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasOffset ? iso : `${iso}+07:00`);
}

// Check if a transaction number is already recorded (duplicate slip detection)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { transactionNumber } = await request.json();

    if (!transactionNumber) {
      return NextResponse.json({ error: "transactionNumber is required" }, { status: 400 });
    }

    await connectDB();

    const existing = await Slip.findOne({
      userId: session.userId,
      transactionNumber,
    }).lean();

    return NextResponse.json({ isDuplicate: !!existing });
  } catch (error) {
    console.error("Slip check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Clear an orphaned slip record so it can be re-uploaded
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { transactionNumber } = await request.json();
    if (!transactionNumber) {
      return NextResponse.json({ error: "transactionNumber is required" }, { status: 400 });
    }
    await connectDB();
    await Slip.deleteOne({ userId: session.userId, transactionNumber });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear slip error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Save a confirmed slip and create the corresponding expense transaction
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { transactionNumber, bank, amount, date, description, category } = await request.json();

    if (!transactionNumber || !amount) {
      return NextResponse.json({ error: "transactionNumber and amount are required" }, { status: 400 });
    }
    if (category && !EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    await connectDB();

    // Double-check for duplicates
    const existing = await Slip.findOne({
      userId: session.userId,
      transactionNumber,
    });
    if (existing) {
      return NextResponse.json({ error: "Duplicate slip already recorded" }, { status: 409 });
    }

    // Create the expense transaction
    const transaction = await Transaction.create({
      userId: session.userId,
      type: "expense",
      amount,
      date: parseDate(date),
      description: description ?? `Slip: ${transactionNumber}`,
      category: category || undefined,
    });

    // Record the slip for future duplicate detection
    await Slip.create({
      userId: session.userId,
      transactionNumber,
      bank: bank ?? "unknown",
      amount,
      date: parseDate(date),
      transactionId: transaction._id,
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Save slip error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
