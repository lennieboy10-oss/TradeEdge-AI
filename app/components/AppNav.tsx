"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/app/lib/auth-context";
import { useUserPlan } from "@/app/lib/plan-context";
import { useGamification } from "@/app/lib/gamification-context";
import { getLevelInfo } from "@/app/lib/gamification";

// ── Logo ───────────────────────────────────────────────────────
function LogoMark() {
  return (
    <div className="w-7 h-7 rounded-full bg-[#00e676] flex items-center justify-center flex-shrink-0">
      <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
        <path d="M2 11L5.5 6L8.5 8.5L12 3.5" stroke="#080a10" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

// ── Dropdown types ────────────────────────────────────────────
type DropdownKey = "tools" | "community" | "resources" | "avatar" | null;

const TOOLS_ITEMS = [
  { label: "Chart Analyser",    href: "/",                  icon: "📊" },
  { label: "Strategy Tester",   href: "/strategy-tester",   icon: "🧪" },
  { label: "Risk Calculator",   href: "/calculator",         icon: "🎯" },
  { label: "Economic Calendar", href: "/calendar",           icon: "📅" },
  { label: "Watchlist",         href: "/watchlist",          icon: "⭐" },
  { label: "Journal",           href: "/journal",            icon: "📓" },
];

const COMMUNITY_ITEMS = [
  { label: "Leaderboard",  href: "/leaderboard",  icon: "🏆" },
  { label: "Trade Ideas",  href: "/#trade-ideas", icon: "💡" },
  { label: "Achievements", href: "/achievements", icon: "🎖️" },
];

const RESOURCES_ITEMS = [
  { label: "Pine Script Library",  href: "/tools/pine-scripts", icon: "📜" },
  { label: "Broker Connections",   href: "/brokers",             icon: "🔗" },
  { label: "Setup Guides",         href: "/#guides",             icon: "📖" },
];

const AVATAR_ITEMS = [
  { label: "Dashboard",          href: "/dashboard"   },
  { label: "Journal",            href: "/journal"     },
  { label: "Account",            href: "/account"     },
  { label: "Achievements",       href: "/achievements" },
  { label: "Broker Connections", href: "/brokers"     },
];

// ── Dropdown panel ─────────────────────────────────────────────
function DropPanel({ items, onClose }: { items: { label: string; href: string; icon?: string }[]; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full mt-2 left-0 min-w-[200px] rounded-xl overflow-hidden z-[60]"
      style={{ background: "#0d1310", border: "1px solid rgba(0,230,118,0.15)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClose}
          className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#9ca3af] hover:text-white hover:bg-white/[0.05] transition-colors group"
        >
          {item.icon && <span className="text-sm">{item.icon}</span>}
          <span className="group-hover:translate-x-0.5 transition-transform">{item.label}</span>
        </Link>
      ))}
    </motion.div>
  );
}

// ── Nav dropdown trigger ───────────────────────────────────────
function NavDropdown({
  label,
  id,
  open,
  onOpen,
  onClose,
  children,
}: {
  label: string;
  id: DropdownKey;
  open: boolean;
  onOpen: (k: DropdownKey) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" onMouseEnter={() => onOpen(id)} onMouseLeave={onClose}>
      <button
        className="flex items-center gap-1 text-[13px] text-[#6b7280] hover:text-white transition-colors py-2"
        onClick={() => (open ? onClose() : onOpen(id))}
        aria-expanded={open}
      >
        {label}
        <svg
          width="9" height="6" viewBox="0 0 9 6" fill="none"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </button>
      <AnimatePresence>{open && children}</AnimatePresence>
    </div>
  );
}

// ── Avatar circle ──────────────────────────────────────────────
function AvatarCircle({ email }: { email?: string }) {
  const initial = email?.[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-[#080a10] flex-shrink-0"
      style={{ background: "#00e676" }}
    >
      {initial}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function AppNav() {
  const { user, signOut }           = useAuth();
  const { isPro, isElite }          = useUserPlan();
  const { state }                   = useGamification();
  const myInfo                      = getLevelInfo(state.xp);

  const [dropdown, setDropdown]     = useState<DropdownKey>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileTools, setMobileTools]         = useState(false);
  const [mobileCommunity, setMobileCommunity] = useState(false);
  const [mobileResources, setMobileResources] = useState(false);

  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openDrop(k: DropdownKey) {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setDropdown(k);
  }
  function closeDrop() {
    closeTimeout.current = setTimeout(() => setDropdown(null), 80);
  }

  // Lock body scroll when mobile open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const planTag = isElite ? "ELITE" : isPro ? "PRO" : null;

  return (
    <>
      {/* ── DESKTOP / MAIN NAV ────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass" style={{ height: "60px" }}>
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <LogoMark />
            <span className="font-bold text-[16px] text-white leading-none">
              ChartIQ <span className="text-[#00e676]">AI</span>
            </span>
          </Link>

          {/* Centre links — desktop only */}
          <div className="hidden lg:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            <Link href="/#features" className="text-[13px] text-[#6b7280] hover:text-white transition-colors">Features</Link>
            <Link href="/pricing"   className="text-[13px] text-[#6b7280] hover:text-white transition-colors">Pricing</Link>

            <NavDropdown label="Tools"     id="tools"     open={dropdown === "tools"}     onOpen={openDrop} onClose={closeDrop}>
              <DropPanel items={TOOLS_ITEMS}     onClose={() => setDropdown(null)} />
            </NavDropdown>

            <NavDropdown label="Community" id="community" open={dropdown === "community"} onOpen={openDrop} onClose={closeDrop}>
              <DropPanel items={COMMUNITY_ITEMS} onClose={() => setDropdown(null)} />
            </NavDropdown>

            <NavDropdown label="Resources" id="resources" open={dropdown === "resources"} onOpen={openDrop} onClose={closeDrop}>
              <DropPanel items={RESOURCES_ITEMS} onClose={() => setDropdown(null)} />
            </NavDropdown>

            <Link href="/account" className="text-[13px] text-[#6b7280] hover:text-white transition-colors">Account</Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2.5">

            {/* Logged-in right side */}
            {user ? (
              <>
                {/* Streak */}
                {state.streak > 0 && (
                  <div className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                    style={{ background: "rgba(255,100,0,0.08)", border: "1px solid rgba(255,100,0,0.2)" }}>
                    <span className="text-sm">🔥</span>
                    <span className="font-dm-mono text-[11px] font-bold text-white">{state.streak}</span>
                  </div>
                )}

                {/* Level badge */}
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                  style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.2)" }}>
                  <span className="font-dm-mono text-[10px] font-bold text-[#00e676]">LVL {myInfo.level}</span>
                  {planTag && (
                    <span className="font-dm-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(0,230,118,0.15)", color: "#00e676" }}>
                      {planTag}
                    </span>
                  )}
                </div>

                {/* Bell */}
                <button className="hidden lg:flex w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] items-center justify-center hover:bg-white/[0.08] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1.5a4.5 4.5 0 014.5 4.5v2.5l1 1.5H1.5L2.5 8.5V6A4.5 4.5 0 017 1.5z" stroke="#6b7280" strokeWidth="1.1"/>
                    <path d="M5.5 10.5a1.5 1.5 0 003 0" stroke="#6b7280" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                </button>

                {/* Avatar + dropdown */}
                <div
                  className="relative hidden lg:flex"
                  onMouseEnter={() => openDrop("avatar")}
                  onMouseLeave={closeDrop}
                >
                  <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.06] transition-colors">
                    <AvatarCircle email={user.email} />
                    <svg width="9" height="6" viewBox="0 0 9 6" fill="none"
                      className={`transition-transform duration-150 ${dropdown === "avatar" ? "rotate-180" : ""}`}>
                      <path d="M1 1l3.5 3.5L8 1" stroke="#6b7280" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </button>

                  <AnimatePresence>
                    {dropdown === "avatar" && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full right-0 mt-2 min-w-[180px] rounded-xl overflow-hidden z-[60]"
                        style={{ background: "#0d1310", border: "1px solid rgba(0,230,118,0.15)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}
                      >
                        <div className="px-4 py-2.5 border-b border-white/[0.06]">
                          <p className="font-dm-mono text-[10px] text-[#4b5563] truncate max-w-[160px]">{user.email}</p>
                        </div>
                        {AVATAR_ITEMS.map((item) => (
                          <Link key={item.href} href={item.href} onClick={() => setDropdown(null)}
                            className="flex items-center px-4 py-2.5 text-[13px] text-[#9ca3af] hover:text-white hover:bg-white/[0.05] transition-colors">
                            {item.label}
                          </Link>
                        ))}
                        <div className="border-t border-white/[0.06]">
                          <button
                            onClick={() => { signOut(); setDropdown(null); }}
                            className="flex items-center w-full px-4 py-2.5 text-[13px] text-[#f87171] hover:bg-white/[0.05] transition-colors">
                            Log out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              /* Logged-out right side */
              <div className="hidden lg:flex items-center gap-2">
                <Link href="/login"
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/[0.12] text-[#9ca3af] hover:text-white hover:bg-white/[0.06] transition-all">
                  Login
                </Link>
                <Link href="/signup"
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 14px rgba(0,230,118,0.3)" }}>
                  Start free trial
                </Link>
              </div>
            )}

            {/* Hamburger — mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-9 h-9 rounded-lg bg-white/[0.06] flex flex-col items-center justify-center gap-[5px]"
              aria-label="Open menu"
            >
              <span style={{ width: "18px", height: "2px", background: "white", borderRadius: "2px", display: "block" }} />
              <span style={{ width: "14px", height: "2px", background: "white", borderRadius: "2px", display: "block" }} />
              <span style={{ width: "18px", height: "2px", background: "white", borderRadius: "2px", display: "block" }} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── MOBILE FULL-SCREEN DRAWER ─────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[70] bg-black/60 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeInOut" }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm z-[80] lg:hidden flex flex-col"
              style={{ background: "#080a10", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 h-[60px] border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <LogoMark />
                  <span className="font-bold text-[16px] text-white">ChartIQ <span className="text-[#00e676]">AI</span></span>
                </div>
                <button onClick={() => setMobileOpen(false)}
                  className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center"
                  aria-label="Close menu">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              {/* Streak + Level (logged in only) */}
              {user && (
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(255,100,0,0.08)", border: "1px solid rgba(255,100,0,0.2)" }}>
                    <span>🔥</span>
                    <span className="font-dm-mono text-[12px] font-bold text-white">{state.streak}d</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.2)" }}>
                    <span className="font-dm-mono text-[11px] font-bold text-[#00e676]">LVL {myInfo.level}</span>
                    <span className="font-dm-mono text-[9px] text-[#00e676] opacity-70">{myInfo.title}</span>
                  </div>
                  {planTag && (
                    <span className="font-dm-mono text-[10px] font-bold px-2.5 py-1.5 rounded-lg ml-auto"
                      style={{ background: "rgba(0,230,118,0.1)", color: "#00e676", border: "1px solid rgba(0,230,118,0.2)" }}>
                      {planTag}
                    </span>
                  )}
                </div>
              )}

              {/* Links */}
              <div className="flex-1 overflow-y-auto py-4 px-6">
                <Link href="/#features" onClick={() => setMobileOpen(false)}
                  className="flex items-center py-3 text-[15px] font-semibold text-[#9ca3af] hover:text-white border-b border-white/[0.05] transition-colors">
                  Features
                </Link>
                <Link href="/pricing" onClick={() => setMobileOpen(false)}
                  className="flex items-center py-3 text-[15px] font-semibold text-[#9ca3af] hover:text-white border-b border-white/[0.05] transition-colors">
                  Pricing
                </Link>

                {/* Tools accordion */}
                <div className="border-b border-white/[0.05]">
                  <button onClick={() => setMobileTools(!mobileTools)}
                    className="flex items-center justify-between w-full py-3 text-[15px] font-semibold text-[#9ca3af] hover:text-white transition-colors">
                    Tools
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
                      className={`transition-transform ${mobileTools ? "rotate-180" : ""}`}>
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {mobileTools && (
                    <div className="pb-2 pl-3 flex flex-col gap-0.5">
                      {TOOLS_ITEMS.map(i => (
                        <Link key={i.href} href={i.href} onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 py-2 text-[13px] text-[#6b7280] hover:text-white transition-colors">
                          <span>{i.icon}</span>{i.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Community accordion */}
                <div className="border-b border-white/[0.05]">
                  <button onClick={() => setMobileCommunity(!mobileCommunity)}
                    className="flex items-center justify-between w-full py-3 text-[15px] font-semibold text-[#9ca3af] hover:text-white transition-colors">
                    Community
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
                      className={`transition-transform ${mobileCommunity ? "rotate-180" : ""}`}>
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {mobileCommunity && (
                    <div className="pb-2 pl-3 flex flex-col gap-0.5">
                      {COMMUNITY_ITEMS.map(i => (
                        <Link key={i.href} href={i.href} onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 py-2 text-[13px] text-[#6b7280] hover:text-white transition-colors">
                          <span>{i.icon}</span>{i.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resources accordion */}
                <div className="border-b border-white/[0.05]">
                  <button onClick={() => setMobileResources(!mobileResources)}
                    className="flex items-center justify-between w-full py-3 text-[15px] font-semibold text-[#9ca3af] hover:text-white transition-colors">
                    Resources
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
                      className={`transition-transform ${mobileResources ? "rotate-180" : ""}`}>
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {mobileResources && (
                    <div className="pb-2 pl-3 flex flex-col gap-0.5">
                      {RESOURCES_ITEMS.map(i => (
                        <Link key={i.href} href={i.href} onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 py-2 text-[13px] text-[#6b7280] hover:text-white transition-colors">
                          <span>{i.icon}</span>{i.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Link href="/account" onClick={() => setMobileOpen(false)}
                  className="flex items-center py-3 text-[15px] font-semibold text-[#9ca3af] hover:text-white border-b border-white/[0.05] transition-colors">
                  Account
                </Link>

                {/* Logged-in extra links */}
                {user && (
                  <>
                    {AVATAR_ITEMS.map(i => (
                      <Link key={i.href} href={i.href} onClick={() => setMobileOpen(false)}
                        className="flex items-center py-3 text-[15px] font-semibold text-[#9ca3af] hover:text-white border-b border-white/[0.05] transition-colors">
                        {i.label}
                      </Link>
                    ))}
                    <button onClick={() => { signOut(); setMobileOpen(false); }}
                      className="flex items-center py-3 w-full text-[15px] font-semibold text-[#f87171] hover:text-red-400 transition-colors">
                      Log out
                    </button>
                  </>
                )}
              </div>

              {/* Green CTA at bottom */}
              {!user && (
                <div className="px-6 py-5 border-t border-white/[0.06] flex flex-col gap-3">
                  <Link href="/signup" onClick={() => setMobileOpen(false)}
                    className="block w-full py-3.5 rounded-xl text-center text-sm font-bold transition-all"
                    style={{ background: "#00e676", color: "#080a10", boxShadow: "0 0 20px rgba(0,230,118,0.3)" }}>
                    Start free trial
                  </Link>
                  <Link href="/login" onClick={() => setMobileOpen(false)}
                    className="block w-full py-3 rounded-xl text-center text-sm font-semibold border border-white/[0.12] text-[#9ca3af] hover:text-white hover:bg-white/[0.04] transition-all">
                    Login
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
