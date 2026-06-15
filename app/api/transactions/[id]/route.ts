import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/lib/models/Transaction";
import Slip from "@/lib/models/Slip";
import { getSession } from "@/lib/auth";

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined;
  return new Date(s.replace(" ", "T"));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { type, amount, date, description } = await request.json();

    if (!type || !amount) {
      return NextResponse.json({ error: "type and amount are required" }, { status: 400 });
    }

    await connectDB();

    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, userId: session.userId },
      { type, amount, date: parseDate(date), description },
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Update transaction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

    // Also remove the linked slip record so the same slip can be re-uploaded later
    await Slip.deleteOne({ transactionId: transaction._id, userId: session.userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
