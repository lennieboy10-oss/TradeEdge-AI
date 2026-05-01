// ── Level definitions ─────────────────────────────────────────
export interface LevelDef {
  level: number;
  minXP: number;
  title: string;
}

export const LEVELS: LevelDef[] = [
  { level: 1,  minXP: 0,     title: "Rookie Trader"    },
  { level: 2,  minXP: 100,   title: "Junior Analyst"   },
  { level: 3,  minXP: 300,   title: "Chart Reader"     },
  { level: 4,  minXP: 600,   title: "Technical Trader" },
  { level: 5,  minXP: 1000,  title: "Market Student"   },
  { level: 6,  minXP: 1500,  title: "Trend Spotter"    },
  { level: 7,  minXP: 2500,  title: "Pattern Hunter"   },
  { level: 8,  minXP: 4000,  title: "Pro Analyst"      },
  { level: 9,  minXP: 6000,  title: "Market Veteran"   },
  { level: 10, minXP: 10000, title: "Elite Trader"     },
  { level: 11, minXP: 15000, title: "Master Analyst"   },
  { level: 12, minXP: 25000, title: "Trading Legend"   },
];

export function getLevelInfo(xp: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXP) idx = i;
    else break;
  }
  const cur  = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const progressPct = next
    ? Math.min(100, ((xp - cur.minXP) / (next.minXP - cur.minXP)) * 100)
    : 100;
  return {
    level:     cur.level,
    title:     cur.title,
    minXP:     cur.minXP,
    nextXP:    next?.minXP ?? null,
    nextTitle: next?.title ?? null,
    progressPct,
  };
}

// ── XP values ─────────────────────────────────────────────────
export const XP = {
  ANALYSIS_RUN:      10,
  A_PLUS_GRADE:      25,
  HIGH_CONFIDENCE:   15,
  MULTI_TIMEFRAME:   20,
  LOG_OUTCOME:       15,
  ADD_NOTES:          5,
  TRADES_5_BONUS:    50,
  TRADES_10_BONUS:  100,
  RUN_BACKTEST:      30,
  SAVE_STRATEGY:     20,
} as const;
export type XPAction = keyof typeof XP;

// ── Streak multiplier ─────────────────────────────────────────
export function getStreakMultiplier(streak: number): number {
  if (streak >= 30) return 5;
  if (streak >= 7)  return 3;
  if (streak >= 3)  return 2;
  return 1;
}

// ── Streak milestones ─────────────────────────────────────────
export const STREAK_MILESTONES: Record<number, { label: string; emoji: string }> = {
  3:   { label: "On a roll!",        emoji: "🔥" },
  7:   { label: "One week streak!",  emoji: "💪" },
  14:  { label: "Two week warrior!", emoji: "⚔️" },
  30:  { label: "Monthly master!",   emoji: "👑" },
  100: { label: "Legend status!",    emoji: "🏆" },
};

// ── Achievements ──────────────────────────────────────────────
export type AchievementRarity = "common" | "rare" | "epic" | "legendary";
export interface Achievement {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  category:    string;
  rarity:      AchievementRarity;
  xpReward:    number;
  // Returns progress [current, target] for display
  progress: (stats: GamStats) => [number, number];
}

export interface GamStats {
  totalAnalyses:    number;
  aPlusCount:       number;
  highConfidence90: number;
  winsLogged:       number;
  totalLogged:      number;
  streak:           number;
  longestStreak:    number;
  tradesLogged:     number;
  backtestsRun:     number;
  savedStrategies:  number;
  isPro:            boolean;
  isElite:          boolean;
  referrals:        number;
  joinedEarly:      boolean;
  brokerConnected:  boolean;
  webhookSetup:     boolean;
  autoEnabled:      boolean;
  winRate:          number; // 0-100
  profitPositive:   boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Analysis ─────────────────────────────────────────────
  { id:"first_blood",      name:"First Blood",      description:"Run your first analysis",        icon:"🎯", category:"Analysis",  rarity:"common",    xpReward:50,  progress: s => [Math.min(s.totalAnalyses,1),1]    },
  { id:"chart_addict",     name:"Chart Addict",     description:"Run 10 analyses",                icon:"📊", category:"Analysis",  rarity:"common",    xpReward:100, progress: s => [Math.min(s.totalAnalyses,10),10]  },
  { id:"market_scientist", name:"Market Scientist", description:"Run 50 analyses",                icon:"🔬", category:"Analysis",  rarity:"rare",      xpReward:200, progress: s => [Math.min(s.totalAnalyses,50),50]  },
  { id:"analysis_machine", name:"Analysis Machine", description:"Run 100 analyses",               icon:"🏭", category:"Analysis",  rarity:"epic",      xpReward:500, progress: s => [Math.min(s.totalAnalyses,100),100]},
  { id:"diamond_hands",    name:"Diamond Hands",    description:"Run 500 analyses",               icon:"💎", category:"Analysis",  rarity:"legendary", xpReward:1000,progress: s => [Math.min(s.totalAnalyses,500),500]},
  // ── Accuracy ─────────────────────────────────────────────
  { id:"gold_standard",    name:"Gold Standard",    description:"Get your first A+ grade signal", icon:"⭐", category:"Accuracy",  rarity:"common",    xpReward:75,  progress: s => [Math.min(s.aPlusCount,1),1]       },
  { id:"high_roller",      name:"High Roller",      description:"Get 5 × A+ grade signals",       icon:"🎪", category:"Accuracy",  rarity:"rare",      xpReward:150, progress: s => [Math.min(s.aPlusCount,5),5]       },
  { id:"sniper",           name:"Sniper",           description:"Get 10 × 90%+ confidence signals",icon:"🎯",category:"Accuracy",  rarity:"epic",      xpReward:300, progress: s => [Math.min(s.highConfidence90,10),10]},
  { id:"eagle_eye",        name:"Eagle Eye",        description:"Log 5 winning trades",           icon:"👁️", category:"Accuracy",  rarity:"rare",      xpReward:200, progress: s => [Math.min(s.winsLogged,5),5]       },
  // ── Streak ───────────────────────────────────────────────
  { id:"on_fire",          name:"On Fire",          description:"Reach a 3 day streak",            icon:"🔥", category:"Streak",    rarity:"common",    xpReward:50,  progress: s => [Math.min(s.longestStreak,3),3]    },
  { id:"lightning",        name:"Lightning",        description:"Reach a 7 day streak",            icon:"⚡", category:"Streak",    rarity:"common",    xpReward:100, progress: s => [Math.min(s.longestStreak,7),7]    },
  { id:"iron_will",        name:"Iron Will",        description:"Reach a 14 day streak",           icon:"💪", category:"Streak",    rarity:"rare",      xpReward:250, progress: s => [Math.min(s.longestStreak,14),14]  },
  { id:"king_consistency", name:"King of Consistency",description:"Reach a 30 day streak",        icon:"👑", category:"Streak",    rarity:"epic",      xpReward:500, progress: s => [Math.min(s.longestStreak,30),30]  },
  { id:"legend",           name:"Legend",           description:"Reach a 100 day streak",          icon:"🏆", category:"Streak",    rarity:"legendary", xpReward:1000,progress: s => [Math.min(s.longestStreak,100),100]},
  // ── Journal ──────────────────────────────────────────────
  { id:"diary_keeper",     name:"Diary Keeper",     description:"Log 10 trades in journal",       icon:"📓", category:"Journal",   rarity:"common",    xpReward:100, progress: s => [Math.min(s.tradesLogged,10),10]  },
  { id:"historian",        name:"Historian",        description:"Log 50 trades in journal",       icon:"📚", category:"Journal",   rarity:"rare",      xpReward:250, progress: s => [Math.min(s.tradesLogged,50),50]  },
  { id:"chronicle",        name:"Chronicle",        description:"Log 100 trades in journal",      icon:"📖", category:"Journal",   rarity:"epic",      xpReward:500, progress: s => [Math.min(s.tradesLogged,100),100]},
  { id:"self_aware",       name:"Self Aware",       description:"Achieve 60% win rate over 20+ trades",icon:"🎓",category:"Journal",rarity:"epic",    xpReward:300, progress: s => [s.totalLogged >= 20 && s.winRate >= 60 ? 1:0, 1]},
  { id:"profitable",       name:"Profitable",       description:"Achieve positive PnL in journal",icon:"📈", category:"Journal",   rarity:"rare",      xpReward:200, progress: s => [s.profitPositive ? 1:0, 1]        },
  // ── Strategy ─────────────────────────────────────────────
  { id:"mad_scientist",    name:"Mad Scientist",    description:"Run your first backtest",        icon:"🧪", category:"Strategy",  rarity:"common",    xpReward:50,  progress: s => [Math.min(s.backtestsRun,1),1]     },
  { id:"alchemist",        name:"Alchemist",        description:"Run 10 backtests",               icon:"⚗️", category:"Strategy",  rarity:"rare",      xpReward:200, progress: s => [Math.min(s.backtestsRun,10),10]   },
  { id:"oracle",           name:"Oracle",           description:"Save 5 custom strategies",       icon:"🔮", category:"Strategy",  rarity:"epic",      xpReward:300, progress: s => [Math.min(s.savedStrategies,5),5]  },
  // ── Platform ─────────────────────────────────────────────
  { id:"connected",        name:"Connected",        description:"Connect a broker",               icon:"🔗", category:"Platform",  rarity:"rare",      xpReward:150, progress: s => [s.brokerConnected ? 1:0, 1]       },
  { id:"signal_master",    name:"Signal Master",    description:"Set up TradingView webhook",     icon:"📡", category:"Platform",  rarity:"rare",      xpReward:150, progress: s => [s.webhookSetup ? 1:0, 1]          },
  { id:"automator",        name:"Automator",        description:"Enable automated trading",       icon:"⚡", category:"Platform",  rarity:"epic",      xpReward:300, progress: s => [s.autoEnabled ? 1:0, 1]           },
  // ── Social ───────────────────────────────────────────────
  { id:"ambassador",       name:"Ambassador",       description:"Refer your first user",          icon:"🤝", category:"Social",    rarity:"rare",      xpReward:200, progress: s => [Math.min(s.referrals,1),1]        },
  { id:"recruiter",        name:"Recruiter",        description:"Refer 5 users",                  icon:"👥", category:"Social",    rarity:"epic",      xpReward:500, progress: s => [Math.min(s.referrals,5),5]        },
  { id:"influencer",       name:"Influencer",       description:"Refer 20 users",                 icon:"🌟", category:"Social",    rarity:"legendary", xpReward:1000,progress: s => [Math.min(s.referrals,20),20]      },
  // ── Special ──────────────────────────────────────────────
  { id:"early_adopter",    name:"Early Adopter",    description:"Joined in the first month",      icon:"🥇", category:"Special",   rarity:"legendary", xpReward:500, progress: s => [s.joinedEarly ? 1:0, 1]           },
  { id:"pro_member",       name:"Pro Member",       description:"Upgraded to Pro",                icon:"💎", category:"Special",   rarity:"rare",      xpReward:200, progress: s => [s.isPro || s.isElite ? 1:0, 1]    },
  { id:"elite_member",     name:"Elite Member",     description:"Upgraded to Elite",              icon:"👑", category:"Special",   rarity:"legendary", xpReward:500, progress: s => [s.isElite ? 1:0, 1]               },
];

// ── Daily challenges pool ─────────────────────────────────────
export interface ChallengeTemplate {
  id:          string;
  description: string;
  target:      number;
  xpReward:    number;
  type:        "analyses" | "outcome" | "confidence" | "backtest" | "notes" | "assets";
}

export const CHALLENGE_POOL: ChallengeTemplate[] = [
  { id:"run3",       description:"Run 3 analyses today",              target:3,  xpReward:50,  type:"analyses"   },
  { id:"run5",       description:"Run 5 analyses today",              target:5,  xpReward:80,  type:"analyses"   },
  { id:"log_outcome",description:"Log the outcome of a trade",        target:1,  xpReward:30,  type:"outcome"    },
  { id:"log3",       description:"Log outcomes for 3 trades",         target:3,  xpReward:60,  type:"outcome"    },
  { id:"confidence", description:"Get an 80%+ confidence analysis",   target:1,  xpReward:75,  type:"confidence" },
  { id:"confidence3",description:"Get three 80%+ confidence analyses",target:3,  xpReward:120, type:"confidence" },
  { id:"backtest",   description:"Run a strategy backtest",           target:1,  xpReward:100, type:"backtest"   },
  { id:"notes",      description:"Add notes to a journal entry",      target:1,  xpReward:25,  type:"notes"      },
  { id:"notes2",     description:"Add notes to 2 journal entries",    target:2,  xpReward:40,  type:"notes"      },
  { id:"assets",     description:"Analyse 3 different assets",        target:3,  xpReward:60,  type:"assets"     },
];

export function getDailyChallenges(dateStr: string): ChallengeTemplate[] {
  const hash = dateStr.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const picks: ChallengeTemplate[] = [];
  const used = new Set<number>();
  let h = Math.abs(hash);
  while (picks.length < 3) {
    const idx = h % CHALLENGE_POOL.length;
    if (!used.has(idx)) {
      used.add(idx);
      picks.push(CHALLENGE_POOL[idx]);
    }
    h = Math.abs((h * 1103515245 + 12345) & 0x7fffffff);
  }
  return picks;
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export const RARITY_COLORS: Record<AchievementRarity, { color: string; bg: string; border: string }> = {
  common:    { color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.2)"   },
  rare:      { color: "#42a5f5", bg: "rgba(66,165,245,0.08)",  border: "rgba(66,165,245,0.2)"    },
  epic:      { color: "#ab47bc", bg: "rgba(171,71,188,0.08)",  border: "rgba(171,71,188,0.2)"    },
  legendary: { color: "#ffd740", bg: "rgba(255,215,64,0.08)",  border: "rgba(255,215,64,0.25)"   },
};
