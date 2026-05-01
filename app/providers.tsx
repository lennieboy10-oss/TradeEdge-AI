"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { UserPlanProvider, useUserPlan } from "./lib/plan-context";
import { GamificationProvider } from "./lib/gamification-context";
import XPToast from "./components/XPToast";
import CelebrationModal from "./components/CelebrationModal";
import Link from "next/link";

function GamificationLayer({ children }: { children: React.ReactNode }) {
  const { isPro, isElite } = useUserPlan();
  return (
    <GamificationProvider isPro={isPro} isElite={isElite}>
      {children}
      <XPToast />
      <CelebrationModal />
    </GamificationProvider>
  );
}

function TrialBanner() {
  const { isOnTrial, trialEndsAt } = useUserPlan();
  const [dismissed, setDismissed] = useState(false);

  if (!isOnTrial || !trialEndsAt || dismissed) return null;

  const msLeft   = new Date(trialEndsAt).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

  // Only show from day 3 onwards (5 or fewer days remaining)
  if (daysLeft > 5) return null;

  const isUrgent   = daysLeft <= 2;
  const borderColor = isUrgent ? "rgba(239,68,68,0.35)" : "rgba(0,230,118,0.25)";
  const textColor   = isUrgent ? "#f87171"               : "#00e676";
  const bgColor     = isUrgent ? "rgba(239,68,68,0.08)"  : "rgba(0,230,118,0.06)";

  const label = daysLeft <= 1
    ? "Trial ends tomorrow!"
    : `Pro trial ends in ${daysLeft} days — upgrade to keep access`;

  return (
    <div
      className={`fixed top-16 left-0 right-0 z-40 py-2 px-6 text-center${isUrgent ? " animate-pulse" : ""}`}
      style={{ background: bgColor, borderBottom: `1px solid ${borderColor}` }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 flex-wrap">
        <span className="font-dm-mono text-xs font-semibold" style={{ color: textColor }}>
          ⚡ {label}
        </span>
        <Link
          href="/account"
          className="font-dm-mono text-xs font-bold px-3 py-1 rounded-lg flex-shrink-0 transition-all hover:-translate-y-0.5"
          style={{ background: "#00e676", color: "#080a10" }}
        >
          Upgrade now — 64p/day
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-[#4b5563] hover:text-white transition-colors ml-1"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Exported so navbars on any page can import it
export function AuthNavButtons({ className = "" }: { className?: string }) {
  const { user, loading, signOut } = useAuth();
  const { email: planEmail } = useUserPlan();

  if (loading) return null;

  const displayEmail = user?.email ?? planEmail;

  if (user) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="font-dm-mono text-[11px] text-[#6b7280] hidden lg:block truncate max-w-[140px]">
          {displayEmail}
        </span>
        <button
          onClick={() => signOut()}
          className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/[0.12] text-[#9ca3af] hover:text-white hover:bg-white/[0.06] transition-all"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Link
        href="/login"
        className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/[0.12] text-[#9ca3af] hover:text-white hover:bg-white/[0.06] transition-all"
      >
        Login
      </Link>
      <Link
        href="/signup"
        className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
        style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 14px rgba(0,230,118,0.3)" }}
      >
        Start free trial
      </Link>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UserPlanProvider>
        <GamificationLayer>
          <TrialBanner />
          {children}
        </GamificationLayer>
      </UserPlanProvider>
    </AuthProvider>
  );
}
