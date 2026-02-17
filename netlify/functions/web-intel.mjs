// ═══════════════════════════════════════════════════════════════════
// SeaSalt Intelligence — Website Intelligence Scraper v3
// ═══════════════════════════════════════════════════════════════════
// v3 UPGRADES:
// ✅ Auto-detect marketplace presence (Amazon/Flipkart/Swiggy/Zomato links)
// ✅ Extract products WITH their individual prices (product→price pairs)
// ✅ Detect Shopify variant-level pricing per product
// ✅ New columns: marketplace_presence (JSON), products_with_prices (JSON)
// ═══════════════════════════════════════════════════════════════════

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_KEY || '';

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

async function safeFetch(url, timeoutMs = 15000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/json,*/*', 'Accept-Language': 'en-IN,en;q=0.9' },
      redirect: 'follow', signal: AbortSignal.timeout(timeoutMs)
    });
    return res;
  } catch (e) { return null; }
}

// ═══════ 1. PAGESPEED ═══════
async function getPageSpeed(siteUrl) {
  if (!GOOGLE_KEY) return null;
  try {
    const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${siteUrl}&category=performance&category=seo&category=accessibility&category=best-practices&strategy=mobile&key=${GOOGLE_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    const data = await res.json();
    if (data.error) { console.log(`[pagespeed] ${siteUrl}: ${data.error.message}`); return null; }
    const lh = data.lighthouseResult;
    if (!lh) return null;
    return {
      performance_score: Math.round((lh.categories?.performance?.score || 0) * 100),
      seo_score: Math.round((lh.categories?.seo?.score || 0) * 100),
      accessibility_score: Math.round((lh.categories?.accessibility?.score || 0) * 100),
      best_practices_score: Math.round((lh.categories?.['best-practices']?.score || 0) * 100),
      first_contentful_paint: lh.audits?.['first-contentful-paint']?.displayValue || '',
      largest_contentful_paint: lh.audits?.['largest-contentful-paint']?.displayValue || '',
      speed_index: lh.audits?.['speed-index']?.displayValue || '',
      is_mobile_friendly: (lh.categories?.seo?.score || 0) >= 0.8,
      final_url: lh.finalUrl || siteUrl
    };
  } catch (e) { console.log(`[pagespeed] ${siteUrl}: ${e.message}`); return null; }
}

// ═══════ 2. FETCH PAGE ═══════
async function fetchPage(url) {
  const base = url.startsWith('http') ? url : `https://${url}`;
  try { const res = await safeFetch(base, 15000); if (!res || !res.ok) return ''; return await res.text(); } catch (e) { return ''; }
}

// ═══════ 3. SHOPIFY PRODUCTS (with per-product pricing) ═══════
async function fetchShopifyProducts(siteUrl) {
  const products = [];
  for (let page = 1; page <= 3; page++) {
    try {
      const res = await safeFetch(`https://${siteUrl}/products.json?limit=250&page=${page}`, 10000);
      if (!res || !res.ok) break;
      let data; try { data = JSON.parse(await res.text()); } catch { break; }
      if (!data.products || !data.products.length) break;
      for (const p of data.products) {
        const variantPrices = (p.variants || []).map(v => parseFloat(v.price)).filter(v => v > 0 && v < 50000);
        const minP = variantPrices.length ? Math.min(...variantPrices) : 0;
        const maxP = variantPrices.length ? Math.max(...variantPrices) : 0;
        if (p.title) products.push({ name: p.title, price_min: minP, price_max: maxP, price: minP, source: 'shopify_api' });
      }
      console.log(`  [shopify] Page ${page}: ${data.products.length} products`);
      if (data.products.length < 250) break;
    } catch (e) { break; }
  }
  return products;
}

// ═══════ 4. DEEP CRAWL SUB-PAGES ═══════
async function fetchCollectionPages(siteUrl) {
  const extra = { products: [], prices: [], categories: [] };
  const paths = ['/collections/all', '/shop', '/products', '/product-category/pickles', '/collections/pickles'];
  let scraped = 0;
  for (const path of paths) {
    if (scraped >= 3) break;
    const html = await fetchPage(`https://${siteUrl}${path}`);
    if (!html || html.length < 500) continue;
    scraped++;
    console.log(`  [deep] ${path} (${html.length} chars)`);
    extra.products.push(...extractProducts(html));
    extra.prices.push(...extractPrices(html));
    extra.categories.push(...extractCategories(html));
    await new Promise(r => setTimeout(r, 500));
  }
  return extra;
}

// ═══════ 5. MAIN SCRAPE ═══════
async function scrapeWebsite(siteUrl) {
  const base = `https://${siteUrl}`;
  let html = '';
  try {
    const res = await safeFetch(base, 15000);
    if (!res || !res.ok) return { reachable: false, status: res?.status || 0 };
    html = await res.text();
  } catch (e) { return { reachable: false, error: e.message }; }
  if (!html || html.length < 100) return { reachable: false, error: 'Empty response' };

  const getMeta = (name) => {
    const ps = [new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'), new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i')];
    for (const p of ps) { const m = html.match(p); if (m) return m[1]; } return null;
  };

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  const h1 = (html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1] || '').replace(/<[^>]+>/g, '').trim();
  const products = extractProducts(html);
  const categories = extractCategories(html);
  const prices = extractPrices(html);

  // Social links
  const socialLinks = {};
  const socP = { instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi, facebook: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.]+/gi, youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|c\/|@)[a-zA-Z0-9_.-]+/gi, twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/gi, whatsapp: /https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[0-9]+/gi, linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_.-]+/gi };
  for (const [k, rx] of Object.entries(socP)) { const m = html.match(rx); if (m) socialLinks[k] = [...new Set(m)][0]; }
  if (!socialLinks.whatsapp && /whatsapp|wa\.me/i.test(html)) socialLinks.whatsapp = 'detected';

  // ═══ NEW: AUTO-DETECT MARKETPLACE PRESENCE ═══
  const marketplace = detectMarketplacePresence(html);

  // ═══ NEW: PRODUCTS WITH PRICES (from HTML) ═══
  const productsWithPrices = extractProductsWithPrices(html);

  // Tech stack
  const techStack = detectTechStack(html);

  // Schema products
  const schemaProducts = [];
  const schemaTags = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const sm of schemaTags) {
    try {
      const data = JSON.parse(sm.replace(/<\/?script[^>]*>/gi, ''));
      const proc = (item) => {
        if (item?.['@type'] === 'Product' && item.name) {
          const p = parseFloat(item.offers?.price || item.offers?.lowPrice || 0);
          schemaProducts.push({ name: item.name, price: p || 0 });
          if (!products.includes(item.name)) products.push(item.name);
          if (p > 0 && p < 50000 && !prices.includes(p)) prices.push(p);
          // Add to productsWithPrices
          if (p > 0) productsWithPrices.push({ name: item.name, price: p, source: 'schema' });
        }
      };
      if (Array.isArray(data)) data.forEach(proc);
      else if (data['@graph']) data['@graph'].forEach(proc);
      else proc(data);
    } catch (e) {}
  }

  return {
    reachable: true, html_length: html.length, title, h1,
    meta_description: getMeta('description') || '', og_image: getMeta('og:image') || '',
    products, product_count: products.length, categories, category_count: categories.length,
    prices,
    price_range: prices.length ? { min: Math.min(...prices), max: Math.max(...prices), avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) } : null,
    social_links: socialLinks, tech_stack: techStack,
    marketplace_presence: marketplace,
    products_with_prices: productsWithPrices,
    has_ssl: true, has_canonical: /<link[^>]+rel=["']canonical["']/i.test(html),
    has_robots: !!getMeta('robots'), has_viewport: !!getMeta('viewport'),
    has_structured_data: /application\/ld\+json/i.test(html),
    schema_products: schemaProducts,
    has_ecommerce: /add.to.cart|buy.now|add-to-cart|addtocart|shopify|woocommerce|checkout|purchase/i.test(html),
    has_blog: /\/blog|\/articles|\/news|\/recipes/i.test(html),
    has_whatsapp: /wa\.me|whatsapp|api\.whatsapp/i.test(html),
    word_count: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 2).length,
    image_count: (html.match(/<img/gi) || []).length,
    internal_links: (html.match(/href=["']\/[^"']+["']/gi) || []).length,
    external_links: (html.match(/href=["']https?:\/\/[^"']+["']/gi) || []).length
  };
}

// ═══════ NEW: MARKETPLACE PRESENCE DETECTOR ═══════
function detectMarketplacePresence(html) {
  const presence = {
    website: true, // they have their own site (we're scraping it)
    amazon: false, flipkart: false, swiggy: false, zomato: false,
    bigbasket: false, jiomart: false, blinkit: false,
    instagram_shop: false, whatsapp: false
  };

  // Detect marketplace links in their website HTML
  if (/amazon\.in|amazon\.com|amzn\.to|amzn\.in/i.test(html)) presence.amazon = true;
  if (/flipkart\.com|fkrt\.it/i.test(html)) presence.flipkart = true;
  if (/swiggy\.com|swiggyinstamart/i.test(html)) presence.swiggy = true;
  if (/zomato\.com|hyperpure/i.test(html)) presence.zomato = true;
  if (/bigbasket\.com/i.test(html)) presence.bigbasket = true;
  if (/jiomart\.com/i.test(html)) presence.jiomart = true;
  if (/blinkit\.com|grofers/i.test(html)) presence.blinkit = true;
  if (/instagram\.com\/shop|instagram\.com\/.*\/shop|action=["']shop["']/i.test(html)) presence.instagram_shop = true;
  if (/instagram\.com\//i.test(html) && !presence.instagram_shop) {
    // Having Instagram link suggests they might sell there
    presence.instagram_shop = false; // Only mark true if it's a shop link
  }
  if (/wa\.me|whatsapp|api\.whatsapp/i.test(html)) presence.whatsapp = true;

  // Also check for "Available on" / "Buy on" / "Order from" text patterns
  if (/(?:available|buy|order|shop|find us).*(?:on|at|from).*amazon/i.test(html)) presence.amazon = true;
  if (/(?:available|buy|order|shop|find us).*(?:on|at|from).*flipkart/i.test(html)) presence.flipkart = true;
  if (/(?:available|buy|order|shop|find us).*(?:on|at|from).*swiggy/i.test(html)) presence.swiggy = true;
  if (/(?:available|buy|order|shop|find us).*(?:on|at|from).*zomato/i.test(html)) presence.zomato = true;
  if (/(?:available|buy|order|shop|find us).*(?:on|at|from).*bigbasket/i.test(html)) presence.bigbasket = true;
  if (/(?:available|buy|order|shop|find us).*(?:on|at|from).*jiomart/i.test(html)) presence.jiomart = true;
  if (/(?:available|buy|order|shop|find us).*(?:on|at|from).*blinkit/i.test(html)) presence.blinkit = true;

  // Extract actual marketplace URLs for reference
  const urls = {};
  const amzMatch = html.match(/https?:\/\/(?:www\.)?amazon\.in\/[^\s"'<>]+/i);
  if (amzMatch) urls.amazon = amzMatch[0];
  const fkMatch = html.match(/https?:\/\/(?:www\.)?flipkart\.com\/[^\s"'<>]+/i);
  if (fkMatch) urls.flipkart = fkMatch[0];
  const swMatch = html.match(/https?:\/\/(?:www\.)?swiggy\.com\/[^\s"'<>]+/i);
  if (swMatch) urls.swiggy = swMatch[0];

  presence._urls = urls;
  presence._platform_count = Object.entries(presence).filter(([k, v]) => v === true && !k.startsWith('_')).length;

  return presence;
}

// ═══════ NEW: PRODUCTS WITH PRICES EXTRACTOR ═══════
function extractProductsWithPrices(html) {
  const items = [];
  const seen = new Set();

  // Pattern 1: Product card blocks with name + price nearby
  // Look for common product card structures
  const cardRegex = /<(?:div|article|li)[^>]*class=["'][^"']*product[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi;
  let cardMatch;
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const block = cardMatch[1];
    // Extract name from block
    const nameMatch = block.match(/<(?:h[2-4]|a|span|div)[^>]*class=["'][^"']*(?:title|name|heading)[^"']*["'][^>]*>([^<]{3,80})/i)
      || block.match(/itemprop=["']name["'][^>]*>([^<]{3,80})/i)
      || block.match(/<(?:h[2-4])[^>]*>([^<]{5,80})/i);
    // Extract price from block
    const priceMatch = block.match(/(?:₹|Rs\.?\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i)
      || block.match(/data-price=["']([0-9.]+)["']/i)
      || block.match(/"price"\s*:\s*"?([0-9.]+)/i);

    if (nameMatch && priceMatch) {
      const name = nameMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      const key = name.toLowerCase();
      if (name.length > 3 && price > 10 && price < 50000 && !seen.has(key)) {
        seen.add(key);
        items.push({ name, price, source: 'html_card' });
      }
    }
  }

  // Pattern 2: WooCommerce-specific product+price
  const wooRegex = /class=["'][^"']*woocommerce-loop-product__title[^"']*["'][^>]*>([^<]{3,80})<[\s\S]*?class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?(?:₹|Rs\.?\s*)([0-9,]+(?:\.[0-9]{1,2})?)/gi;
  let wooMatch;
  while ((wooMatch = wooRegex.exec(html)) !== null) {
    const name = wooMatch[1].trim();
    const price = parseFloat(wooMatch[2].replace(/,/g, ''));
    const key = name.toLowerCase();
    if (!seen.has(key) && price > 10 && price < 50000) {
      seen.add(key);
      items.push({ name, price, source: 'woocommerce' });
    }
  }

  return items.slice(0, 100);
}

// ═══════ PRODUCT EXTRACTION ═══════
function extractProducts(html) {
  const products = [], seen = new Set();
  const patterns = [
    /<(?:h[2-4]|a|div|span)[^>]*class=["'][^"']*product[-_]?(?:card)?[-_]?(?:name|title|heading)[^"']*["'][^>]*>([^<]{3,100})/gi,
    /<(?:h[2-4]|a|div|span)[^>]*class=["'][^"']*card[-_]?(?:title|name|heading)[^"']*["'][^>]*>([^<]{3,100})/gi,
    /<(?:h[2-4])[^>]*class=["'][^"']*woocommerce-loop-product__title[^"']*["'][^>]*>([^<]{3,100})/gi,
    /data-product-(?:name|title)=["']([^"']{3,100})["']/gi,
    /itemprop=["']name["'][^>]*>([^<]{3,100})/gi,
    /class=["'][^"']*grid-product__title[^"']*["'][^>]*>([^<]{3,100})/gi,
    /class=["'][^"']*product-item__title[^"']*["'][^>]*>([^<]{3,100})/gi,
  ];
  for (const p of patterns) {
    let m; while ((m = p.exec(html)) !== null) {
      const name = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
      const lower = name.toLowerCase();
      if (name.length > 3 && name.length < 100 && !seen.has(lower) && !/^(home|about|contact|blog|faq|login|cart|menu|search|shop|close)/i.test(name) && !/^\d+$/.test(name)) { seen.add(lower); products.push(name); }
    }
  }
  return products.slice(0, 100);
}

function extractCategories(html) {
  const cats = new Set();
  const junk = new Set(['all','home','about','contact','blog','faq','page','cart','account','login','search','collections','products','shop','new','sale','featured','frontpage','index']);
  const ps = [/\/(?:product-category|category|collections?)\/([a-zA-Z0-9-]+)/gi, /class=["'][^"']*cat(?:egory)?[-_]?(?:name|title|link|item)[^"']*["'][^>]*>([^<]{3,50})/gi];
  for (const p of ps) { let m; while ((m = p.exec(html)) !== null) { const c = m[1].replace(/<[^>]+>/g,'').replace(/-/g,' ').trim(); if (c.length > 2 && c.length < 50 && !junk.has(c.toLowerCase())) cats.add(c); } }
  return [...cats].slice(0, 30);
}

function extractPrices(html) {
  const prices = [], seen = new Set();
  const ps = [/(?:₹|Rs\.?\s*|INR\s*)([0-9,]+(?:\.[0-9]{1,2})?)/gi, /data-price=["']([0-9.]+)["']/gi, /"price"\s*:\s*"?([0-9.]+)"?/gi];
  for (const rx of ps) { let m; while ((m = rx.exec(html)) !== null) { const p = parseFloat(m[1].replace(/,/g, '')); if (p > 10 && p < 50000 && !seen.has(p)) { seen.add(p); prices.push(p); } } }
  return prices.sort((a, b) => a - b).slice(0, 200);
}

function detectTechStack(html) {
  const stack = [];
  const ch = [[/shopify|cdn\.shopify/i,'Shopify'],[/woocommerce|wordpress|wp-content/i,'WordPress'],[/squarespace/i,'Squarespace'],[/wix\.com/i,'Wix'],[/webflow/i,'Webflow'],[/react|__next|_next\/static/i,'React/Next.js'],[/razorpay/i,'Razorpay'],[/stripe\.com/i,'Stripe'],[/instamojo/i,'Instamojo'],[/paytm/i,'Paytm'],[/phonepe/i,'PhonePe'],[/cashfree/i,'Cashfree'],[/gtm\.js|googletagmanager/i,'GTM'],[/google-analytics|gtag/i,'Google Analytics'],[/fbq\(|facebook\.net.*fbevents/i,'Facebook Pixel'],[/hotjar/i,'Hotjar'],[/clarity\.ms/i,'Microsoft Clarity'],[/tawk\.to/i,'Tawk.to'],[/mailchimp/i,'Mailchimp'],[/klaviyo/i,'Klaviyo'],[/shiprocket/i,'Shiprocket'],[/cloudflare/i,'Cloudflare'],[/recaptcha/i,'reCAPTCHA'],[/bootstrap/i,'Bootstrap'],[/tailwindcss/i,'Tailwind CSS']];
  for (const [rx, name] of ch) if (rx.test(html)) stack.push(name);
  return stack;
}

function calculateSiteScore(ps, sc) {
  let score = 0, max = 0;
  if (ps) { score += Math.round(ps.performance_score * 0.25); max += 25; score += Math.round(ps.seo_score * 0.25); max += 25; }
  if (sc?.reachable) {
    if (sc.has_ecommerce) score += 8; if (sc.product_count > 0) score += Math.min(4, Math.round(sc.product_count / 5)); if (sc.price_range) score += 4; if (sc.has_structured_data) score += 4; max += 20;
    if (sc.has_blog) score += 5; if (sc.social_links?.instagram) score += 3; if (sc.social_links?.facebook) score += 2; if (sc.social_links?.youtube) score += 3; if (sc.has_whatsapp) score += 2; max += 15;
    if (sc.has_ssl) score += 5; if (sc.has_viewport) score += 3; if (sc.has_canonical) score += 3; if (sc.tech_stack?.includes('Google Analytics')) score += 2; if (sc.tech_stack?.includes('Facebook Pixel')) score += 2; max += 15;
  }
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

async function sbUpsert(table, data) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Prefer': 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify(data) });
    return res.ok;
  } catch (e) { return false; }
}

// ═══════ ANALYZE ONE SITE ═══════
async function analyzeSite(site, skipPageSpeed = false) {
  console.log(`\n[${site.code}] ─── ${site.name} (${site.url}) ───`);

  let ps = null;
  if (!skipPageSpeed) {
    console.log(`[${site.code}] ⚡ PageSpeed...`);
    ps = await getPageSpeed(site.url);
    console.log(`[${site.code}] PageSpeed: ${ps ? `Perf ${ps.performance_score}, SEO ${ps.seo_score}` : '✗'}`);
  } else {
    console.log(`[${site.code}] ⚡ PageSpeed SKIPPED (fast mode)`);
  }
  console.log(`[${site.code}] 🌐 Scraping homepage...`);
  const sc = await scrapeWebsite(site.url);
  console.log(`[${site.code}] Homepage: ${sc.reachable ? `${sc.product_count} products, marketplace: ${sc.marketplace_presence?._platform_count || 0} platforms` : '✗'}`);

  if (!sc.reachable) return { site, ps: null, sc, allProducts: [], allPrices: [], allCategories: [], shopifyProducts: [], siteScore: 0 };

  console.log(`[${site.code}] 🛒 Shopify API...`);
  const shopify = await fetchShopifyProducts(site.url);
  console.log(`[${site.code}] Shopify: ${shopify.length} products with prices`);

  let deep = { products: [], prices: [], categories: [] };
  if (shopify.length < 5) {
    console.log(`[${site.code}] 📄 Deep crawl...`);
    deep = await fetchCollectionPages(site.url);
    console.log(`[${site.code}] Deep: ${deep.products.length} products`);
  }

  // Merge
  const allProductSet = new Set([...sc.products, ...shopify.map(p => p.name), ...deep.products]);
  const allPriceSet = new Set([...sc.prices, ...shopify.map(p => p.price).filter(p => p > 0), ...deep.prices]);
  const allCatSet = new Set([...sc.categories, ...deep.categories]);
  const allProducts = [...allProductSet].slice(0, 200);
  const allPrices = [...allPriceSet].sort((a, b) => a - b);
  const allCategories = [...allCatSet].slice(0, 30);

  // Merge products_with_prices from HTML + Shopify
  const pwp = [...sc.products_with_prices, ...shopify];
  // Deduplicate by name
  const pwpMap = {};
  pwp.forEach(p => { if (!pwpMap[p.name.toLowerCase()]) pwpMap[p.name.toLowerCase()] = p; });
  const productsWithPrices = Object.values(pwpMap).slice(0, 100);

  sc.products = allProducts; sc.product_count = allProducts.length;
  sc.categories = allCategories; sc.category_count = allCategories.length;
  sc.prices = allPrices;
  sc.price_range = allPrices.length ? { min: Math.min(...allPrices), max: Math.max(...allPrices), avg: Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) } : null;
  sc.products_with_prices = productsWithPrices;

  const siteScore = calculateSiteScore(ps, sc);
  console.log(`[${site.code}] ✅ Score: ${siteScore}/100 | ${allProducts.length} products | ${productsWithPrices.length} with prices | ${sc.marketplace_presence?._platform_count || 0} platforms`);

  return { site, ps, sc, allProducts, allPrices, allCategories, shopifyProducts: shopify, siteScore };
}

// ═══════ BUILD SUPABASE ROW ═══════
function buildRow(site, r) {
  return {
    name: site.name, code: site.code, url: site.url, color: site.color,
    is_self: site.is_self || false, reachable: r.sc.reachable || false,
    performance_score: r.ps?.performance_score || 0, seo_score: r.ps?.seo_score || 0,
    accessibility_score: r.ps?.accessibility_score || 0, best_practices_score: r.ps?.best_practices_score || 0,
    first_contentful_paint: r.ps?.first_contentful_paint || '', largest_contentful_paint: r.ps?.largest_contentful_paint || '',
    speed_index: r.ps?.speed_index || '', is_mobile_friendly: r.ps?.is_mobile_friendly || false,
    page_title: r.sc.title || '', meta_description: r.sc.meta_description || '',
    product_count: r.allProducts.length,
    products: JSON.stringify(r.allProducts.slice(0, 100)),
    category_count: r.allCategories.length,
    categories: JSON.stringify(r.allCategories),
    price_min: r.sc.price_range?.min || 0, price_max: r.sc.price_range?.max || 0, price_avg: r.sc.price_range?.avg || 0,
    tech_stack: JSON.stringify(r.sc.tech_stack || []),
    has_ecommerce: r.sc.has_ecommerce || false, has_blog: r.sc.has_blog || false,
    has_whatsapp: r.sc.has_whatsapp || false, has_ssl: r.sc.has_ssl || false,
    has_structured_data: r.sc.has_structured_data || false,
    social_links: JSON.stringify(r.sc.social_links || {}),
    marketplace_presence: JSON.stringify(r.sc.marketplace_presence || {}),
    products_with_prices: JSON.stringify(r.sc.products_with_prices || []),
    image_count: r.sc.image_count || 0, word_count: r.sc.word_count || 0,
    internal_links: r.sc.internal_links || 0, external_links: r.sc.external_links || 0,
    site_score: r.siteScore, scanned_at: new Date().toISOString()
  };
}

// ═══════ MAIN HANDLER ═══════
export const handler = async (event) => {
  const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };
  const params = event.queryStringParameters || {};

  if (params.site) {
    // Single site test — SKIP PageSpeed for fast response (under 10s)
    const fakeSite = { name: 'Test', code: 'TS', url: params.site, color: '#666' };
    const r = await analyzeSite(fakeSite, true); // skipPageSpeed=true
    return { statusCode: 200, headers: H, body: JSON.stringify({
      mode: 'single_test', version: 'web_intel_v3', site: params.site,
      site_score: r.siteScore,
      products_found: r.allProducts.length,
      products_with_prices: r.sc.products_with_prices?.length || 0,
      marketplace_presence: r.sc.marketplace_presence,
      pagespeed: 'skipped_for_speed',
      scrape: { reachable: r.sc.reachable, title: r.sc.title, products: r.allProducts.slice(0, 50), products_with_prices: r.sc.products_with_prices?.slice(0, 50), categories: r.allCategories, price_range: r.sc.price_range, tech_stack: r.sc.tech_stack, social_links: r.sc.social_links, has_ecommerce: r.sc.has_ecommerce, marketplace_presence: r.sc.marketplace_presence }
    }, null, 2) };
  }

  // ── Scan ONE specific competitor (called from dashboard one by one) ──
  if (params.scan) {
    if (!SB_KEY || !SB_URL) return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'Supabase not configured' }) };
    const site = SITES.find(s => s.code === params.scan || s.url === params.scan);
    if (!site) return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Site not found: ' + params.scan }) };

    const skipPS = params.fast === '1';
    const r = await analyzeSite(site, skipPS);
    const row = buildRow(site, r);
    const saved = await sbUpsert('website_intelligence', row);
    return { statusCode: 200, headers: H, body: JSON.stringify({
      mode: 'single_scan', version: 'web_intel_v3', site: site.name,
      site_score: r.siteScore, products: r.allProducts.length,
      products_with_prices: r.sc.products_with_prices?.length || 0,
      marketplace: r.sc.marketplace_presence, saved
    }) };
  }

  if (!SB_KEY || !SB_URL) return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'Supabase not configured' }) };

  const skipPS = params.fast === '1';
  console.log(`\n[WEB-INTEL v3] ═══ Analyzing ${SITES.length} websites ${skipPS ? '(FAST mode — no PageSpeed)' : ''} ═══`);
  const startTime = Date.now();
  const results = [];

  for (const site of SITES) {
    const r = await analyzeSite(site, skipPS);
    const row = buildRow(site, r);
    const saved = await sbUpsert('website_intelligence', row);
    results.push({ name: site.name, code: site.code, url: site.url, is_self: site.is_self || false, reachable: r.sc.reachable || false, site_score: r.siteScore, products: r.allProducts.length, products_with_prices: r.sc.products_with_prices?.length || 0, marketplace: r.sc.marketplace_presence, saved });
    await new Promise(r => setTimeout(r, 2000));
  }

  const duration = Date.now() - startTime;
  console.log(`\n[WEB-INTEL v3] ═══ Done: ${results.length} sites, ${Math.round(duration / 1000)}s ═══`);
  return { statusCode: 200, headers: H, body: JSON.stringify({ status: 'complete', version: 'web_intel_v3', scanned_at: new Date().toISOString(), duration_ms: duration, total_sites: results.length, reachable_sites: results.filter(r => r.reachable).length, results }, null, 2) };
};
