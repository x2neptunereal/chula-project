import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/lib/models/Transaction";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import Slip from "@/lib/models/Slip";
import { getSession } from "@/lib/auth";

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined;
  let iso = s.trim().replace(" ", "T");
  if (!iso.includes("T")) iso += "T00:00:00";
  const hasOffset = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasOffset ? iso : `${iso}+07:00`);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { type, amount, date, description, category } = await request.json();

    if (!type || !amount) {
      return NextResponse.json({ error: "type and amount are required" }, { status: 400 });
    }
    if (category && !EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    await connectDB();

    const normalizedCategory = category ? category : undefined;

    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, userId: session.userId },
      { type, amount, date: parseDate(date), description, category: normalizedCategory },
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Update transaction error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await connectDB();

    const transaction = await Transaction.findOneAndDelete({
      _id: id,
      userId: session.userId,
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    await Slip.deleteOne({ transactionId: transaction._id, userId: session.userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
