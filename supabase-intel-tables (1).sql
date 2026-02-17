-- ═══════════════════════════════════════════════════════════════
-- SeaSalt Intelligence — Supabase Tables
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Competitor Profiles (core table) ─────────────────────
CREATE TABLE IF NOT EXISTS competitor_profiles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#666666',
  url TEXT,
  search_query TEXT,
  place_id TEXT,
  address TEXT,
  rating NUMERIC(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  lat NUMERIC(10,7) DEFAULT 0,
  lng NUMERIC(10,7) DEFAULT 0,
  business_status TEXT DEFAULT 'UNKNOWN',
  website TEXT,
  phone TEXT,
  google_maps_url TEXT,
  price_level INTEGER DEFAULT 0,
  is_open BOOLEAN DEFAULT false,
  recent_reviews JSONB DEFAULT '[]'::jsonb,
  photo_ref TEXT,
  instagram_url TEXT,
  instagram_followers INTEGER DEFAULT 0,
  facebook_url TEXT,
  facebook_followers INTEGER DEFAULT 0,
  youtube_url TEXT,
  youtube_subscribers INTEGER DEFAULT 0,
  social_score INTEGER DEFAULT 0,
  threat_level TEXT DEFAULT 'low',
  notes TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Competitor Social Posts ──────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_content (
  id BIGSERIAL PRIMARY KEY,
  competitor_name TEXT NOT NULL,
  competitor_code TEXT,
  platform TEXT NOT NULL,
  post_type TEXT,
  post_url TEXT,
  caption TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  sentiment TEXT DEFAULT 'neutral',
  hashtags TEXT[],
  posted_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. Social Listener Keywords ────────────────────────────
CREATE TABLE IF NOT EXISTS listener_keywords (
  id BIGSERIAL PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  platforms TEXT[] DEFAULT ARRAY['instagram','twitter','google'],
  total_mentions INTEGER DEFAULT 0,
  sentiment_score NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. Brand Mentions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_mentions (
  id BIGSERIAL PRIMARY KEY,
  keyword TEXT,
  source_platform TEXT NOT NULL,
  author TEXT,
  author_url TEXT,
  content TEXT,
  sentiment TEXT DEFAULT 'neutral',
  url TEXT,
  found_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. Competitor Ads ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_ads (
  id BIGSERIAL PRIMARY KEY,
  competitor_name TEXT NOT NULL,
  competitor_code TEXT,
  platform TEXT NOT NULL,
  ad_type TEXT,
  headline TEXT,
  description TEXT,
  landing_url TEXT,
  estimated_spend TEXT,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. Keyword Rankings (SEO) ──────────────────────────────
CREATE TABLE IF NOT EXISTS keyword_rankings (
  id BIGSERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  current_position INTEGER DEFAULT 0,
  previous_position INTEGER DEFAULT 0,
  change INTEGER DEFAULT 0,
  search_volume TEXT,
  difficulty TEXT DEFAULT 'Medium',
  target_url TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 7. Intelligence Insights ───────────────────────────────
CREATE TABLE IF NOT EXISTS intel_insights (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('opportunity','threat','trend','action')),
  title TEXT NOT NULL,
  body TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  is_dismissed BOOLEAN DEFAULT false,
  is_actioned BOOLEAN DEFAULT false,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 8. Content Ideas ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_ideas (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT,
  platform TEXT,
  estimated_engagement TEXT DEFAULT 'Medium',
  source_insight TEXT,
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea','planned','in_progress','published','archived')),
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 9. Sync Log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intel_sync_log (
  id BIGSERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  competitors_synced INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  duration_ms INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. Hashtag Tracker ────────────────────────────────────
CREATE TABLE IF NOT EXISTS hashtag_tracker (
  id BIGSERIAL PRIMARY KEY,
  hashtag TEXT NOT NULL UNIQUE,
  total_posts TEXT,
  avg_engagement TEXT,
  growth_rate TEXT,
  used_by TEXT[],
  trend TEXT DEFAULT 'stable',
  last_checked TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- INDEXES for fast queries
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_cp_code ON competitor_profiles(code);
CREATE INDEX IF NOT EXISTS idx_cp_name ON competitor_profiles(name);
CREATE INDEX IF NOT EXISTS idx_cc_comp ON competitor_content(competitor_name);
CREATE INDEX IF NOT EXISTS idx_cc_platform ON competitor_content(platform);
CREATE INDEX IF NOT EXISTS idx_bm_keyword ON brand_mentions(keyword);
CREATE INDEX IF NOT EXISTS idx_bm_platform ON brand_mentions(source_platform);
CREATE INDEX IF NOT EXISTS idx_kr_keyword ON keyword_rankings(keyword);
CREATE INDEX IF NOT EXISTS idx_ii_type ON intel_insights(type);
CREATE INDEX IF NOT EXISTS idx_ci_status ON content_ideas(status);


-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — Enable public read, authenticated write
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE competitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE listener_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtag_tracker ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (for admin dashboard — no auth gate yet)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'competitor_profiles','competitor_content','listener_keywords',
      'brand_mentions','competitor_ads','keyword_rankings',
      'intel_insights','content_ideas','intel_sync_log','hashtag_tracker'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "public_read_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "public_read_%s" ON %I FOR SELECT USING (true)', tbl, tbl);
    
    EXECUTE format('DROP POLICY IF EXISTS "public_write_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "public_write_%s" ON %I FOR INSERT WITH CHECK (true)', tbl, tbl);
    
    EXECUTE format('DROP POLICY IF EXISTS "public_update_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "public_update_%s" ON %I FOR UPDATE USING (true)', tbl, tbl);
    
    EXECUTE format('DROP POLICY IF EXISTS "public_delete_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "public_delete_%s" ON %I FOR DELETE USING (true)', tbl, tbl);
  END LOOP;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- SEED DATA — Default competitors (will be overwritten by sync)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO competitor_profiles (name, code, color, url, search_query, threat_level)
VALUES
  ('Vellanki Foods', 'VF', '#C2410C', 'vellankifoods.com', 'Vellanki Foods pickles Hyderabad', 'high'),
  ('Tulasi Pickles', 'TP', '#16A34A', 'tulasipickles.com', 'Tulasi Pickles Hyderabad', 'medium'),
  ('Aavarampoo Pickles', 'AP', '#7C3AED', 'aavarampoo.com', 'Aavarampoo Pickles Hyderabad', 'high'),
  ('Nirupama Pickles', 'NP', '#DC2626', 'nirupamapickles.in', 'Nirupama Pickles Hyderabad', 'medium'),
  ('Priya Pickles', 'PP', '#0891B2', 'priyapickles.com', 'Priya Pickles Hyderabad', 'high'),
  ('Ammas Homemade Pickles', 'AH', '#EA580C', 'ammashomemade.in', 'Ammas Homemade Pickles Hyderabad', 'low'),
  ('Sitara Pickles', 'SP', '#65A30D', 'sitarapickles.com', 'Sitara Pickles Hyderabad', 'low'),
  ('Ruchulu Pickles', 'RP', '#9333EA', 'ruchulupickles.com', 'Ruchulu Pickles Hyderabad', 'medium'),
  ('Andhra Pickles', 'AC', '#0369A1', 'andhrapickles.co', 'Andhra Pickles online Hyderabad', 'low'),
  ('Hyderabad Pickles', 'HP', '#B91C1C', 'hyderabadpickles.in', 'Hyderabad Pickles online', 'medium')
ON CONFLICT (code) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- DONE! You should see "Success. No rows returned" — that's OK
-- ═══════════════════════════════════════════════════════════════
