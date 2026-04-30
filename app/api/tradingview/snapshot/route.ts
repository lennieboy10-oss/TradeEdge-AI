import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url")?.trim() ?? "";

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Only allow TradingView snapshot domains to prevent SSRF
  const allowed = [
    "s3.tradingview.com",
    "charts.tradingview.com",
    "s.tradingview.com",
    "cdn.tradingview.com",
  ];

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!allowed.some((d) => hostname === d || hostname.endsWith("." + d))) {
    return NextResponse.json(
      { error: "Only TradingView snapshot URLs are supported. Use the camera icon → Copy link in TradingView." },
      { status: 400 }
    );
  }

  try {
    const img = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 ChartIQ/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!img.ok) {
      return NextResponse.json({ error: "Could not fetch image" }, { status: 502 });
    }

    const ct = img.headers.get("content-type") ?? "image/png";
    if (!ct.startsWith("image/")) {
      return NextResponse.json({ error: "URL does not point to an image" }, { status: 400 });
    }

    const buf = await img.arrayBuffer();
    return new NextResponse(buf, {
      headers: { "Content-Type": ct },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
