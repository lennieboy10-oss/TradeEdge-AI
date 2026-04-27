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
  notes        text default ''
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

## Environment variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (server only) |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (client) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable key |
| `STRIPE_PRICE_ID` | Monthly subscription price ID |
| `NEXT_PUBLIC_APP_URL` | App base URL, no trailing slash |
