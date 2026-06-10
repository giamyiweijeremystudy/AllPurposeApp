# All-Purpose App v2

A fully customizable dashboard — **React + Supabase + Vercel**.

## Stack

| Layer | Tool | Why |
|-------|------|-----|
| Frontend | React + Vite | Fast builds, modern DX |
| Database | Supabase (Postgres) | Free tier, realtime-ready, auto REST API |
| Hosting | Vercel | Git-push deploys, free tier, instant CDN |
| Source | GitHub | Triggers Vercel deploys automatically |

---

## 1. Supabase setup

1. Go to [supabase.com](https://supabase.com) → your project
2. Open **SQL Editor** and run the contents of `supabase/migrations/001_init.sql`
3. Go to **Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

---

## 2. Local dev

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run dev        # http://localhost:5173
```

---

## 3. GitHub

```bash
git init
git add .
git commit -m "initial commit"
gh repo create all-purpose-app --public --push
# or: create on github.com and push manually
```

---

## 4. Vercel deploy

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Vercel auto-detects Vite — leave build settings as-is
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**

Every `git push` to `main` auto-deploys. ✅

---

## 5. Useful free tools to add next

| Tool | What for | Free tier |
|------|----------|-----------|
| [Supabase Auth](https://supabase.com/docs/guides/auth) | Add user login | Built-in |
| [Supabase Realtime](https://supabase.com/docs/guides/realtime) | Live widget updates | Built-in |
| [Sentry](https://sentry.io) | Error tracking | 5k errors/month |
| [Upstash](https://upstash.com) | Redis rate limiting / caching | 10k req/day |
| [Resend](https://resend.com) | Transactional email | 3k emails/month |
| [Cloudflare R2](https://cloudflare.com) | File uploads | 10GB free |
| [GitHub Actions](https://github.com/features/actions) | CI tests on push | 2000 min/month |

---

## Project structure

```
├── src/
│   ├── main.jsx        # entry point
│   ├── App.jsx         # main layout + state
│   ├── db.js           # all Supabase queries
│   ├── supabase.js     # client singleton
│   ├── Modals.jsx      # all modal forms
│   ├── WidgetCard.jsx  # widget renderer
│   ├── ui.jsx          # shared primitives
│   └── index.css       # global styles + CSS vars
├── supabase/
│   └── migrations/
│       └── 001_init.sql   # schema + seed data
├── vercel.json            # SPA routing
├── vite.config.js
└── .env.example
```
