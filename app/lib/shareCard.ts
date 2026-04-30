export interface ShareCardParams {
  asset: string | null;
  timeframe: string;
  signal: "LONG" | "SHORT" | "NEUTRAL";
  grade: string;
  entry: string;
  stopLoss: string;
  takeProfit: string;
  riskReward: string;
  confidence: number;
  summary: string;
  chartBase64: string | null;
  chartMime: string;
  isPro: boolean;
  landscape?: boolean;
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, maxW: number, lh: number, maxLines: number
) {
  const words = text.split(" ");
  let line = "";
  let n = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      if (n >= maxLines - 1) {
        let l = line;
        while (ctx.measureText(`${l}…`).width > maxW && l.length > 0) l = l.slice(0, -1);
        ctx.fillText(`${l}…`, x, y + n * lh);
        return;
      }
      ctx.fillText(line, x, y + n * lh);
      line = word; n++;
    } else { line = test; }
  }
  if (line && n < maxLines) ctx.fillText(line, x, y + n * lh);
}

export async function generateShareCard(params: ShareCardParams): Promise<string> {
  await document.fonts.ready;
  try {
    await Promise.all([
      document.fonts.load("bold 68px 'Bebas Neue'"),
      document.fonts.load("bold 12px 'DM Mono'"),
    ]);
  } catch { /* fallback ok */ }

  const { landscape = false } = params;
  const W = landscape ? 1920 : 1080;
  const H = 1080;
  const M = 54; // margin

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Background ────────────────────────────────────────────────
  ctx.fillStyle = "#080c0a";
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "rgba(0,230,118,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Glow accent top-left
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 400);
  grd.addColorStop(0, "rgba(0,230,118,0.07)");
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // ── Header ────────────────────────────────────────────────────
  ctx.font = "bold 30px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText("ChartIQ", M, 66);
  const logoW = ctx.measureText("ChartIQ").width;
  ctx.fillStyle = "#00e676";
  ctx.fillText(" AI", M + logoW, 66);

  const tagText = "AI CHART ANALYSIS";
  ctx.font = "bold 11px 'DM Mono', 'Courier New', monospace";
  const tagW = ctx.measureText(tagText).width + 24;
  const tagX = W - M - tagW;
  ctx.fillStyle = "rgba(0,230,118,0.1)";
  rrect(ctx, tagX, 46, tagW, 26, 13); ctx.fill();
  ctx.strokeStyle = "rgba(0,230,118,0.35)"; ctx.lineWidth = 1;
  rrect(ctx, tagX, 46, tagW, 26, 13); ctx.stroke();
  ctx.fillStyle = "#00e676";
  ctx.fillText(tagText, tagX + 12, 64);

  ctx.strokeStyle = "rgba(0,230,118,0.28)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(M, 88); ctx.lineTo(W - M, 88); ctx.stroke();

  // ── Chart image ───────────────────────────────────────────────
  const cX = M;
  const cY = 106;
  const cW = landscape ? Math.round(W * 0.52) - M : W - 2 * M;
  const cH = landscape ? H - 106 - 128 : 388;

  ctx.shadowColor = "rgba(0,230,118,0.2)"; ctx.shadowBlur = 14;
  ctx.strokeStyle = "rgba(0,230,118,0.32)"; ctx.lineWidth = 1.5;
  rrect(ctx, cX, cY, cW, cH, 12); ctx.stroke();
  ctx.shadowBlur = 0;

  if (params.chartBase64) {
    const img = new Image();
    img.src = `data:${params.chartMime || "image/png"};base64,${params.chartBase64}`;
    await new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); });
    ctx.save();
    rrect(ctx, cX + 2, cY + 2, cW - 4, cH - 4, 10); ctx.clip();
    const sc = Math.max(cW / img.width, cH / img.height);
    const dw = img.width * sc, dh = img.height * sc;
    ctx.drawImage(img, cX + (cW - dw) / 2, cY + (cH - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    rrect(ctx, cX, cY, cW, cH, 12); ctx.fill();
    ctx.fillStyle = "#374151"; ctx.font = "16px 'DM Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("Chart not available", cX + cW / 2, cY + cH / 2); ctx.textAlign = "left";
  }

  // ── Analysis section ──────────────────────────────────────────
  const aX = landscape ? cX + cW + 30 : M;
  const aY = landscape ? cY : cY + cH + 20;
  const aW = landscape ? W - (cX + cW + 30) - M : W - 2 * M;

  // Asset name
  ctx.font = "68px 'Bebas Neue', Impact, 'Arial Narrow', sans-serif";
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "left";
  const assetName = (params.asset ?? "CHART").toUpperCase();
  ctx.fillText(assetName, aX, aY + 66);
  const assetW = ctx.measureText(assetName).width;

  // Timeframe badge
  const badgeY = aY + 34;
  const tfX = aX + assetW + 14;
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  rrect(ctx, tfX, badgeY, 52, 26, 7); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1;
  rrect(ctx, tfX, badgeY, 52, 26, 7); ctx.stroke();
  ctx.fillStyle = "#9ca3af"; ctx.font = "bold 12px 'DM Mono', monospace"; ctx.textAlign = "center";
  ctx.fillText(params.timeframe, tfX + 26, badgeY + 17); ctx.textAlign = "left";

  // Signal badge
  const sigColor = params.signal === "LONG" ? "#00e676" : params.signal === "SHORT" ? "#f87171" : "#9ca3af";
  const sigBg    = params.signal === "LONG" ? "rgba(0,230,118,0.14)" : params.signal === "SHORT" ? "rgba(248,113,113,0.14)" : "rgba(156,163,175,0.14)";
  ctx.font = "bold 16px 'DM Mono', monospace";
  const sigW = ctx.measureText(params.signal).width + 28;
  const sigX = tfX + 62;
  ctx.fillStyle = sigBg; rrect(ctx, sigX, badgeY - 2, sigW, 30, 9); ctx.fill();
  ctx.strokeStyle = `${sigColor}66`; ctx.lineWidth = 1.5;
  rrect(ctx, sigX, badgeY - 2, sigW, 30, 9); ctx.stroke();
  ctx.fillStyle = sigColor; ctx.textAlign = "center";
  ctx.fillText(params.signal, sigX + sigW / 2, badgeY + 17); ctx.textAlign = "left";

  // Grade badge
  const grColor = params.grade === "A+" ? "#00e676" : params.grade === "A" ? "#4ade80" : params.grade === "B" ? "#9ca3af" : "#f87171";
  ctx.font = "bold 16px 'DM Mono', monospace";
  const grW = ctx.measureText(params.grade).width + 22;
  const grX = sigX + sigW + 10;
  ctx.fillStyle = `${grColor}22`; rrect(ctx, grX, badgeY - 2, grW, 30, 9); ctx.fill();
  ctx.strokeStyle = `${grColor}55`; rrect(ctx, grX, badgeY - 2, grW, 30, 9); ctx.stroke();
  ctx.fillStyle = grColor; ctx.textAlign = "center";
  ctx.fillText(params.grade, grX + grW / 2, badgeY + 17); ctx.textAlign = "left";

  // ── Metrics ───────────────────────────────────────────────────
  const mY = aY + 92;
  const metrics = [
    { label: "ENTRY",      value: params.entry      || "N/A", color: "#ffffff" },
    { label: "STOP LOSS",  value: params.stopLoss   || "N/A", color: "#f87171" },
    { label: "TAKE PROFIT",value: params.takeProfit || "N/A", color: "#4ade80" },
    { label: "RISK / RR",  value: params.riskReward || "N/A", color: "#c084fc" },
  ];
  const crdW = Math.floor((aW - 30) / 4);
  const crdH = 98;

  metrics.forEach((m, i) => {
    const mx = aX + i * (crdW + 10);
    ctx.fillStyle = "rgba(255,255,255,0.03)"; rrect(ctx, mx, mY, crdW, crdH, 10); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
    rrect(ctx, mx, mY, crdW, crdH, 10); ctx.stroke();

    ctx.font = "bold 9px 'DM Mono', monospace"; ctx.fillStyle = "#6b7280"; ctx.textAlign = "center";
    ctx.fillText(m.label, mx + crdW / 2, mY + 20);

    ctx.font = `bold ${crdW > 200 ? "19px" : "15px"} 'DM Mono', monospace`;
    ctx.fillStyle = m.color;
    let val = m.value;
    while (ctx.measureText(val).width > crdW - 14 && val.length > 1) val = val.slice(0, -1);
    if (val !== m.value) val += "…";
    ctx.fillText(val, mx + crdW / 2, mY + 64);
    ctx.textAlign = "left";
  });

  // ── Confidence bar ────────────────────────────────────────────
  const cfY = mY + crdH + 14;
  ctx.font = "bold 10px 'DM Mono', monospace"; ctx.fillStyle = "#6b7280"; ctx.textAlign = "left";
  ctx.fillText("CONFIDENCE", aX, cfY + 13);
  const cfColor = params.confidence >= 75 ? "#00e676" : params.confidence >= 50 ? "#9ca3af" : "#f87171";
  ctx.fillStyle = cfColor; ctx.font = "bold 13px 'DM Mono', monospace"; ctx.textAlign = "right";
  ctx.fillText(`${params.confidence}%`, aX + aW, cfY + 13); ctx.textAlign = "left";

  const barY = cfY + 20;
  ctx.fillStyle = "rgba(255,255,255,0.06)"; rrect(ctx, aX, barY, aW, 6, 3); ctx.fill();
  const fillW = Math.max(6, aW * Math.min(params.confidence, 100) / 100);
  ctx.fillStyle = cfColor; ctx.shadowColor = `${cfColor}80`; ctx.shadowBlur = 8;
  rrect(ctx, aX, barY, fillW, 6, 3); ctx.fill(); ctx.shadowBlur = 0;

  // ── Summary ───────────────────────────────────────────────────
  const sumY = barY + 6 + 22;
  const rawSummary = params.summary ?? "";
  const dotIdx = rawSummary.search(/[.!?]\s/);
  const firstSentence = dotIdx > 0 ? rawSummary.slice(0, dotIdx + 1).trim() : rawSummary.slice(0, 130).trim();
  ctx.font = "12px 'DM Mono', 'Courier New', monospace"; ctx.fillStyle = "#6b7280"; ctx.textAlign = "left";
  wrapText(ctx, firstSentence, aX, sumY, aW, 19, landscape ? 4 : 2);

  // ── Footer ────────────────────────────────────────────────────
  const footY = H - 110;
  ctx.strokeStyle = "rgba(0,230,118,0.18)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(M, footY); ctx.lineTo(W - M, footY); ctx.stroke();

  ctx.font = "bold 14px 'DM Mono', monospace"; ctx.fillStyle = "#00e676"; ctx.textAlign = "center";
  ctx.fillText("trade-edge-ai.vercel.app", W / 2, footY + 30);
  ctx.font = "12px 'DM Mono', monospace"; ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fillText("Analyse your charts free at ChartIQ AI", W / 2, footY + 54);

  if (params.isPro) {
    ctx.font = "bold 10px 'DM Mono', monospace";
    const pW = ctx.measureText("PRO").width + 18;
    const pX = W - M - pW;
    ctx.fillStyle = "rgba(0,230,118,0.12)"; rrect(ctx, pX, footY + 14, pW, 20, 10); ctx.fill();
    ctx.strokeStyle = "rgba(0,230,118,0.4)"; rrect(ctx, pX, footY + 14, pW, 20, 10); ctx.stroke();
    ctx.fillStyle = "#00e676"; ctx.textAlign = "center";
    ctx.fillText("PRO", pX + pW / 2, footY + 27); ctx.textAlign = "left";
  }

  ctx.font = "9px 'DM Mono', monospace"; ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.textAlign = "right"; ctx.fillText("Powered by ChartIQ AI", W - M, H - 18); ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}
