import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/lib/models/Transaction";
import User from "@/lib/models/User";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

/** GET /api/admin/user-detail?userId=...&period=7|30|all — admin only. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const period = (searchParams.get("period") ?? "all") as "7" | "30" | "all";

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  await connectDB();

  const user = await User.findById(userId).lean();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { userId };
  if (period !== "all") {
    const days = period === "7" ? 7 : 30;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    filter.date = { $gte: start };
  }

  const transactions = await Transaction.find(filter).sort({ date: -1 }).lean();

  return NextResponse.json({
    user: { id: String(user._id), username: user.username, email: user.email },
    transactions,
  });
}
