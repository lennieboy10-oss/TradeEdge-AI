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
*/
