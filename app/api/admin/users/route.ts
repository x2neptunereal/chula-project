import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/lib/models/Transaction";
import User from "@/lib/models/User";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

/** GET /api/admin/users — list every user with aggregate income/expense stats. Admin only. */
export async function GET() {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  const users = await User.find().sort({ createdAt: -1 }).lean();

  const totals = await Transaction.aggregate([
    {
      $group: {
        _id: { userId: "$userId", type: "$type" },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const statsByUser = new Map<
    string,
    { income: number; expense: number; incomeCount: number; expenseCount: number }
  >();

  for (const row of totals) {
    const uid = String(row._id.userId);
    const entry = statsByUser.get(uid) ?? { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
    if (row._id.type === "income") {
      entry.income = row.total;
      entry.incomeCount = row.count;
    } else {
      entry.expense = row.total;
      entry.expenseCount = row.count;
    }
    statsByUser.set(uid, entry);
  }

  const result = users.map((u) => {
    const stats = statsByUser.get(String(u._id)) ?? {
      income: 0,
      expense: 0,
      incomeCount: 0,
      expenseCount: 0,
    };
    return {
      id: String(u._id),
      username: u.username,
      email: u.email,
      createdAt: u.createdAt,
      totalIncome: stats.income,
      totalExpense: stats.expense,
      balance: stats.income - stats.expense,
      transactionCount: stats.incomeCount + stats.expenseCount,
    };
  });

  return NextResponse.json({ users: result });
}
