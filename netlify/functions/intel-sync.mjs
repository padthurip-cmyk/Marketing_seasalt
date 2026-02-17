// ═══════════════════════════════════════════════════════════════════
// SeaSalt Intelligence — Website Intelligence Scraper v2
// ═══════════════════════════════════════════════════════════════════
// UPGRADED from v1:
// ✅ Verified real competitor URLs (all tested & live)
// ✅ Multi-page crawling (homepage + /collections + /shop + /products)
// ✅ Deeper product extraction (Shopify JSON, WooCommerce, Schema.org)
// ✅ Better price parsing (handles more INR formats)
// ✅ Shopify /products.json endpoint for full product catalog
// ✅ Improved timeout handling and error recovery
// ═══════════════════════════════════════════════════════════════════

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_KEY || '';

// ═══════ VERIFIED REAL WEBSITES (all confirmed live Feb 2026) ═══════
const SITES = [
  { name: "SeaSalt Pickles", code: "SS", url: "seasaltpickles.com", is_self: true, color: "#dc2626" },
  { name: "Vellanki Foods", code: "VF", url: "vellankifoods.com", color: "#C2410C" },
  { name: "Priya Foods", code: "PP", url: "priyafoods.com", color: "#0891B2" },
  { name: "Sitara Foods", code: "SP", url: "sitarafoods.com", color: "#65A30D" },
  { name: "Fia Home Foods", code: "FH", url: "fiahomefoods.com", color: "#7C3AED" },
  { name: "Jampani Foods", code: "JF", url: "jampanifoods.com", color: "#EA580C" },
  { name: "Jandhyala Foods", code: "JD", url: "jandhyalafoods.in", color: "#9333EA" },
  { name: "Nirmala Foods", code: "NF", url: "nirmalafoods.com", color: "#DC2626" },
  { name: "Swagruha Pickles", code: "SG", url: "swagruhapickles.com", color: "#0369A1" },
  { name: "Amaravathi Pickles", code: "AM", url: "amaravathipickles.com", color: "#B91C1C" },
  { name: "Konaseema Foods", code: "KF", url: "konaseemaspecialfoods.com", color: "#16A34A" }
];

const UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// ═══════ HELPER: fetch with timeout ═══════
async function safeFetch(url, timeoutMs = 15000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/json,*/*', 'Accept-Language': 'en-IN,en;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs)
    });
    return res;
  } catch (e) {
    return null;
  }
}

// ═══════ 1. GOOGLE PAGESPEED INSIGHTS ═══════
async function getPageSpeed(siteUrl) {
  if (!GOOGLE_KEY) {
    console.log(`[pagespeed] ${siteUrl}: No API key`);
    return null;
  }
  try {
    const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${siteUrl}&category=performance&category=seo&category=accessibility&category=best-practices&strategy=mobile&key=${GOOGLE_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
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

// ═══════ 2. FETCH PAGE HTML ═══════
async function fetchPage(url) {
  const base = url.startsWith('http') ? url : `https://${url}`;
  try {
    const res = await safeFetch(base, 15000);
    if (!res || !res.ok) return '';
    return await res.text();
  } catch (e) {
    return '';
  }
}

// ═══════ 3. SHOPIFY PRODUCTS.JSON ═══════
async function fetchShopifyProducts(siteUrl) {
  const products = [];
  const prices = [];

  for (let page = 1; page <= 3; page++) {
    try {
      const url = `https://${siteUrl}/products.json?limit=250&page=${page}`;
      const res = await safeFetch(url, 10000);
      if (!res || !res.ok) break;

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { break; }

      if (!data.products || data.products.length === 0) break;

      for (const p of data.products) {
        if (p.title && !products.includes(p.title)) {
          products.push(p.title);
        }
        if (p.variants) {
          for (const v of p.variants) {
            const price = parseFloat(v.price);
            if (price > 0 && price < 50000 && !prices.includes(price)) {
              prices.push(price);
            }
          }
        }
      }

      console.log(`  [shopify] Page ${page}: ${data.products.length} products`);
      if (data.products.length < 250) break;
    } catch (e) { break; }
  }

  return { products, prices };
}

// ═══════ 4. COLLECTIONS PAGE SCRAPING ═══════
async function fetchCollectionPages(siteUrl) {
  const extraProducts = [];
  const extraPrices = [];
  const extraCategories = [];

  const paths = [
    '/collections', '/collections/all', '/shop', '/products',
    '/product-category/pickles', '/product-category/non-veg-pickles',
    '/product-category/veg-pickles', '/collections/pickles',
    '/collections/non-veg-pickles', '/collections/veg-pickles'
  ];

  let pagesScraped = 0;
  for (const path of paths) {
    if (pagesScraped >= 3) break;

    const html = await fetchPage(`https://${siteUrl}${path}`);
    if (!html || html.length < 500) continue;

    pagesScraped++;
    console.log(`  [deep] Scraped ${path} (${html.length} chars)`);

    const prods = extractProducts(html);
    for (const p of prods) {
      if (!extraProducts.includes(p)) extraProducts.push(p);
    }

    const prs = extractPrices(html);
    for (const p of prs) {
      if (!extraPrices.includes(p)) extraPrices.push(p);
    }

    const cats = extractCategories(html);
    for (const c of cats) {
      if (!extraCategories.includes(c)) extraCategories.push(c);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return { products: extraProducts, prices: extraPrices, categories: extraCategories };
}

// ═══════ 5. MAIN WEBSITE SCRAPE (homepage) ═══════
async function scrapeWebsite(siteUrl) {
  const base = `https://${siteUrl}`;
  let html = '';

  try {
    const res = await safeFetch(base, 15000);
    if (!res || !res.ok) return { reachable: false, status: res?.status || 0 };
    html = await res.text();
  } catch (e) {
    console.log(`[scrape] ${siteUrl}: ${e.message}`);
    return { reachable: false, error: e.message };
  }

  if (!html || html.length < 100) {
    return { reachable: false, error: 'Empty response' };
  }

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

  const products = extractProducts(html);
  const categories = extractCategories(html);
  const prices = extractPrices(html);

  const socialLinks = {};
  const socialPatterns = {
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi,
    facebook: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.]+/gi,
    youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|c\/|@)[a-zA-Z0-9_.-]+/gi,
    twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/gi,
    whatsapp: /https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[0-9]+/gi,
    linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_.-]+/gi
  };
  for (const [platform, regex] of Object.entries(socialPatterns)) {
    const matches = html.match(regex);
    if (matches) socialLinks[platform] = [...new Set(matches)][0];
  }
  if (!socialLinks.whatsapp && /whatsapp|wa\.me/i.test(html)) {
    socialLinks.whatsapp = 'detected';
  }

  const techStack = detectTechStack(html);

  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const hasViewport = !!getMetaContent('viewport');
  const hasStructuredData = /application\/ld\+json/i.test(html);

  // Schema.org products
  const schemaProducts = [];
  const schemaMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const sm of schemaMatches) {
    try {
      const json = sm.replace(/<\/?script[^>]*>/gi, '');
      const data = JSON.parse(json);
      const processSchema = (item) => {
        if (item?.['@type'] === 'Product' && item.name) {
          schemaProducts.push({ name: item.name, price: item.offers?.price || item.offers?.lowPrice, currency: item.offers?.priceCurrency || 'INR' });
          if (!products.includes(item.name)) products.push(item.name);
          const p = parseFloat(item.offers?.price || item.offers?.lowPrice);
          if (p > 0 && p < 50000 && !prices.includes(p)) prices.push(p);
        }
      };
      if (Array.isArray(data)) data.forEach(processSchema);
      else if (data['@graph']) data['@graph'].forEach(processSchema);
      else processSchema(data);
    } catch (e) {}
  }

  const hasEcommerce = /add.to.cart|buy.now|shop.now|add-to-cart|addtocart|product-price|cart-btn|shopify|woocommerce|checkout|purchase/i.test(html);

  return {
    reachable: true,
    html_length: html.length,
    title, h1,
    meta_description: getMetaContent('description') || '',
    og_image: getMetaContent('og:image') || '',
    products, product_count: products.length,
    categories, category_count: categories.length,
    prices,
    price_range: prices.length ? { min: Math.min(...prices), max: Math.max(...prices), avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) } : null,
    social_links: socialLinks,
    tech_stack: techStack,
    has_ssl: true,
    has_canonical: hasCanonical,
    has_robots: !!getMetaContent('robots'),
    has_viewport: hasViewport,
    has_structured_data: hasStructuredData,
    schema_products: schemaProducts,
    has_ecommerce: hasEcommerce,
    has_blog: /\/blog|\/articles|\/news|\/recipes/i.test(html),
    has_whatsapp: /wa\.me|whatsapp|api\.whatsapp/i.test(html),
    word_count: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 2).length,
    image_count: (html.match(/<img/gi) || []).length,
    internal_links: (html.match(/href=["']\/[^"']+["']/gi) || []).length,
    external_links: (html.match(/href=["']https?:\/\/[^"']+["']/gi) || []).length
  };
}

// ═══════ PRODUCT EXTRACTION ═══════
function extractProducts(html) {
  const products = [];
  const seen = new Set();

  const patterns = [
    /<(?:h[2-4]|a|div|span)[^>]*class=["'][^"']*product[-_]?(?:card)?[-_]?(?:name|title|heading)[^"']*["'][^>]*>([^<]{3,100})/gi,
    /<(?:h[2-4]|a|div|span)[^>]*class=["'][^"']*card[-_]?(?:title|name|heading)[^"']*["'][^>]*>([^<]{3,100})/gi,
    /<(?:h[2-4])[^>]*class=["'][^"']*woocommerce-loop-product__title[^"']*["'][^>]*>([^<]{3,100})/gi,
    /data-product-(?:name|title)=["']([^"']{3,100})["']/gi,
    /itemprop=["']name["'][^>]*>([^<]{3,100})/gi,
    /class=["'][^"']*grid-product__title[^"']*["'][^>]*>([^<]{3,100})/gi,
    /class=["'][^"']*product-item__title[^"']*["'][^>]*>([^<]{3,100})/gi,
    /<img[^>]+class=["'][^"']*product[^"']*["'][^>]+alt=["']([^"']{5,80})["']/gi,
  ];

  for (const p of patterns) {
    let m;
    while ((m = p.exec(html)) !== null) {
      const name = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
      const lower = name.toLowerCase();
      if (name.length > 3 && name.length < 100 && !seen.has(lower)
          && !/^(home|about|contact|blog|faq|login|cart|menu|search|shop|close)/i.test(name)
          && !/^\d+$/.test(name)) {
        seen.add(lower);
        products.push(name);
      }
    }
  }
  return products.slice(0, 100);
}

// ═══════ CATEGORY EXTRACTION ═══════
function extractCategories(html) {
  const cats = new Set();
  const patterns = [
    /\/(?:product-category|category|collections?)\/([a-zA-Z0-9-]+)/gi,
    /class=["'][^"']*cat(?:egory)?[-_]?(?:name|title|link|item)[^"']*["'][^>]*>([^<]{3,50})/gi,
    /<li[^>]*class=["'][^"']*cat-item[^"']*["'][^>]*>[^<]*<a[^>]*>([^<]{3,50})<\/a/gi,
  ];

  const junkCats = new Set(['all', 'home', 'about', 'contact', 'blog', 'faq', 'page', 'cart', 'account', 'login', 'search', 'collections', 'products', 'shop', 'new', 'sale', 'featured', 'frontpage', 'index']);

  for (const p of patterns) {
    let m;
    while ((m = p.exec(html)) !== null) {
      const cat = m[1].replace(/<[^>]+>/g, '').replace(/-/g, ' ').replace(/&amp;/g, '&').trim();
      const lower = cat.toLowerCase();
      if (cat.length > 2 && cat.length < 50 && !junkCats.has(lower)) cats.add(cat);
    }
  }
  return [...cats].slice(0, 30);
}

// ═══════ PRICE EXTRACTION ═══════
function extractPrices(html) {
  const prices = [];
  const seen = new Set();

  const patterns = [
    /(?:₹|Rs\.?\s*|INR\s*|price["':\s]*₹?\s*)([0-9,]+(?:\.[0-9]{1,2})?)/gi,
    /data-price=["']([0-9.]+)["']/gi,
    /"price"\s*:\s*"?([0-9.]+)"?/gi,
    /class=["'][^"']*price[^"']*["'][^>]*>[^₹]*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
    /class=["'][^"']*amount[^"']*["'][^>]*>₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  ];

  for (const regex of patterns) {
    let m;
    while ((m = regex.exec(html)) !== null) {
      const price = parseFloat(m[1].replace(/,/g, ''));
      if (price > 10 && price < 50000 && !seen.has(price)) {
        seen.add(price);
        prices.push(price);
      }
    }
  }
  return prices.sort((a, b) => a - b).slice(0, 200);
}

// ═══════ TECH STACK DETECTION ═══════
function detectTechStack(html) {
  const stack = [];
  const checks = [
    [/shopify|cdn\.shopify/i, 'Shopify'],
    [/woocommerce|wordpress|wp-content|wp-includes/i, 'WordPress'],
    [/squarespace/i, 'Squarespace'],
    [/wix\.com/i, 'Wix'],
    [/webflow/i, 'Webflow'],
    [/bigcommerce/i, 'BigCommerce'],
    [/magento/i, 'Magento'],
    [/react|__next|_next\/static/i, 'React/Next.js'],
    [/angular\.js|ng-app/i, 'Angular'],
    [/vue\.js|__vue/i, 'Vue.js'],
    [/razorpay/i, 'Razorpay'],
    [/stripe\.com|stripe\.js/i, 'Stripe'],
    [/instamojo/i, 'Instamojo'],
    [/paytm/i, 'Paytm'],
    [/phonepe/i, 'PhonePe'],
    [/cashfree/i, 'Cashfree'],
    [/gtm\.js|googletagmanager/i, 'GTM'],
    [/google-analytics|gtag|analytics\.js/i, 'Google Analytics'],
    [/GA4|G-[A-Z0-9]+/, 'GA4'],
    [/fbq\(|facebook\.net\/.*fbevents/i, 'Facebook Pixel'],
    [/hotjar/i, 'Hotjar'],
    [/clarity\.ms/i, 'Microsoft Clarity'],
    [/tawk\.to/i, 'Tawk.to'],
    [/crisp\.chat/i, 'Crisp'],
    [/tidio/i, 'Tidio'],
    [/mailchimp/i, 'Mailchimp'],
    [/klaviyo/i, 'Klaviyo'],
    [/omnisend/i, 'Omnisend'],
    [/shiprocket/i, 'Shiprocket'],
    [/delhivery/i, 'Delhivery'],
    [/cloudflare/i, 'Cloudflare'],
    [/recaptcha/i, 'reCAPTCHA'],
    [/sentry\.io/i, 'Sentry'],
    [/lazysizes|lazyload/i, 'Lazy Loading'],
    [/bootstrap/i, 'Bootstrap'],
    [/tailwindcss|tailwind/i, 'Tailwind CSS'],
  ];

  for (const [regex, name] of checks) {
    if (regex.test(html)) stack.push(name);
  }
  return stack;
}

// ═══════ 6. SITE SCORE CALCULATOR (0-100) ═══════
function calculateSiteScore(pageSpeed, scrape) {
  let score = 0;
  let maxScore = 0;

  if (pageSpeed) {
    score += Math.round(pageSpeed.performance_score * 0.25);
    maxScore += 25;
    score += Math.round(pageSpeed.seo_score * 0.25);
    maxScore += 25;
  }

  if (scrape && scrape.reachable) {
    if (scrape.has_ecommerce) score += 8;
    if (scrape.product_count > 0) score += Math.min(4, Math.round(scrape.product_count / 5));
    if (scrape.price_range) score += 4;
    if (scrape.has_structured_data) score += 4;
    maxScore += 20;

    if (scrape.has_blog) score += 5;
    if (scrape.social_links?.instagram) score += 3;
    if (scrape.social_links?.facebook) score += 2;
    if (scrape.social_links?.youtube) score += 3;
    if (scrape.has_whatsapp) score += 2;
    maxScore += 15;

    if (scrape.has_ssl) score += 5;
    if (scrape.has_viewport) score += 3;
    if (scrape.has_canonical) score += 3;
    if (scrape.tech_stack?.includes('Google Analytics') || scrape.tech_stack?.includes('GA4')) score += 2;
    if (scrape.tech_stack?.includes('Facebook Pixel')) score += 2;
    maxScore += 15;
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

// ═══════ 7. SUPABASE UPSERT ═══════
async function sbUpsert(table, data) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Prefer': 'return=minimal,resolution=merge-duplicates'
      },
      body: JSON.stringify(data)
    });
    return res.ok;
  } catch (e) {
    console.log(`[supabase] Error: ${e.message}`);
    return false;
  }
}

// ═══════ 8. ANALYZE ONE SITE (deep scan) ═══════
async function analyzeSite(site) {
  console.log(`\n[${site.code}] ─── ${site.name} (${site.url}) ───`);

  console.log(`[${site.code}] ⚡ PageSpeed...`);
  const ps = await getPageSpeed(site.url);
  console.log(`[${site.code}] PageSpeed: ${ps ? `Perf ${ps.performance_score}, SEO ${ps.seo_score}` : '✗ failed'}`);

  console.log(`[${site.code}] 🌐 Scraping homepage...`);
  const sc = await scrapeWebsite(site.url);
  console.log(`[${site.code}] Homepage: ${sc.reachable ? `${sc.product_count} products, ${sc.category_count} cats` : '✗ unreachable'}`);

  if (!sc.reachable) {
    return { site, ps: null, sc, allProducts: [], allPrices: [], allCategories: [], siteScore: 0 };
  }

  console.log(`[${site.code}] 🛒 Trying Shopify API...`);
  const shopify = await fetchShopifyProducts(site.url);
  console.log(`[${site.code}] Shopify: ${shopify.products.length} products, ${shopify.prices.length} prices`);

  let deep = { products: [], prices: [], categories: [] };
  if (shopify.products.length < 5) {
    console.log(`[${site.code}] 📄 Deep crawling sub-pages...`);
    deep = await fetchCollectionPages(site.url);
    console.log(`[${site.code}] Deep: ${deep.products.length} products, ${deep.prices.length} prices`);
  }

  const allProductSet = new Set([...sc.products, ...shopify.products, ...deep.products]);
  const allPriceSet = new Set([...sc.prices, ...shopify.prices, ...deep.prices]);
  const allCatSet = new Set([...sc.categories, ...deep.categories]);

  const allProducts = [...allProductSet].slice(0, 200);
  const allPrices = [...allPriceSet].sort((a, b) => a - b);
  const allCategories = [...allCatSet].slice(0, 30);

  sc.products = allProducts;
  sc.product_count = allProducts.length;
  sc.categories = allCategories;
  sc.category_count = allCategories.length;
  sc.prices = allPrices;
  sc.price_range = allPrices.length ? {
    min: Math.min(...allPrices),
    max: Math.max(...allPrices),
    avg: Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length)
  } : null;

  const siteScore = calculateSiteScore(ps, sc);
  console.log(`[${site.code}] ✅ Score: ${siteScore}/100 | ${allProducts.length} products | ${allPrices.length} prices | ${allCategories.length} categories`);

  return { site, ps, sc, allProducts, allPrices, allCategories, siteScore };
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

  // ── Single site test mode ──
  if (params.site) {
    console.log(`[WEB-INTEL v2] Single test: ${params.site}`);
    const fakeSite = { name: 'Test', code: 'TS', url: params.site, color: '#666' };
    const result = await analyzeSite(fakeSite);
    return {
      statusCode: 200, headers: H,
      body: JSON.stringify({
        mode: 'single_test',
        version: 'web_intel_v2',
        site: params.site,
        site_score: result.siteScore,
        products_found: result.allProducts.length,
        prices_found: result.allPrices.length,
        categories_found: result.allCategories.length,
        pagespeed: result.ps,
        scrape: {
          reachable: result.sc.reachable,
          title: result.sc.title,
          meta_description: result.sc.meta_description,
          products: result.allProducts.slice(0, 30),
          categories: result.allCategories,
          price_range: result.sc.price_range,
          tech_stack: result.sc.tech_stack,
          social_links: result.sc.social_links,
          has_ecommerce: result.sc.has_ecommerce,
          has_blog: result.sc.has_blog,
          has_whatsapp: result.sc.has_whatsapp,
          has_structured_data: result.sc.has_structured_data,
          image_count: result.sc.image_count,
          word_count: result.sc.word_count
        }
      }, null, 2)
    };
  }

  // ── Full scan mode ──
  if (!SB_KEY || !SB_URL) {
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  console.log(`\n[WEB-INTEL v2] ═══ Analyzing ${SITES.length} websites (deep scan) ═══`);
  const startTime = Date.now();
  const results = [];

  for (const site of SITES) {
    const result = await analyzeSite(site);

    const row = {
      name: site.name, code: site.code, url: site.url, color: site.color,
      is_self: site.is_self || false,
      reachable: result.sc.reachable || false,
      performance_score: result.ps?.performance_score || 0,
      seo_score: result.ps?.seo_score || 0,
      accessibility_score: result.ps?.accessibility_score || 0,
      best_practices_score: result.ps?.best_practices_score || 0,
      first_contentful_paint: result.ps?.first_contentful_paint || '',
      largest_contentful_paint: result.ps?.largest_contentful_paint || '',
      speed_index: result.ps?.speed_index || '',
      is_mobile_friendly: result.ps?.is_mobile_friendly || false,
      page_title: result.sc.title || '',
      meta_description: result.sc.meta_description || '',
      product_count: result.allProducts.length,
      products: JSON.stringify(result.allProducts.slice(0, 100)),
      category_count: result.allCategories.length,
      categories: JSON.stringify(result.allCategories),
      price_min: result.sc.price_range?.min || 0,
      price_max: result.sc.price_range?.max || 0,
      price_avg: result.sc.price_range?.avg || 0,
      tech_stack: JSON.stringify(result.sc.tech_stack || []),
      has_ecommerce: result.sc.has_ecommerce || false,
      has_blog: result.sc.has_blog || false,
      has_whatsapp: result.sc.has_whatsapp || false,
      has_ssl: result.sc.has_ssl || false,
      has_structured_data: result.sc.has_structured_data || false,
      social_links: JSON.stringify(result.sc.social_links || {}),
      image_count: result.sc.image_count || 0,
      word_count: result.sc.word_count || 0,
      internal_links: result.sc.internal_links || 0,
      external_links: result.sc.external_links || 0,
      site_score: result.siteScore,
      scanned_at: new Date().toISOString()
    };

    const saved = await sbUpsert('website_intelligence', row);

    results.push({
      name: site.name, code: site.code, url: site.url,
      is_self: site.is_self || false,
      reachable: result.sc.reachable || false,
      site_score: result.siteScore,
      performance: result.ps?.performance_score || 0,
      seo: result.ps?.seo_score || 0,
      products: result.allProducts.length,
      categories: result.allCategories.length,
      price_range: result.sc.price_range || null,
      has_ecommerce: result.sc.has_ecommerce || false,
      tech_stack: result.sc.tech_stack || [],
      saved
    });

    await new Promise(r => setTimeout(r, 2000));
  }

  const duration = Date.now() - startTime;
  const seasalt = results.find(r => r.is_self);
  const competitors = results.filter(r => !r.is_self && r.reachable);

  let comparison = null;
  if (seasalt) {
    const avgCompScore = competitors.length > 0
      ? competitors.reduce((s, c) => s + c.site_score, 0) / competitors.length : 0;
    comparison = {
      seasalt_score: seasalt.site_score,
      avg_competitor_score: Math.round(avgCompScore),
      seasalt_rank: competitors.filter(c => c.site_score > seasalt.site_score).length + 1,
      better_than: competitors.filter(c => seasalt.site_score > c.site_score).length,
      total_competitors: competitors.length
    };
  }

  console.log(`\n[WEB-INTEL v2] ═══ Done: ${results.length} sites, ${Math.round(duration / 1000)}s ═══`);

  return {
    statusCode: 200, headers: H,
    body: JSON.stringify({
      status: 'complete', version: 'web_intel_v2',
      scanned_at: new Date().toISOString(),
      duration_ms: duration,
      total_sites: results.length,
      reachable_sites: results.filter(r => r.reachable).length,
      comparison, results
    }, null, 2)
  };
};
