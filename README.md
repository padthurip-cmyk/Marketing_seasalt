# 🔱 SeaSalt Intelligence Hub

Standalone competitive intelligence dashboard for **SeaSalt Pickles**.  
Tracks 10 competitors via Google Places API, stores data in Supabase, deployed on Netlify.

---

## 📁 Repo Structure

```
seasalt-intelligence/
├── public/
│   └── index.html                    ← Intelligence Dashboard (single-file)
├── netlify/
│   └── functions/
│       └── intel-sync.mjs            ← Google Places → Supabase sync
├── plugins/
│   └── inject-config/
│       ├── index.js                  ← Build plugin: injects Supabase config
│       └── manifest.yml
├── supabase-intel-tables.sql         ← Run once in Supabase SQL Editor
├── netlify.toml                      ← Build config + plugin registration
├── .gitignore
└── README.md
```

---

## 🚀 Setup (3 Steps)

### Step 1: Supabase Tables
1. Open **Supabase Dashboard** → SQL Editor → New Query
2. Paste contents of `supabase-intel-tables.sql`
3. Click **Run** → "Success. No rows returned" means it worked
4. Verify 10 tables exist in Table Editor

### Step 2: Deploy to Netlify
1. Create a **new site** from this GitHub repo on Netlify
2. Build settings auto-detected from `netlify.toml`:
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
3. Add **3 Environment Variables** (Site Settings → Environment Variables):

| Variable | Where to get it |
|----------|----------------|
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console → APIs → Places API |
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_KEY` | Supabase Dashboard → Settings → API → anon public key |

4. Deploy!

### Step 3: First Sync
1. Open your deployed site
2. Go to **Competitors** page
3. Click **"🔄 Sync Live Data"**
4. Wait 10-15 seconds — data populates from Google Places

---

## 📊 Dashboard Pages

| Page | What it does |
|------|-------------|
| 🏆 **Competitors** | Ratings, reviews, pricing, threat levels from Google Places |
| 🔍 **Social Spy** | Monitor competitor Instagram/YouTube/Facebook activity |
| 🧠 **Insights** | Opportunities, threats, trends, action items |
| 🎨 **Content Studio** | Content ideas & pipeline management |
| 📡 **Social Listeners** | Brand mention monitoring & keyword tracking |
| 📺 **Ad Library** | Competitor ad tracking (Meta Ad Library — public, no API needed) |
| 🔑 **Keyword Tracker** | SEO ranking positions & search volume |

---

## 🔧 How Config Injection Works

**No API keys are stored in source code.** The `plugins/inject-config` build plugin runs during Netlify's build step and generates a `_config.js` file from environment variables. This file is served to the browser but never committed to Git.

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

- **Zero hardcoded secrets** — all credentials injected at build time from Netlify env vars
- Sync button calls the Netlify serverless function → Google Places API → Supabase
- All styles are inline — zero external dependencies except Tailwind CDN + Supabase CDN
- Separate from your admin panel at `seasaltultimate-admin` repo
