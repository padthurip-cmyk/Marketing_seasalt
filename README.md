# 🔱 SeaSalt Intelligence Hub

Standalone competitive intelligence dashboard for **SeaSalt Pickles**.  
Tracks 10 competitors via Google Places API, stores data in Supabase, deployed on Netlify.

---

## 📁 Repo Structure

```
seasalt-intelligence/
├── public/
│   └── index.html              ← Intelligence Dashboard (single-file, all-in-one)
├── netlify/
│   └── functions/
│       └── intel-sync.mjs      ← Serverless function: Google Places → Supabase
├── supabase-intel-tables.sql   ← Run in Supabase SQL Editor (creates 10 tables)
├── netlify.toml                ← Netlify build & function config
├── .gitignore
└── README.md
```

---

## 🚀 Setup Guide (3 Steps)

### Step 1: Supabase Tables
1. Open **Supabase Dashboard** → SQL Editor → New Query
2. Paste the contents of `supabase-intel-tables.sql`
3. Click **Run** — you should see "Success. No rows returned"
4. Verify tables exist in Table Editor (10 tables created)

### Step 2: Deploy to Netlify
1. Create a **new site** on Netlify from this GitHub repo
2. Build settings (auto-detected from netlify.toml):
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
3. Add **Environment Variables** in Netlify (Site → Settings → Environment Variables):

| Variable | Value |
|----------|-------|
| `GOOGLE_PLACES_API_KEY` | `AIzaSyA33gWiI28GPZw2v-sOYYcyEyMTz9Lm5s8` |
| `SUPABASE_URL` | `https://yosjbsncvghpscsrvxds.supabase.co` |
| `SUPABASE_KEY` | Your Supabase anon key |

4. Deploy! 🎉

### Step 3: First Sync
1. Open your deployed site
2. Go to **Competitors** page
3. Click **"🔄 Sync Live Data"**
4. Wait 10-15 seconds — competitor data will populate from Google Places

---

## 📊 Dashboard Pages

| Page | What it does |
|------|-------------|
| 🏆 **Competitors** | Track 10 competitors — ratings, reviews, pricing, threat levels |
| 🔍 **Social Spy** | Monitor competitor Instagram/YouTube/Facebook activity |
| 🧠 **Insights** | AI-generated opportunities, threats, trends, action items |
| 🎨 **Content Studio** | Content ideas based on competitor gaps |
| 📡 **Social Listeners** | Brand mention monitoring & sentiment tracking |
| 📺 **Ad Library** | Track competitor advertising strategies |
| 🔑 **Keyword Tracker** | SEO ranking positions & search volume |
| 📊 **Reports** | Generate competitive intelligence reports |

---

## 🔧 Environment Variables

| Key | Where to get it |
|-----|----------------|
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console → APIs → Places API |
| `SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `SUPABASE_KEY` | Supabase Dashboard → Settings → API → anon public key |

---

## ⚡ API Endpoint

```
GET /.netlify/functions/intel-sync
```

Returns:
```json
{
  "status": "complete",
  "synced_at": "2026-02-16T...",
  "total": 10,
  "success": 10,
  "failed": 0,
  "results": [...]
}
```

---

## 📌 Notes

- Dashboard works with **demo data** even without Supabase tables — safe to deploy immediately
- Sync button calls the Netlify function which hits Google Places API
- Supabase anon key is embedded in the dashboard (same as your main site)
- All styles are inline — **zero external dependencies** except Tailwind CDN + Supabase CDN
- Separate from your admin panel at `seasaltultimate-admin` repo
