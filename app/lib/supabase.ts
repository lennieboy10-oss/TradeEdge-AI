import { createClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────
export type Outcome = "WIN" | "LOSS" | "BREAKEVEN";

export type JournalEntry = {
  id: string;
  created_at: string;
  asset: string | null;
  timeframe: string | null;
  signal: string | null;
  entry: string | null;
  stop_loss: string | null;
  take_profit: string | null;
  risk_reward: string | null;
  summary: string | null;
  confidence: number | null;
  outcome: Outcome | null;
  notes: string | null;
  user_id: string | null;
  entry_session: string | null;
  entry_time_utc: string | null;
  historical_win_rate?: number | null;
  historical_avg_r?: number | null;
  historical_sample_size?: number | null;
  historical_grade?: string | null;
  pnl?: number | null;
  r_achieved?: number | null;
  exit_time?: string | null;
  reviewed?: boolean | null;
  review_notes?: string | null;
  manually_added?: boolean | null;
  client_id?: string | null;
};

export type JournalInsert = Omit<JournalEntry, "id" | "created_at" | "outcome" | "notes">;

// ── Client factory ─────────────────────────────────────────────
// Server-side (API routes): prefers SUPABASE_SERVICE_KEY for full access.
// Client-side (journal page): falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
export function getSupabase() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "";

  const key =
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  if (!url || !key) {
    throw new Error(
      "Supabase not configured. Add SUPABASE_URL + SUPABASE_SERVICE_KEY to .env.local"
    );
  }

  return createClient(url, key);
}

// ── SQL to run in Supabase SQL editor ─────────────────────────
/*
create table public.journal (
  id           uuid        default gen_random_uuid() primary key,
  created_at   timestamptz default now() not null,
  asset        text,
  timeframe    text,
  signal       text,
  entry        text,
  stop_loss    text,
  take_profit  text,
  risk_reward  text,
  summary      text,
  confidence   integer,
  outcome      text        default null check (outcome in ('WIN','LOSS','BREAKEVEN')),
  notes        text        default ''
);

-- Dev: allow all without auth. Replace with proper RLS in production.
alter table public.journal enable row level security;
create policy "allow_all" on public.journal for all using (true) with check (true);

-- Anonymous IP-based rate limiting (3 analyses per IP per day)
create table public.anonymous_analyses (
  id         uuid        default gen_random_uuid() primary key,
  ip         text        not null,
  created_at timestamptz default now() not null
);
create index idx_anon_analyses_ip_date on public.anonymous_analyses(ip, created_at);
alter table public.anonymous_analyses enable row level security;
create policy "allow_all" on public.anonymous_analyses for all using (true) with check (true);

-- Logged-in user rate limiting (for future auth integration)
create table public.analyses (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references auth.users(id),
  created_at timestamptz default now() not null
);
alter table public.analyses enable row level security;
create policy "allow_own" on public.analyses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- API Keys for MT EA and TradingView webhooks
create table public.api_keys (
  id         uuid        default gen_random_uuid() primary key,
  user_id    text,
  key_hash   text        not null unique,
  created_at timestamptz default now() not null,
  last_used  timestamptz,
  is_active  boolean     default true
);
alter table public.api_keys enable row level security;
create policy "allow_all" on public.api_keys for all using (true) with check (true);

-- Automation settings for Elite users
create table public.automation_settings (
  id              uuid        default gen_random_uuid() primary key,
  user_id         text        not null unique,
  enabled         boolean     default false,
  min_confidence  integer     default 85,
  max_position    text        default '100',
  daily_limit     integer     default 3,
  sessions        text[]      default array['london','ny'],
  pairs           text        default 'XAUUSD, EURUSD, GBPUSD',
  updated_at      timestamptz default now()
);
alter table public.automation_settings enable row level security;
create policy "allow_all" on public.automation_settings for all using (true) with check (true);

-- ── Gamification: profiles (streak / XP / level) ──────────────
-- Run this to add gamification columns to an existing profiles table,
-- or create it fresh if you don't have one yet.
--
-- ALTER TABLE public.profiles
--   ADD COLUMN IF NOT EXISTS current_streak  integer     DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS longest_streak  integer     DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS last_active_date date,
--   ADD COLUMN IF NOT EXISTS total_xp        integer     DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS level           integer     DEFAULT 1;
--
-- If profiles doesn't exist yet:
-- create table public.profiles (
--   id              uuid        default gen_random_uuid() primary key,
--   user_id         text        not null unique,
--   current_streak  integer     default 0,
--   longest_streak  integer     default 0,
--   last_active_date date,
--   total_xp        integer     default 0,
--   level           integer     default 1,
--   updated_at      timestamptz default now()
-- );
-- alter table public.profiles enable row level security;
-- create policy "allow_all" on public.profiles for all using (true) with check (true);

-- ── Gamification: achievements ────────────────────────────────
-- create table public.achievements (
--   id             uuid        default gen_random_uuid() primary key,
--   user_id        text,
--   achievement_id text,
--   earned_at      timestamptz default now()
-- );
-- alter table public.achievements enable row level security;
-- create policy "allow_all" on public.achievements for all using (true) with check (true);

-- ── Gamification: xp_history ─────────────────────────────────
-- create table public.xp_history (
--   id         uuid        default gen_random_uuid() primary key,
--   user_id    text,
--   xp_amount  integer,
--   reason     text,
--   created_at timestamptz default now()
-- );
-- alter table public.xp_history enable row level security;
-- create policy "allow_all" on public.xp_history for all using (true) with check (true);

-- ── Gamification: leaderboard_weekly ─────────────────────────
-- create table public.leaderboard_weekly (
--   id           uuid    default gen_random_uuid() primary key,
--   user_id      text,
--   week_start   date,
--   xp_earned    integer default 0,
--   analyses_run integer default 0,
--   win_rate     decimal,
--   streak       integer default 0,
--   unique (user_id, week_start)
-- );
-- alter table public.leaderboard_weekly enable row level security;
-- create policy "allow_all" on public.leaderboard_weekly for all using (true) with check (true);
*/
