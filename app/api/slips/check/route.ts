import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Slip from "@/lib/models/Slip";
import Transaction from "@/lib/models/Transaction";
import { getSession } from "@/lib/auth";

function parseDate(s?: string): Date {
  if (!s) return new Date();
  return new Date(s.replace(" ", "T"));
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
    const { transactionNumber, bank, amount, date, description } = await request.json();

    if (!transactionNumber || !amount) {
      return NextResponse.json({ error: "transactionNumber and amount are required" }, { status: 400 });
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
