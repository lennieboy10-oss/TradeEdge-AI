# ChartIQ AI

AI-powered chart analysis with Stripe subscriptions and Supabase persistence.

---

## Setup

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

---

## Supabase — run in SQL editor

```sql
-- Journal
create table public.journal (
  id           uuid        default gen_random_uuid() primary key,
  created_at   timestamptz default now() not null,
  asset        text, timeframe text, signal text, entry text,
  stop_loss    text, take_profit text, risk_reward text,
  summary      text, confidence integer,
  outcome      text check (outcome in ('WIN','LOSS','BREAKEVEN')),
  notes        text default '',
  timeframes   jsonb
);
alter table public.journal enable row level security;
create policy "allow_all" on public.journal for all using (true) with check (true);

-- Anonymous rate limiting (3/day per IP)
create table public.anonymous_analyses (
  id uuid default gen_random_uuid() primary key,
  ip text not null,
  created_at timestamptz default now() not null
);
create index idx_anon_analyses_ip_date on public.anonymous_analyses(ip, created_at);
alter table public.anonymous_analyses enable row level security;
create policy "allow_all" on public.anonymous_analyses for all using (true) with check (true);

-- User profiles (Stripe + plan)
create table public.profiles (
  id                 uuid default gen_random_uuid() primary key,
  client_id          text unique not null,
  email              text,
  plan               text default 'free',
  stripe_customer_id text,
  created_at         timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "allow_all" on public.profiles for all using (true) with check (true);
```

---

## Stripe setup

### 1. Create product and price

1. [dashboard.stripe.com](https://dashboard.stripe.com) → **Products** → **Add product**
2. Name: `ChartIQ AI Pro` · Pricing: Recurring, £19.00, monthly
3. Save → copy **Price ID** (`price_...`) → `STRIPE_PRICE_ID` in `.env.local`

### 2. API keys

**Developers** → **API keys**:
- Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Secret key → `STRIPE_SECRET_KEY`

### 3. Webhook — local dev

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy whsec_... → STRIPE_WEBHOOK_SECRET
```

### 4. Webhook — production

**Developers** → **Webhooks** → **Add endpoint**:
- URL: `https://your-domain.com/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.deleted`
- Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### 5. Enable customer portal

**Settings** → **Billing** → **Customer portal** → enable and save.

---

## Test cards

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 9995` | Declined |
| `4000 0025 0000 3155` | 3D Secure |

Any future expiry · any CVC · any postcode.

---

## Supabase migrations (run after initial setup)

```sql
ALTER TABLE public.journal ADD COLUMN IF NOT EXISTS timeframes jsonb;
ALTER TABLE public.journal ADD COLUMN IF NOT EXISTS chat_history jsonb;
ALTER TABLE public.journal ADD COLUMN IF NOT EXISTS user_id text;

-- Watchlist + alerts
create table public.watchlist (
  id               uuid        default gen_random_uuid() primary key,
  client_id        text        not null,
  pair             text        not null,
  created_at       timestamptz default now(),
  alerts_enabled   boolean     default false,
  alert_signal     text,
  alert_confidence integer,
  alert_price      text,
  alert_email      text,
  unique(client_id, pair)
);
alter table public.watchlist enable row level security;
create policy "allow_all" on public.watchlist for all using (true) with check (true);
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key (console.anthropic.com) |
| `SUPABASE_URL` | ✅ | Project URL — Settings → API |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key, server-only, bypasses RLS |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Same as `SUPABASE_URL` (exposed to browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon/public key (exposed to browser) |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Webhook signing secret (`whsec_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe publishable key (`pk_live_...`) |
| `STRIPE_PRICE_ID` | ✅ | Monthly Pro plan price ID (`price_...`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Full app URL, no trailing slash (e.g. `https://chartiq.vercel.app`) |
| `RESEND_API_KEY` | ✅ | Resend API key for alert emails (resend.com) |
| `RESEND_FROM_EMAIL` | optional | From address for alert emails — defaults to `onboarding@resend.dev` |

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
cd ai-trading-app
git add -A
git commit -m "ready for production"
git push origin main
```

### 2. Import project on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub
2. Click **Add New → Project**
3. Find `TradeEdge-AI` in the repo list and click **Import**
4. Framework preset auto-detects as **Next.js** — leave all build settings as-is
5. Click **Environment Variables** and add every variable from the table above:
   - Paste each key + value exactly as in your `.env.local`
   - Change `NEXT_PUBLIC_APP_URL` to your Vercel URL (you can set it after first deploy)
6. Click **Deploy**

### 3. After first deploy — update app URL

Once Vercel gives you a URL (e.g. `https://trade-edge-ai.vercel.app`):

1. In Vercel → Project → Settings → Environment Variables:
   - Update `NEXT_PUBLIC_APP_URL` to `https://trade-edge-ai.vercel.app` (no trailing slash)
2. Redeploy: Vercel → Deployments → ⋯ → **Redeploy**

### 4. Update Stripe webhook for production

1. [dashboard.stripe.com](https://dashboard.stripe.com) → **Developers → Webhooks → Add endpoint**
2. URL: `https://your-vercel-url.vercel.app/api/stripe/webhook`
3. Events to listen for: `checkout.session.completed`, `customer.subscription.deleted`
4. Copy the new **Signing secret** (`whsec_...`)
5. In Vercel env vars: update `STRIPE_WEBHOOK_SECRET` to this new value → Redeploy

### 5. Verify Resend sender domain (for alert emails)

By default alert emails send from `onboarding@resend.dev` which works out of the box.
To use your own domain set `RESEND_FROM_EMAIL=alerts@yourdomain.com` after verifying the domain in the Resend dashboard.

### 6. Run Supabase migrations (if not already done)

In your Supabase project → **SQL Editor**, run the migrations from the section above.
