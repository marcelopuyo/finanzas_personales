import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/backend/src/lib/auth";

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
