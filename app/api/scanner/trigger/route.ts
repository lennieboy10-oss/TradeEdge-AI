import { NextResponse } from "next/server";
import { runScan } from "@/app/lib/scanner-logic";

export const maxDuration = 120;

export async function GET(request: Request) {
  const cronHeader = request.headers.get("x-vercel-cron");
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!cronHeader && !(secret && auth === `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runScan();
  return NextResponse.json(result);
}
