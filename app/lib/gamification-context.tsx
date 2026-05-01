"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  getLevelInfo, getStreakMultiplier, STREAK_MILESTONES,
  ACHIEVEMENTS, XP, todayUTC, getDailyChallenges,
  type XPAction, type GamStats,
} from "./gamification";

// ── Persisted state ───────────────────────────────────────────
export interface GamState {
  xp:               number;
  level:            number;
  streak:           number;
  longestStreak:    number;
  lastActiveDate:   string | null;
  achievements:     string[];
  totalAnalyses:    number;
  aPlusCount:       number;
  highConfidence90: number;
  winsLogged:       number;
  profitPositive:   boolean;
  tradesLogged:     number;
  backtestsRun:     number;
  savedStrategies:  number;
  referrals:        number;
  joinedEarly:      boolean;
  brokerConnected:  boolean;
  webhookSetup:     boolean;
  autoEnabled:      boolean;
  winRate:          number;
  totalLogged:      number;
  freezesAvailable: number;
  lastFreezeReset:  string | null;
  welcomeSteps:     string[];
  // daily challenge progress
  challengeDate:    string | null;
  challengeProgress: Record<string, number>;
  challengesDone:   string[];
  bonusClaimed:     boolean;
  // today analysis tracking
  todayAnalyses:    number;
  todayAssets:      string[];
  todayConfidence:  number[];
  analysisDate:     string | null;
}

const DEFAULT_STATE: GamState = {
  xp: 0, level: 1, streak: 0, longestStreak: 0, lastActiveDate: null,
  achievements: [], totalAnalyses: 0, aPlusCount: 0, highConfidence90: 0,
  winsLogged: 0, profitPositive: false, tradesLogged: 0, backtestsRun: 0,
  savedStrategies: 0, referrals: 0, joinedEarly: false,
  brokerConnected: false, webhookSetup: false, autoEnabled: false,
  winRate: 0, totalLogged: 0,
  freezesAvailable: 0, lastFreezeReset: null,
  welcomeSteps: [],
  challengeDate: null, challengeProgress: {}, challengesDone: [], bonusClaimed: false,
  todayAnalyses: 0, todayAssets: [], todayConfidence: [], analysisDate: null,
};

// ── Toast queue ───────────────────────────────────────────────
export interface XPToastItem {
  id:         number;
  amount:     number;
  multiplier: number;
  label:      string;
}

// ── Celebration queue ─────────────────────────────────────────
export type CelebrationKind =
  | { type: "level_up";        level: number; title: string }
  | { type: "streak_milestone"; streak: number; label: string; emoji: string }
  | { type: "achievement";     name: string; icon: string; rarity: string };

// ── Context shape ─────────────────────────────────────────────
interface GamCtx {
  state:        GamState;
  toasts:       XPToastItem[];
  celebration:  CelebrationKind | null;
  dismissCelebration: () => void;
  awardXP: (action: XPAction, meta?: {
    grade?: string; confidence?: number; asset?: string;
    isMultiTf?: boolean; notesAdded?: boolean;
  }) => void;
  recordActivity: () => void;
  completeChallenge: (type: string) => void;
  markWelcomeStep: (step: string) => void;
  updateStat: (patch: Partial<GamState>) => void;
}

const Ctx = createContext<GamCtx>({
  state: DEFAULT_STATE, toasts: [], celebration: null,
  dismissCelebration: () => {},
  awardXP: () => {}, recordActivity: () => {},
  completeChallenge: () => {}, markWelcomeStep: () => {}, updateStat: () => {},
});

export function useGamification() { return useContext(Ctx); }

// ── Provider ──────────────────────────────────────────────────
export function GamificationProvider({ children, isPro, isElite }: {
  children: React.ReactNode; isPro?: boolean; isElite?: boolean;
}) {
  const [state,       setState]       = useState<GamState>(DEFAULT_STATE);
  const [toasts,      setToasts]      = useState<XPToastItem[]>([]);
  const [celebration, setCelebration] = useState<CelebrationKind | null>(null);
  const toastCounterRef = useRef(0);
  const celebQueueRef   = useRef<CelebrationKind[]>([]);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ciq_gamification");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GamState>;
        setState(s => ({ ...s, ...parsed }));
      }
    } catch {}
  }, []);

  // Persist to localStorage on change
  const persist = useCallback((s: GamState) => {
    try { localStorage.setItem("ciq_gamification", JSON.stringify(s)); } catch {}
  }, []);

  // Queue celebration (only one visible at a time)
  function queueCelebration(c: CelebrationKind) {
    if (!celebration) {
      setCelebration(c);
    } else {
      celebQueueRef.current.push(c);
    }
  }

  function dismissCelebration() {
    setCelebration(null);
    const next = celebQueueRef.current.shift();
    if (next) setTimeout(() => setCelebration(next), 300);
  }

  // Check and award achievements
  function checkAchievements(s: GamState, newAchievements: string[]) {
    const stats: GamStats = {
      totalAnalyses:    s.totalAnalyses,
      aPlusCount:       s.aPlusCount,
      highConfidence90: s.highConfidence90,
      winsLogged:       s.winsLogged,
      totalLogged:      s.totalLogged,
      streak:           s.streak,
      longestStreak:    s.longestStreak,
      tradesLogged:     s.tradesLogged,
      backtestsRun:     s.backtestsRun,
      savedStrategies:  s.savedStrategies,
      isPro:            isPro ?? false,
      isElite:          isElite ?? false,
      referrals:        s.referrals,
      joinedEarly:      s.joinedEarly,
      brokerConnected:  s.brokerConnected,
      webhookSetup:     s.webhookSetup,
      autoEnabled:      s.autoEnabled,
      winRate:          s.winRate,
      profitPositive:   s.profitPositive,
    };
    const earned: string[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (newAchievements.includes(ach.id)) continue;
      const [cur, tgt] = ach.progress(stats);
      if (cur >= tgt) {
        earned.push(ach.id);
        queueCelebration({ type: "achievement", name: ach.name, icon: ach.icon, rarity: ach.rarity });
      }
    }
    return earned;
  }

  // ── awardXP ───────────────────────────────────────────────
  const awardXP = useCallback((action: XPAction, meta?: {
    grade?: string; confidence?: number; asset?: string;
    isMultiTf?: boolean; notesAdded?: boolean;
  }) => {
    setState(prev => {
      const today = todayUTC();
      let base = XP[action];

      // Stat increments
      const patch: Partial<GamState> = {};
      if (action === "ANALYSIS_RUN") {
        patch.totalAnalyses = prev.totalAnalyses + 1;
        const isNewAsset = meta?.asset && !prev.todayAssets.includes(meta.asset);
        patch.todayAssets = meta?.asset && prev.analysisDate === today
          ? (isNewAsset ? [...prev.todayAssets, meta.asset] : prev.todayAssets)
          : meta?.asset ? [meta.asset] : [];
        patch.todayAnalyses  = prev.analysisDate === today ? prev.todayAnalyses + 1 : 1;
        patch.analysisDate   = today;
        patch.todayConfidence = prev.analysisDate === today
          ? [...prev.todayConfidence, meta?.confidence ?? 0]
          : [meta?.confidence ?? 0];
      }
      if (action === "A_PLUS_GRADE")    patch.aPlusCount       = prev.aPlusCount + 1;
      if (action === "HIGH_CONFIDENCE") patch.highConfidence90 = prev.highConfidence90 + 1;
      if (action === "LOG_OUTCOME") {
        patch.tradesLogged = prev.tradesLogged + 1;
        patch.totalLogged  = prev.totalLogged + 1;
      }
      if (action === "RUN_BACKTEST")  patch.backtestsRun   = (prev.backtestsRun || 0) + 1;
      if (action === "SAVE_STRATEGY") patch.savedStrategies = (prev.savedStrategies || 0) + 1;

      // Multi-timeframe bonus
      if (meta?.isMultiTf)  base += XP.MULTI_TIMEFRAME;
      if (meta?.notesAdded) base += XP.ADD_NOTES;

      // Streak multiplier
      const mult = getStreakMultiplier(prev.streak);
      const gained = base * mult;

      // XP and level
      const newXP  = prev.xp + gained;
      const info   = getLevelInfo(newXP);
      const oldLvl = getLevelInfo(prev.xp).level;
      if (info.level > oldLvl) {
        queueCelebration({ type: "level_up", level: info.level, title: info.title });
      }

      // Toast
      const tid = ++toastCounterRef.current;
      setToasts(t => [...t, { id: tid, amount: gained, multiplier: mult, label: action }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== tid)), 3500);

      // Achievements
      const merged = { ...prev, ...patch };
      const newStats = {
        ...merged, xp: newXP, level: info.level,
      } as GamState;
      const newlyEarned = checkAchievements(newStats, prev.achievements);
      const allAch = [...prev.achievements, ...newlyEarned];

      const next = { ...prev, ...patch, xp: newXP, level: info.level, achievements: allAch };

      // Bonus XP milestones
      let bonusXP = 0;
      const tl = next.tradesLogged;
      if (tl === 5)  bonusXP += XP.TRADES_5_BONUS;
      if (tl === 10) bonusXP += XP.TRADES_10_BONUS;
      if (bonusXP) {
        const btid = ++toastCounterRef.current;
        setToasts(t => [...t, { id: btid, amount: bonusXP, multiplier: 1, label: "MILESTONE" }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== btid)), 3500);
        next.xp += bonusXP;
        next.level = getLevelInfo(next.xp).level;
      }

      persist(next);
      return next;
    });
  }, [isPro, isElite, persist]);

  // ── recordActivity (streak) ───────────────────────────────
  const recordActivity = useCallback(() => {
    setState(prev => {
      const today = todayUTC();
      if (prev.lastActiveDate === today) return prev;

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);

      let newStreak: number;
      if (prev.lastActiveDate === yStr) {
        // consecutive
        newStreak = prev.streak + 1;
      } else if (prev.lastActiveDate === null) {
        newStreak = 1;
      } else {
        // check freeze
        const freezes = prev.freezesAvailable;
        if (freezes > 0) {
          newStreak = prev.streak; // protected
        } else {
          newStreak = 1;
        }
      }

      const newLongest = Math.max(prev.longestStreak, newStreak);

      // Check milestone
      const milestone = STREAK_MILESTONES[newStreak as keyof typeof STREAK_MILESTONES];
      if (milestone) {
        queueCelebration({ type: "streak_milestone", streak: newStreak, ...milestone });
      }

      const next = {
        ...prev,
        streak: newStreak,
        longestStreak: newLongest,
        lastActiveDate: today,
      };
      persist(next);
      return next;
    });
  }, [persist]);

  // ── completeChallenge ─────────────────────────────────────
  const completeChallenge = useCallback((type: string) => {
    setState(prev => {
      const today = todayUTC();
      const challenges = getDailyChallenges(today);

      // Reset if new day
      const isToday = prev.challengeDate === today;
      const progress = isToday ? { ...prev.challengeProgress } : {};
      const done     = isToday ? [...prev.challengesDone]      : [];
      const bonus    = isToday ? prev.bonusClaimed             : false;

      // Increment progress for matching challenges
      for (const ch of challenges) {
        if (ch.type === type) {
          progress[ch.id] = (progress[ch.id] ?? 0) + 1;
          if (!done.includes(ch.id) && progress[ch.id] >= ch.target) {
            done.push(ch.id);
          }
        }
      }

      let newState = { ...prev, challengeDate: today, challengeProgress: progress, challengesDone: done, bonusClaimed: bonus };

      // All 3 complete — bonus XP
      if (!bonus && done.length >= 3 && challenges.every(c => done.includes(c.id))) {
        const bid = ++toastCounterRef.current;
        setToasts(t => [...t, { id: bid, amount: 50, multiplier: 1, label: "BONUS" }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== bid)), 3500);
        newState = { ...newState, xp: newState.xp + 50, bonusClaimed: true };
        newState.level = getLevelInfo(newState.xp).level;
      }

      persist(newState);
      return newState;
    });
  }, [persist]);

  // ── markWelcomeStep ───────────────────────────────────────
  const markWelcomeStep = useCallback((step: string) => {
    setState(prev => {
      if (prev.welcomeSteps.includes(step)) return prev;
      const next = { ...prev, welcomeSteps: [...prev.welcomeSteps, step] };
      persist(next);
      return next;
    });
  }, [persist]);

  const updateStat = useCallback((patch: Partial<GamState>) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <Ctx.Provider value={{ state, toasts, celebration, dismissCelebration, awardXP, recordActivity, completeChallenge, markWelcomeStep, updateStat }}>
      {children}
    </Ctx.Provider>
  );
}
