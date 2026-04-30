"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/app/lib/supabase-browser";

function LogoMark() {
  return (
    <div className="w-9 h-9 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <LogoMark />
          <span className="font-bold text-[18px]">ChartIQ <span className="text-[#00e676]">AI</span></span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0f18] p-8">
          <div className="text-center mb-7">
            <h1 className="text-2xl font-extrabold">Welcome back</h1>
            <p className="text-[#6b7280] text-sm mt-1.5">Sign in to your ChartIQ account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-[0.1em] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder-[#4b5563] text-sm outline-none focus:border-[#00e676]/40 focus:bg-white/[0.06] transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#6b7280] uppercase tracking-[0.1em] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Your password"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder-[#4b5563] text-sm outline-none focus:border-[#00e676]/40 focus:bg-white/[0.06] transition-all"
              />
            </div>

            {error && (
              <p className="text-[#f87171] text-sm px-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 mt-2"
              style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 22px rgba(0,230,118,0.3)" }}
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <p className="text-center text-[#4b5563] text-xs mt-5">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#00e676] hover:underline">Start free trial →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
