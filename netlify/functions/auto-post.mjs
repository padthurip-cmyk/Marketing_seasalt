// ═══════════════════════════════════════════════════════
// SeaSalt — Automated Daily Post Generator (No NPM deps)
// ═══════════════════════════════════════════════════════

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const PAGE_TOKEN = process.env.META_PAGE_TOKEN || '';
const PAGE_ID = process.env.META_PAGE_ID || '';
const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ID || '';
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_KEY || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const SITE_URL = process.env.URL || 'https://sage-paletas-ad2239.netlify.app';
const GRAPH_URL = 'https://graph.facebook.com/v25.0';

// ═══ Supabase fetch helpers ═══
function sbHeaders(extra) {
  var h = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
  if (extra) h['Prefer'] = extra;
  return h;
}
async function dbSelect(table, q) {
  if (!SB_URL || !SB_KEY) return [];
  const r = await fetch(SB_URL + '/rest/v1/' + table + '?' + q, { headers: sbHeaders() });
  return r.json();
}
async function dbInsert(table, row) {
  if (!SB_URL || !SB_KEY) return null;
  const r = await fetch(SB_URL + '/rest/v1/' + table, { method: 'POST', headers: sbHeaders('return=representation'), body: JSON.stringify(row) });
  return r.json();
}
async function dbUpdate(table, match, upd) {
  if (!SB_URL || !SB_KEY) return null;
  const r = await fetch(SB_URL + '/rest/v1/' + table + '?' + match, { method: 'PATCH', headers: sbHeaders('return=representation'), body: JSON.stringify(upd) });
  return r.json();
}

// ═══ Product catalog fallback ═══
const PRODUCTS = [
  { name: 'Andhra Avakaya Pickle', price: '₹299', desc: 'Authentic raw mango pickle with red chili, mustard & sesame oil' },
  { name: 'Gongura Pickle', price: '₹249', desc: 'Tangy roselle leaf pickle — Andhra classic' },
  { name: 'Chicken Pickle', price: '₹399', desc: 'Spicy boneless chicken pickle, slow-cooked in sesame oil' },
  { name: 'Prawn Pickle', price: '₹449', desc: 'Premium prawns marinated in Andhra spices' },
  { name: 'Tomato Pickle', price: '₹199', desc: 'Sweet & tangy tomato pickle for daily meals' },
  { name: 'Mixed Vegetable Pickle', price: '₹229', desc: 'Carrots, cauliflower, green chili blend' },
  { name: 'Garlic Pickle', price: '₹219', desc: 'Fiery garlic cloves in spiced sesame oil' },
  { name: 'Lemon Pickle', price: '₹179', desc: 'Whole lemon pickle aged to perfection' },
  { name: 'Ginger Pickle', price: '₹199', desc: 'Fresh ginger with mustard & fenugreek' },
  { name: 'Red Chilli Pickle', price: '₹249', desc: 'Stuffed red chilies — the Andhra way' }
];

export const handler = async (event) => {
  const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

  try {
    let action = 'generate', token = '';
    if (event.body) { try { const b = JSON.parse(event.body); action = b.action || 'generate'; token = b.token || ''; } catch(e) {} }
    if (event.queryStringParameters?.action) action = event.queryStringParameters.action;
    if (event.queryStringParameters?.token) token = event.queryStringParameters.token;

    if (action === 'generate') return { statusCode: 200, headers: H, body: JSON.stringify(await generateDailyPost()) };
    if (action === 'approve') { const r = await approvePost(token); return r.statusCode ? r : { statusCode: 200, headers: H, body: JSON.stringify(r) }; }
    if (action === 'reject') { const r = await rejectPost(token); return r.statusCode ? r : { statusCode: 200, headers: H, body: JSON.stringify(r) }; }
    if (action === 'status') return { statusCode: 200, headers: H, body: JSON.stringify(await getPendingPosts()) };
    return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    console.error('[Auto Post]', e);
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: e.message }) };
  }
};

async function generateDailyPost() {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set in Netlify env vars');

  let products = PRODUCTS;
  // Try DB products
  if (SB_URL && SB_KEY) {
    try {
      const d = await dbSelect('website_intelligence', 'brand_name=eq.Seasaltpickles&select=products&limit=1');
      if (d?.[0]?.products) { const p = typeof d[0].products === 'string' ? JSON.parse(d[0].products) : d[0].products; if (p.length) products = p; }
    } catch (e) {}
  }

  // Avoid recent repeats
  let recent = [];
  if (SB_URL && SB_KEY) { try { recent = (await dbSelect('social_posts', 'ai_generated=eq.true&order=created_at.desc&limit=5&select=caption')).map(r => (r.caption || '').toLowerCase()); } catch (e) {} }

  let product = products[Math.floor(Math.random() * products.length)];
  for (let i = 0; i < 5; i++) {
    const nm = (product.name || product.product_name || '').toString().toLowerCase();
    if (!recent.some(c => c.includes(nm))) break;
    product = products[Math.floor(Math.random() * products.length)];
  }

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();

  const types = [
    { k: 'product_highlight', g: 'Mouth-watering product showcase. Highlight taste, ingredients, what makes it special.' },
    { k: 'behind_the_scenes', g: 'Behind-the-scenes of making this. The craft, care, family tradition.' },
    { k: 'customer_love', g: 'Write as a real customer testimonial/review. Authentic, relatable.' },
    { k: 'recipe_tip', g: 'Quick recipe or serving suggestion. What pairs well with it?' },
    { k: 'fun_fact', g: 'Interesting fact about pickles, ingredients, or Andhra food culture.' },
    { k: 'seasonal', g: months[now.getMonth()] + ' seasonal post. Connect to current weather or festivals.' },
    { k: 'health_benefit', g: 'Health benefits — probiotics, spices, traditional wellness.' },
    { k: 'origin_story', g: 'Origin story of this pickle variety — Andhra heritage, family recipes.' }
  ];
  const ct = types[Math.floor(Math.random() * types.length)];
  const pInfo = `${product.name || product.product_name || product} ${product.price ? '(' + product.price + ')' : ''} — ${product.desc || ''}`;

  const prompt = `You are social media manager for "Sea Salt Pickles" (@seasaltpickles) — premium homemade Andhra-style pickles from Hyderabad. Website: seasaltpickles.com

TODAY: ${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}
PRODUCT: ${pInfo}
STYLE: ${ct.g}

Create a social media post for Instagram + Facebook. Caption 100-200 words, natural emojis, 15-20 hashtags, call to action. Must feel authentic, not AI-generated.

RESPOND IN EXACT JSON (no markdown, no backticks):
{"caption":"caption with emojis","hashtags":"#SeaSaltPickles #AndhraPickles ...","short_version":"1-2 line version","cta":"call to action","image_ideas":"2-3 ideas","content_type":"${ct.k}","product_featured":"${product.name || product.product_name || ''}"}`;

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 2048 } })
  });
  const gd = await res.json();
  if (gd.error) throw new Error('Gemini: ' + (gd.error.message || 'error'));

  const txt = gd.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let parsed;
  try { parsed = JSON.parse(txt.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); }
  catch (e) { parsed = { caption: txt.substring(0, 500), hashtags: '#SeaSaltPickles #AndhraPickles', short_version: txt.substring(0, 100), cta: 'Order at seasaltpickles.com', image_ideas: 'Product photo', content_type: ct.k, product_featured: product.name || '' }; }

  const token = 'apt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);

  if (SB_URL && SB_KEY) {
    try { await dbInsert('social_posts', { caption: parsed.caption, hashtags: parsed.hashtags, platforms: ['facebook', 'instagram'], status: 'pending_approval', ai_generated: true, tone: parsed.content_type, short_version: parsed.short_version, cta: parsed.cta, image_ideas: parsed.image_ideas, fb_post_id: token }); } catch (e) { console.error('[DB]', e.message); }
  }

  const approveUrl = SITE_URL + '/.netlify/functions/auto-post?action=approve&token=' + token;
  const rejectUrl = SITE_URL + '/.netlify/functions/auto-post?action=reject&token=' + token;

  if (OWNER_EMAIL && RESEND_KEY) { await sendEmail(OWNER_EMAIL, parsed, approveUrl, rejectUrl, pInfo); }

  return { success: true, token, post: parsed, approve_url: approveUrl, reject_url: rejectUrl, message: OWNER_EMAIL && RESEND_KEY ? 'Email sent to ' + OWNER_EMAIL : 'Click Approve to publish.' };
}

async function approvePost(token) {
  if (!token) throw new Error('Token required');
  const posts = await dbSelect('social_posts', 'fb_post_id=eq.' + token + '&status=eq.pending_approval&limit=1');
  if (!posts?.length) return { success: false, message: 'Not found or already processed.' };

  const post = posts[0];
  const msg = (post.caption || '') + '\n\n' + (post.hashtags || '') + (post.cta ? '\n\n' + post.cta : '');
  const results = [];

  if (PAGE_TOKEN && PAGE_ID) {
    try {
      const p = new URLSearchParams(); p.append('access_token', PAGE_TOKEN); p.append('message', msg);
      const r = await (await fetch(GRAPH_URL + '/' + PAGE_ID + '/feed', { method: 'POST', body: p })).json();
      results.push(r.id ? '✅ Facebook' : '❌ FB: ' + (r.error?.message || 'Failed'));
    } catch (e) { results.push('❌ FB: ' + e.message); }
  }

  if (PAGE_TOKEN && IG_USER_ID && post.image_url) {
    try {
      const cp = new URLSearchParams(); cp.append('access_token', PAGE_TOKEN); cp.append('image_url', post.image_url); cp.append('caption', msg);
      const cd = await (await fetch(GRAPH_URL + '/' + IG_USER_ID + '/media', { method: 'POST', body: cp })).json();
      if (cd.id) {
        await new Promise(r => setTimeout(r, 5000));
        const pp = new URLSearchParams(); pp.append('access_token', PAGE_TOKEN); pp.append('creation_id', cd.id);
        const pd = await (await fetch(GRAPH_URL + '/' + IG_USER_ID + '/media_publish', { method: 'POST', body: pp })).json();
        results.push(pd.id ? '✅ Instagram' : '❌ IG: ' + (pd.error?.message || 'Failed'));
      } else results.push('❌ IG: ' + (cd.error?.message || 'Failed'));
    } catch (e) { results.push('❌ IG: ' + e.message); }
  } else results.push('⏭️ IG skipped (no image)');

  await dbUpdate('social_posts', 'id=eq.' + post.id, { status: 'published', published_at: new Date().toISOString(), fb_post_id: '' });

  return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Approved</title><style>body{font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#0a0a0a;color:#e5e5e5}.c{background:#1a1a2e;border-radius:16px;padding:30px;border:1px solid #333}.s{padding:8px 16px;border-radius:8px;margin:6px 0;font-size:14px}.ok{background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3)}.no{background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3)}.sk{background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3)}</style></head><body><div class="c"><div style="font-size:24px;margin-bottom:12px">🔱 Post Approved!</div>${results.map(r => '<div class="s ' + (r.includes('✅') ? 'ok' : r.includes('⏭️') ? 'sk' : 'no') + '">' + r + '</div>').join('')}<p style="margin-top:16px;font-size:12px"><a href="${SITE_URL}" style="color:#a855f7">Open Dashboard →</a></p></div></body></html>` };
}

async function rejectPost(token) {
  if (!token) throw new Error('Token required');
  const posts = await dbSelect('social_posts', 'fb_post_id=eq.' + token + '&status=eq.pending_approval&limit=1');
  if (!posts?.length) return { success: false, message: 'Already processed.' };
  await dbUpdate('social_posts', 'id=eq.' + posts[0].id, { status: 'rejected', fb_post_id: '' });
  return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rejected</title><style>body{font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#0a0a0a;color:#e5e5e5}.c{background:#1a1a2e;border-radius:16px;padding:30px;border:1px solid #333}</style></head><body><div class="c"><div style="font-size:24px;margin-bottom:8px">🔱 Post Rejected</div><p style="color:#888">Not published. New one tomorrow.</p><p style="font-size:12px"><a href="${SITE_URL}" style="color:#a855f7">Dashboard →</a></p></div></body></html>` };
}

async function getPendingPosts() {
  if (!SB_URL || !SB_KEY) return { posts: [] };
  return { posts: await dbSelect('social_posts', 'status=eq.pending_approval&order=created_at.desc&limit=10') };
}

async function sendEmail(to, post, approveUrl, rejectUrl, productInfo) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + RESEND_KEY },
      body: JSON.stringify({
        from: 'SeaSalt AI <onboarding@resend.dev>', to: [to],
        subject: '🔱 Daily Post: ' + (post.product_featured || 'New') + ' — Approve?',
        html: '<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e5e5e5"><div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px"><div style="font-size:24px;font-weight:800;color:#fff">🔱 SeaSalt Daily Post</div><div style="color:#888;font-size:13px">AI-Generated · Awaiting Approval</div></div><div style="padding:24px;background:#111"><div style="background:rgba(100,50,255,0.08);border:1px solid rgba(100,50,255,0.2);border-radius:12px;padding:20px;margin-bottom:16px"><b style="color:#a855f7">📝 CAPTION</b><br><br>' + (post.caption || '').replace(/\n/g, '<br>') + '</div><div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:16px;margin-bottom:16px"><b style="color:#3b82f6">🏷️</b> ' + (post.hashtags || '') + '</div><div style="font-size:12px;color:#666;margin-bottom:20px">📦 ' + productInfo + '</div><a href="' + approveUrl + '" style="display:inline-block;padding:14px 32px;background:#10b981;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;margin-right:12px">✅ Approve</a><a href="' + rejectUrl + '" style="display:inline-block;padding:14px 28px;background:rgba(239,68,68,0.15);color:#ef4444;text-decoration:none;border-radius:10px;border:1px solid rgba(239,68,68,0.3)">❌ Reject</a></div></div>'
      })
    });
  } catch (e) { console.error('[Email]', e.message); }
}
