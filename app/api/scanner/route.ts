import { NextResponse } from "next/server";
import { runScan, getLatestResults } from "@/app/lib/scanner-logic";

export const maxDuration = 120;

export async function GET() {
  try {
    const results = await getLatestResults();
    const lastScan = results.length > 0 ? results[0].created_at : null;
    return NextResponse.json({ results, lastScan });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await runScan();
    const results = await getLatestResults();
    const lastScan = results.length > 0 ? results[0].created_at : null;
    return NextResponse.json({ ...result, results, lastScan });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
