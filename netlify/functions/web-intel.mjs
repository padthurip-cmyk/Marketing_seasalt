// ═══════════════════════════════════════════════════════════════════
// SeaSalt Intelligence — Website Intelligence Scraper v1
// ═══════════════════════════════════════════════════════════════════
// Pulls from EVERY competitor website + SeaSalt:
// 1. Google PageSpeed API → performance, SEO, accessibility scores
// 2. Product page scraping → categories, prices, product count
// 3. SEO analysis → title, meta, headings, schema markup
// 4. Tech stack detection → platform, analytics, payment, chat
// 5. Security check → SSL, headers, HTTPS redirect
// 6. Comparison with SeaSalt's own website
// ═══════════════════════════════════════════════════════════════════

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_KEY || '';

// All websites to analyze (competitors + SeaSalt)
const SITES = [
  { name: "SeaSalt Pickles", code: "SS", url: "seasaltpickles.com", is_self: true, color: "#dc2626" },
  { name: "Vellanki Foods", code: "VF", url: "vellankifoods.com", color: "#C2410C" },
  { name: "Tulasi Pickles", code: "TP", url: "tulasipickles.com", color: "#16A34A" },
  { name: "Aavarampoo Pickles", code: "AP", url: "aavarampoo.com", color: "#7C3AED" },
  { name: "Nirupama Pickles", code: "NP", url: "nirupamapickles.in", color: "#DC2626" },
  { name: "Priya Pickles", code: "PP", url: "priyapickles.com", color: "#0891B2" },
  { name: "Ammas Homemade Pickles", code: "AH", url: "ammashomemade.in", color: "#EA580C" },
  { name: "Sitara Pickles", code: "SP", url: "sitarapickles.com", color: "#65A30D" },
  { name: "Ruchulu Pickles", code: "RP", url: "ruchulupickles.com", color: "#9333EA" },
  { name: "Andhra Pickles", code: "AC", url: "andhrapickles.co", color: "#0369A1" },
  { name: "Hyderabad Pickles", code: "HP", url: "hyderabadpickles.in", color: "#B91C1C" }
];

// ═══════ 1. GOOGLE PAGESPEED INSIGHTS ═══════
async function getPageSpeed(siteUrl) {
  try {
    const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${siteUrl}&category=performance&category=seo&category=accessibility&category=best-practices&strategy=mobile&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      console.log(`[pagespeed] ${siteUrl}: ${data.error.message}`);
      return null;
    }

    const lh = data.lighthouseResult;
    if (!lh) return null;

    return {
      performance_score: Math.round((lh.categories?.performance?.score || 0) * 100),
      seo_score: Math.round((lh.categories?.seo?.score || 0) * 100),
      accessibility_score: Math.round((lh.categories?.accessibility?.score || 0) * 100),
      best_practices_score: Math.round((lh.categories?.['best-practices']?.score || 0) * 100),
      first_contentful_paint: lh.audits?.['first-contentful-paint']?.displayValue || '',
      largest_contentful_paint: lh.audits?.['largest-contentful-paint']?.displayValue || '',
      total_blocking_time: lh.audits?.['total-blocking-time']?.displayValue || '',
      speed_index: lh.audits?.['speed-index']?.displayValue || '',
      cumulative_layout_shift: lh.audits?.['cumulative-layout-shift']?.displayValue || '',
      is_mobile_friendly: (lh.categories?.seo?.score || 0) >= 0.8,
      final_url: lh.finalUrl || siteUrl,
      fetch_time_ms: lh.timing?.total || 0
    };
  } catch (e) {
    console.log(`[pagespeed] ${siteUrl}: ${e.message}`);
    return null;
  }
}

// ═══════ 2. WEBSITE SCRAPING — products, prices, SEO ═══════
async function scrapeWebsite(siteUrl) {
  const base = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  let html = '';

  try {
    const res = await fetch(base, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return { reachable: false, status: res.status };
    html = await res.text();
  } catch (e) {
    console.log(`[scrape] ${siteUrl}: ${e.message}`);
    return { reachable: false, error: e.message };
  }

  // ── SEO Meta ──
  const getMetaContent = (name) => {
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i')
    ];
    for (const p of patterns) { const m = html.match(p); if (m) return m[1]; }
    return null;
  };

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';

  // ── Product extraction ──
  const products = extractProducts(html);
  const categories = extractCategories(html);

  // ── Price extraction ──
  const prices = extractPrices(html);

  // ── Social links ──
  const socialLinks = {};
  const socialPatterns = {
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi,
    facebook: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.]+/gi,
    youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|c\/|@)[a-zA-Z0-9_.-]+/gi,
    twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/gi,
    whatsapp: /https?:\/\/wa\.me\/[0-9]+/gi
  };
  for (const [platform, regex] of Object.entries(socialPatterns)) {
    const matches = html.match(regex);
    if (matches) socialLinks[platform] = [...new Set(matches)][0];
  }

  // ── Tech stack ──
  const techStack = detectTechStack(html);

  // ── Security ──
  const hasSSL = base.startsWith('https');
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const hasRobots = getMetaContent('robots') || null;
  const hasViewport = getMetaContent('viewport') || null;
  const hasStructuredData = /application\/ld\+json/i.test(html);

  // ── Schema.org product data ──
  let schemaProducts = [];
  const schemaMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const sm of schemaMatches) {
    try {
      const json = sm.replace(/<\/?script[^>]*>/gi, '');
      const data = JSON.parse(json);
      if (data['@type'] === 'Product' || (Array.isArray(data['@graph']) && data['@graph'].some(g => g['@type'] === 'Product'))) {
        const prod = data['@type'] === 'Product' ? data : data['@graph'].find(g => g['@type'] === 'Product');
        if (prod) {
          schemaProducts.push({
            name: prod.name,
            price: prod.offers?.price || prod.offers?.lowPrice,
            currency: prod.offers?.priceCurrency || 'INR',
            availability: prod.offers?.availability,
            rating: prod.aggregateRating?.ratingValue,
            review_count: prod.aggregateRating?.reviewCount
          });
        }
      }
    } catch (e) {}
  }

  return {
    reachable: true,
    title,
    h1,
    meta_description: getMetaContent('description') || '',
    og_image: getMetaContent('og:image') || '',
    products,
    product_count: products.length,
    categories,
    category_count: categories.length,
    prices,
    price_range: prices.length ? { min: Math.min(...prices), max: Math.max(...prices), avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) } : null,
    social_links: socialLinks,
    tech_stack: techStack,
    has_ssl: hasSSL,
    has_canonical: hasCanonical,
    has_robots: !!hasRobots,
    has_viewport: !!hasViewport,
    has_structured_data: hasStructuredData,
    schema_products: schemaProducts,
    has_ecommerce: /add.to.cart|buy.now|shop.now|cart|checkout/i.test(html),
    has_blog: /\/blog|\/articles|\/news|\/recipes/i.test(html),
    has_whatsapp: /wa\.me|whatsapp/i.test(html),
    word_count: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 2).length,
    image_count: (html.match(/<img/gi) || []).length,
    internal_links: (html.match(/href=["']\/[^"']+["']/gi) || []).length,
    external_links: (html.match(/href=["']https?:\/\/[^"']+["']/gi) || []).length
  };
}

function extractProducts(html) {
  const products = [];
  // Common product card patterns
  const patterns = [
    /<(?:h[234]|div|a)[^>]*class=["'][^"']*product[-_]?(?:name|title)[^"']*["'][^>]*>([^<]{3,80})</g,
    /<(?:h[234]|div|span)[^>]*class=["'][^"']*woocommerce-loop-product__title[^"']*["'][^>]*>([^<]{3,80})</g,
    /<(?:h[234])[^>]*class=["'][^"']*card[-_]?title[^"']*["'][^>]*>([^<]{3,80})</g,
    /data-product-name=["']([^"']{3,80})["']/g,
    /itemprop=["']name["'][^>]*>([^<]{3,80})</g
  ];

  for (const p of patterns) {
    let m;
    while ((m = p.exec(html)) !== null) {
      const name = m[1].replace(/<[^>]+>/g, '').trim();
      if (name.length > 3 && name.length < 80 && !products.includes(name)) {
        products.push(name);
      }
    }
  }
  return products.slice(0, 50);
}

function extractCategories(html) {
  const cats = new Set();
  const patterns = [
    /class=["'][^"']*cat(?:egory)?[-_]?(?:name|title|link)[^"']*["'][^>]*>([^<]{3,50})/gi,
    /\/(?:product-category|category|collections?)\/([a-zA-Z0-9-]+)/gi,
    new RegExp('<li[^>]*class=["\'][^"\']*cat-item[^"\']*["\'][^>]*>[^<]*<a[^>]*>([^<]{3,50})<\\/a', 'gi')
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(html)) !== null) {
      const cat = m[1].replace(/<[^>]+>/g, '').replace(/-/g, ' ').trim();
      if (cat.length > 2 && cat.length < 50) cats.add(cat);
    }
  }
  return [...cats].slice(0, 20);
}

function extractPrices(html) {
  const prices = [];
  // Match ₹XXX or Rs. XXX or INR XXX patterns
  const priceRegex = /(?:₹|Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi;
  let m;
  while ((m = priceRegex.exec(html)) !== null) {
    const price = parseFloat(m[1].replace(/,/g, ''));
    if (price > 10 && price < 50000 && !prices.includes(price)) {
      prices.push(price);
    }
  }
  return prices.sort((a, b) => a - b).slice(0, 100);
}

function detectTechStack(html) {
  const stack = [];
  if (/shopify/i.test(html)) stack.push('Shopify');
  if (/woocommerce|wordpress|wp-content/i.test(html)) stack.push('WordPress');
  if (/squarespace/i.test(html)) stack.push('Squarespace');
  if (/wix\.com/i.test(html)) stack.push('Wix');
  if (/react|__next/i.test(html)) stack.push('React/Next.js');
  if (/angular/i.test(html)) stack.push('Angular');
  if (/vue\.js/i.test(html)) stack.push('Vue.js');
  if (/razorpay/i.test(html)) stack.push('Razorpay');
  if (/stripe/i.test(html)) stack.push('Stripe');
  if (/instamojo/i.test(html)) stack.push('Instamojo');
  if (/paytm/i.test(html)) stack.push('Paytm');
  if (/phonepe/i.test(html)) stack.push('PhonePe');
  if (/gtm\.js|google.tag.manager/i.test(html)) stack.push('GTM');
  if (/google.analytics|gtag/i.test(html)) stack.push('Google Analytics');
  if (/fbq|facebook.pixel/i.test(html)) stack.push('Facebook Pixel');
  if (/hotjar/i.test(html)) stack.push('Hotjar');
  if (/tawk\.to/i.test(html)) stack.push('Tawk.to');
  if (/crisp\.chat/i.test(html)) stack.push('Crisp');
  if (/mailchimp/i.test(html)) stack.push('Mailchimp');
  if (/klaviyo/i.test(html)) stack.push('Klaviyo');
  if (/shiprocket/i.test(html)) stack.push('Shiprocket');
  if (/delhivery/i.test(html)) stack.push('Delhivery');
  if (/cloudflare/i.test(html)) stack.push('Cloudflare');
  if (/recaptcha/i.test(html)) stack.push('reCAPTCHA');
  return stack;
}

// ═══════ 3. SITE SCORE CALCULATOR ═══════
function calculateSiteScore(pageSpeed, scrape) {
  let score = 0;
  let maxScore = 0;

  // Performance (25 points)
  if (pageSpeed) {
    score += Math.round(pageSpeed.performance_score * 0.25);
    maxScore += 25;
  }

  // SEO (25 points)
  if (pageSpeed) {
    score += Math.round(pageSpeed.seo_score * 0.25);
    maxScore += 25;
  }

  // E-commerce readiness (20 points)
  if (scrape) {
    if (scrape.has_ecommerce) score += 8;
    if (scrape.product_count > 0) score += 4;
    if (scrape.price_range) score += 4;
    if (scrape.has_structured_data) score += 4;
    maxScore += 20;
  }

  // Content & marketing (15 points)
  if (scrape) {
    if (scrape.has_blog) score += 5;
    if (scrape.social_links?.instagram) score += 3;
    if (scrape.social_links?.facebook) score += 2;
    if (scrape.social_links?.youtube) score += 3;
    if (scrape.has_whatsapp) score += 2;
    maxScore += 15;
  }

  // Technical (15 points)
  if (scrape) {
    if (scrape.has_ssl) score += 5;
    if (scrape.has_viewport) score += 3;
    if (scrape.has_canonical) score += 3;
    if (scrape.tech_stack?.includes('Google Analytics')) score += 2;
    if (scrape.tech_stack?.includes('Facebook Pixel')) score += 2;
    maxScore += 15;
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

// ═══════ 4. SUPABASE ═══════
async function sbInsert(table, data) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Prefer': 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(data)
    });
    return res.ok;
  } catch (e) { return false; }
}

// ═══════ MAIN HANDLER ═══════
export const handler = async (event) => {
  const H = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

  const params = event.queryStringParameters || {};

  // Single site test mode
  if (params.site) {
    console.log(`[WEB-INTEL] Testing: ${params.site}`);
    const ps = await getPageSpeed(params.site);
    const sc = await scrapeWebsite(params.site);
    const score = calculateSiteScore(ps, sc);
    return {
      statusCode: 200, headers: H,
      body: JSON.stringify({ mode: 'single_test', site: params.site, site_score: score, pagespeed: ps, scrape: sc }, null, 2)
    };
  }

  // Validate
  if (!SB_KEY || !SB_URL) return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'Supabase not configured' }) };

  console.log(`\n[WEB-INTEL] ═══ Analyzing ${SITES.length} websites ═══`);
  const startTime = Date.now();
  const results = [];

  for (const site of SITES) {
    console.log(`\n[${site.code}] ─── ${site.name} (${site.url}) ───`);

    // PageSpeed (takes 10-30 seconds per site)
    console.log(`[${site.code}] ⚡ Running PageSpeed...`);
    const ps = await getPageSpeed(site.url);
    console.log(`[${site.code}] PageSpeed: ${ps ? `Perf ${ps.performance_score}, SEO ${ps.seo_score}` : '✗'}`);

    // Website scraping
    console.log(`[${site.code}] 🌐 Scraping website...`);
    const sc = await scrapeWebsite(site.url);
    console.log(`[${site.code}] Scrape: ${sc.reachable ? `${sc.product_count} products, ${sc.category_count} cats` : '✗ unreachable'}`);

    const siteScore = calculateSiteScore(ps, sc);
    console.log(`[${site.code}] Site Score: ${siteScore}/100`);

    // Save to Supabase
    const row = {
      name: site.name,
      code: site.code,
      url: site.url,
      color: site.color,
      is_self: site.is_self || false,
      reachable: sc.reachable || false,
      // PageSpeed scores
      performance_score: ps?.performance_score || 0,
      seo_score: ps?.seo_score || 0,
      accessibility_score: ps?.accessibility_score || 0,
      best_practices_score: ps?.best_practices_score || 0,
      first_contentful_paint: ps?.first_contentful_paint || '',
      largest_contentful_paint: ps?.largest_contentful_paint || '',
      speed_index: ps?.speed_index || '',
      is_mobile_friendly: ps?.is_mobile_friendly || false,
      // Website content
      page_title: sc.title || '',
      meta_description: sc.meta_description || '',
      product_count: sc.product_count || 0,
      products: JSON.stringify(sc.products || []),
      category_count: sc.category_count || 0,
      categories: JSON.stringify(sc.categories || []),
      price_min: sc.price_range?.min || 0,
      price_max: sc.price_range?.max || 0,
      price_avg: sc.price_range?.avg || 0,
      // Tech & features
      tech_stack: JSON.stringify(sc.tech_stack || []),
      has_ecommerce: sc.has_ecommerce || false,
      has_blog: sc.has_blog || false,
      has_whatsapp: sc.has_whatsapp || false,
      has_ssl: sc.has_ssl || false,
      has_structured_data: sc.has_structured_data || false,
      social_links: JSON.stringify(sc.social_links || {}),
      // Metrics
      image_count: sc.image_count || 0,
      word_count: sc.word_count || 0,
      internal_links: sc.internal_links || 0,
      external_links: sc.external_links || 0,
      // Overall score
      site_score: siteScore,
      scanned_at: new Date().toISOString()
    };

    const saved = await sbInsert('website_intelligence', row);

    results.push({
      name: site.name,
      code: site.code,
      url: site.url,
      is_self: site.is_self || false,
      reachable: sc.reachable || false,
      site_score: siteScore,
      performance: ps?.performance_score || 0,
      seo: ps?.seo_score || 0,
      products: sc.product_count || 0,
      categories: sc.category_count || 0,
      price_range: sc.price_range || null,
      has_ecommerce: sc.has_ecommerce || false,
      tech_stack: sc.tech_stack || [],
      saved
    });

    // Delay between sites to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  const duration = Date.now() - startTime;
  const seasalt = results.find(r => r.is_self);
  const competitors = results.filter(r => !r.is_self);

  // Generate comparison insights
  let comparison = null;
  if (seasalt) {
    const avgCompScore = competitors.reduce((s, c) => s + c.site_score, 0) / (competitors.length || 1);
    const betterThanCount = competitors.filter(c => seasalt.site_score > c.site_score).length;
    comparison = {
      seasalt_score: seasalt.site_score,
      avg_competitor_score: Math.round(avgCompScore),
      seasalt_rank: competitors.filter(c => c.site_score > seasalt.site_score).length + 1,
      better_than: betterThanCount,
      total_competitors: competitors.length
    };
  }

  console.log(`\n[WEB-INTEL] ═══ Done: ${results.length} sites, ${duration}ms ═══`);

  return {
    statusCode: 200, headers: H,
    body: JSON.stringify({
      status: 'complete',
      version: 'web_intel_v1',
      scanned_at: new Date().toISOString(),
      duration_ms: duration,
      total_sites: results.length,
      comparison,
      results
    }, null, 2)
  };
};
