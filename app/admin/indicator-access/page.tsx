"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type AccessRow = {
  id: string;
  email: string | null;
  tradingview_username: string | null;
  status: string;
  requested_at: string;
  approved_at: string | null;
  notes: string | null;
};

type Stats = { total: number; pending: number; approved: number; today: number };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    pending:  { background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" },
    approved: { background: "rgba(0,230,118,0.10)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" },
    revoked:  { background: "rgba(248,113,113,0.10)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" },
  };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase font-dm-mono"
      style={styles[status] ?? styles.pending}>
      {status}
    </span>
  );
}

export default function AdminIndicatorAccess() {
  const router = useRouter();
  const [rows,    setRows]    = useState<AccessRow[]>([]);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [filter,  setFilter]  = useState<"all" | "pending" | "approved" | "today">("all");
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [copying, setCopying] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const clientId = typeof window !== "undefined" ? localStorage.getItem("ciq_client_id") ?? "" : "";

  const fetchData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/tv-access?admin_client_id=${clientId}`);
      if (res.status === 401) { router.replace("/"); return; }
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setRows(data.rows);
      setStats(data.stats);
    } catch { setError("Failed to load data"); }
    setLoading(false);
  }, [clientId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function approve(ids: string[]) {
    const key = ids.join(",");
    setApproving(key);
    try {
      const res  = await fetch("/api/tv-access/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulkIds: ids, adminClientId: clientId }),
      });
      const data = await res.json();
      if (data.success) await fetchData();
      else setError(data.error ?? "Approve failed");
    } catch { setError("Approve failed"); }
    setApproving(null);
  }

  async function copyUsername(username: string) {
    setCopying(username);
    await navigator.clipboard.writeText(username).catch(() => {});
    setTimeout(() => setCopying(null), 1500);
  }

  const today = new Date().toISOString().slice(0, 10);

  const displayed = rows.filter((r) => {
    if (filter === "pending"  && r.status !== "pending")  return false;
    if (filter === "approved" && r.status !== "approved") return false;
    if (filter === "today"    && r.requested_at?.slice(0, 10) !== today) return false;
    if (search) {
      const s = search.toLowerCase();
      return (r.email ?? "").toLowerCase().includes(s) || (r.tradingview_username ?? "").toLowerCase().includes(s);
    }
    return true;
  });

  const pendingIds = rows.filter((r) => r.status === "pending").map((r) => r.id);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080a10] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#00e676]/30 border-t-[#00e676] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-24">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-dm-mono text-[10px] tracking-[0.2em] uppercase text-[#6b7280] mb-1">Admin</p>
            <h1 className="font-bebas text-4xl tracking-[0.05em]">INDICATOR ACCESS REQUESTS</h1>
          </div>
          <button onClick={fetchData}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-white/[0.05]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af" }}>
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-6 text-sm text-[#f87171]"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
            {error}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total",    value: stats.total,    color: "#9ca3af" },
              { label: "Pending",  value: stats.pending,  color: "#fbbf24" },
              { label: "Approved", value: stats.approved, color: "#00e676" },
              { label: "Today",    value: stats.today,    color: "#60a5fa" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-5 text-center"
                style={{ background: "#0c0f18", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-3xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-[#4b5563] uppercase tracking-widest mt-1 font-dm-mono">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters + Search + Bulk approve */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex gap-1 p-1 rounded-xl flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["all", "pending", "approved", "today"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                style={filter === f
                  ? { background: "#00e676", color: "#080a10" }
                  : { background: "transparent", color: "#6b7280" }}>
                {f}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or username…"
            className="flex-1 px-4 py-2 rounded-xl text-sm text-white placeholder-[#4b5563] outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          />

          {pendingIds.length > 0 && (
            <button
              onClick={() => approve(pendingIds)}
              disabled={approving === pendingIds.join(",")}
              className="px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: "rgba(0,230,118,0.12)", color: "#00e676", border: "1px solid rgba(0,230,118,0.25)" }}>
              {approving === pendingIds.join(",") ? "Approving…" : `Approve all ${pendingIds.length} pending`}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Date", "ChartIQ Email", "TV Username", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-bold tracking-[0.12em] uppercase text-[#4b5563]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-[#4b5563] text-sm">
                      No requests found
                    </td>
                  </tr>
                )}
                {displayed.map((row) => (
                  <tr key={row.id} className="border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors">
                    <td className="px-5 py-4 font-dm-mono text-xs text-[#6b7280] whitespace-nowrap">
                      {timeAgo(row.requested_at)}
                    </td>
                    <td className="px-5 py-4 text-[#9ca3af] text-xs">{row.email ?? "—"}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => copyUsername(row.tradingview_username ?? "")}
                        className="font-dm-mono text-sm font-bold flex items-center gap-2 hover:opacity-80 transition-opacity"
                        style={{ color: "#00e676" }}
                        title="Click to copy">
                        {row.tradingview_username ?? "—"}
                        <span className="text-[10px] text-[#4b5563]">
                          {copying === row.tradingview_username ? "✓" : "⎘"}
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-4">
                      {row.status === "pending" && (
                        <button
                          onClick={() => approve([row.id])}
                          disabled={approving === row.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                          style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
                          {approving === row.id ? "…" : "Approve ✓"}
                        </button>
                      )}
                      {row.status === "approved" && (
                        <span className="text-xs text-[#4b5563]">
                          {row.approved_at ? timeAgo(row.approved_at) : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-[#374151] text-center mt-8 font-dm-mono">
          Admin dashboard · {rows.length} total requests
        </p>
      </div>
    </div>
  );
}
