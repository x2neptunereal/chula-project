import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/lib/models/Transaction";
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

  if (type && (type === "income" || type === "expense")) {
    filter.type = type;
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

/** Accepts "yyyy-MM-dd", "yyyy-MM-dd HH:mm", or full ISO strings */
function parseDate(s?: string): Date {
  if (!s) return new Date();
  return new Date(s.replace(" ", "T"));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { type, amount, date, description } = await request.json();

    if (!type || !amount) {
      return NextResponse.json({ error: "type and amount are required" }, { status: 400 });
    }
    if (!["income", "expense"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    await connectDB();

    const transaction = await Transaction.create({
      userId: session.userId,
      type,
      amount,
      date: parseDate(date),
      description: description ?? "",
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Create transaction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
