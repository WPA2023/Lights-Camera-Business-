# Lights, Camera, Business

A SaaS web app for freelance filmmakers with tiered tool subscriptions.

## Pricing

| Tier | Price | Tools |
|------|-------|-------|
| Starter | Free | Shot List, Storyboard |
| Indie | $12/mo (25% off) | + Budget Tracker, Location Scout |
| Pro | $25/mo (45% off) | + Equipment Checkout, Call Sheet, Invoice |

---

## Tools

### Shot List (Starter - Free)
[Preview](images/shotlist.html) · Plan every shot for your shoot. Add shot number, description, camera angle, lens, and duration.

### Storyboard (Starter - Free)
[Preview](images/storyboard.html) · Draw or describe each scene visually. Frame-by-frame planning with notes for camera movement.

### Budget Tracker (Indie)
[Preview](images/budget.html) · Track all your production expenses in one place. Categories for gear, crew, locations, catering, and more.

### Location Scout (Indie)
[Preview](images/locationscout.html) · Find and save potential filming locations. Store photos, addresses, contact info, and notes.

### Equipment Checkout (Pro)
[Preview](images/equipment.html) · Keep track of who has what gear. Log rentals, returns, and condition reports.

### Call Sheet (Pro)
[Preview](images/callsheet.html) · Generate professional daily shoot schedules. Cast, crew, call times, locations, and meal breaks.

### Invoice (Pro)
[Preview](images/invoice.html) · Create and send invoices to clients. Itemized billing with payment tracking.

---

## Setup

### 1. Supabase (Database & Auth)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase-setup.sql`
3. Get your `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Settings → API

### 2. Stripe (Payments)

1. Create a Stripe account
2. Get your `STRIPE_SECRET_KEY` from Developers → API Keys
3. Go to Developers → Webhooks → Add endpoint
4. Enter your deployed URL: `https://your-app.onrender.com/api/webhook`
5. Select events: `checkout.session.completed`
6. Copy the **signing secret** (starts with `whsec_`) and add it as `STRIPE_WEBHOOK_SECRET`

**Important:** For local testing, use Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/webhook
```

### 3. Environment Variables

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export STRIPE_SECRET_KEY="sk_test_xxx"
export STRIPE_WEBHOOK_SECRET="whsec_xxx"
export APP_URL="http://localhost:3000"
```

### 4. Run

```bash
npm install
npm start
```

Visit http://localhost:3000

## Deploy

**Recommended:** Render, Railway, or Fly.io

Set the same environment variables on your host.

## Tech Stack

- Frontend: Vanilla HTML/CSS/JS
- Backend: Express.js
- Database & Auth: Supabase (PostgreSQL)
- Payments: Stripe