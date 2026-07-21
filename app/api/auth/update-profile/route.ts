import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { getSession, signToken, setSessionCookie } from "@/lib/auth";

/** PUT /api/auth/update-profile — change the signed-in user's display name (username). */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { username } = await request.json();
    const trimmed = typeof username === "string" ? username.trim() : "";

    if (!trimmed) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }
    if (trimmed.length < 2 || trimmed.length > 30) {
      return NextResponse.json({ error: "Username must be 2-30 characters" }, { status: 400 });
    }

    await connectDB();

    const taken = await User.findOne({ username: trimmed, _id: { $ne: session.userId } });
    if (taken) {
      return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    }

    const user = await User.findByIdAndUpdate(
      session.userId,
      { username: trimmed },
      { new: true }
    );
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Re-issue the session token so the new username is reflected right away
    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: { userId: user._id.toString(), email: user.email, username: user.username },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
