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

function sbH(pref) {
  var h = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
  if (pref) h['Prefer'] = pref;
  return h;
}

async function dbGet(table, q) {
  if (!SB_URL || !SB_KEY) return [];
  var r = await fetch(SB_URL + '/rest/v1/' + table + '?' + q, { headers: sbH() });
  return r.json();
}

async function dbAdd(table, row) {
  if (!SB_URL || !SB_KEY) return null;
  var r = await fetch(SB_URL + '/rest/v1/' + table, { method: 'POST', headers: sbH('return=representation'), body: JSON.stringify(row) });
  return r.json();
}

async function dbPatch(table, match, upd) {
  if (!SB_URL || !SB_KEY) return null;
  var r = await fetch(SB_URL + '/rest/v1/' + table + '?' + match, { method: 'PATCH', headers: sbH('return=representation'), body: JSON.stringify(upd) });
  return r.json();
}

var PRODUCTS = [
  { name: 'Andhra Avakaya Pickle', price: '₹299', desc: 'Raw mango pickle with red chili & sesame oil' },
  { name: 'Gongura Pickle', price: '₹249', desc: 'Tangy roselle leaf pickle' },
  { name: 'Chicken Pickle', price: '₹399', desc: 'Spicy boneless chicken in sesame oil' },
  { name: 'Prawn Pickle', price: '₹449', desc: 'Premium prawns in Andhra spices' },
  { name: 'Tomato Pickle', price: '₹199', desc: 'Sweet and tangy tomato pickle' },
  { name: 'Garlic Pickle', price: '₹219', desc: 'Fiery garlic in spiced sesame oil' },
  { name: 'Lemon Pickle', price: '₹179', desc: 'Whole lemon pickle aged to perfection' },
  { name: 'Ginger Pickle', price: '₹199', desc: 'Fresh ginger with mustard and fenugreek' },
  { name: 'Red Chilli Pickle', price: '₹249', desc: 'Stuffed red chilies the Andhra way' },
  { name: 'Mixed Veg Pickle', price: '₹229', desc: 'Carrots, cauliflower, green chili blend' }
];

export const handler = async function(event) {
  var H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

  var action = 'generate';
  var token = '';

  try {
    if (event.body) {
      var b = JSON.parse(event.body);
      action = b.action || 'generate';
      token = b.token || '';
    }
  } catch(e) {}

  var qs = event.queryStringParameters || {};
  if (qs.action) action = qs.action;
  if (qs.token) token = qs.token;

  try {
    if (action === 'generate') {
      var result = await doGenerate();
      return { statusCode: 200, headers: H, body: JSON.stringify(result) };
    }
    if (action === 'approve') {
      var result2 = await doApprove(token);
      return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: result2 };
    }
    if (action === 'reject') {
      var result3 = await doReject(token);
      return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: result3 };
    }
    return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: e.message || 'Unknown error' }) };
  }
};

async function doGenerate() {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');

  // Pick random product
  var product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  var pInfo = product.name + ' (' + product.price + ') - ' + product.desc;

  var types = ['product_highlight', 'behind_the_scenes', 'customer_love', 'recipe_tip', 'fun_fact', 'health_benefit', 'origin_story'];
  var ct = types[Math.floor(Math.random() * types.length)];

  var now = new Date();
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var prompt = 'You are social media manager for Sea Salt Pickles (@seasaltpickles) - premium homemade Andhra pickles from Hyderabad. Website: seasaltpickles.com\n\n';
  prompt += 'TODAY: ' + days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear() + '\n';
  prompt += 'PRODUCT: ' + pInfo + '\n';
  prompt += 'CONTENT TYPE: ' + ct + '\n\n';
  prompt += 'Create a social media post for Instagram + Facebook. Caption 100-200 words, emojis, 15-20 hashtags, call to action.\n\n';
  prompt += 'RESPOND IN EXACT JSON only (no markdown no backticks):\n';
  prompt += '{"caption":"caption with emojis","hashtags":"#SeaSaltPickles #AndhraPickles and more","short_version":"1-2 line version","cta":"call to action","image_ideas":"2-3 ideas","content_type":"' + ct + '","product_featured":"' + product.name + '"}';

  var gRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=' + GEMINI_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 2048 }
    })
  });

  var gData = await gRes.json();
  if (gData.error) throw new Error(gData.error.message || 'Gemini error');

  var txt = '';
  if (gData.candidates && gData.candidates[0] && gData.candidates[0].content && gData.candidates[0].content.parts && gData.candidates[0].content.parts[0]) {
    txt = gData.candidates[0].content.parts[0].text || '';
  }

  var parsed;
  try {
    parsed = JSON.parse(txt.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch (e) {
    parsed = { caption: txt.substring(0, 500), hashtags: '#SeaSaltPickles #AndhraPickles', short_version: txt.substring(0, 100), cta: 'Order at seasaltpickles.com', image_ideas: 'Product photo', content_type: ct, product_featured: product.name };
  }

  var tkn = 'apt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);

  // Save to DB
  try {
    await dbAdd('social_posts', {
      caption: parsed.caption || '',
      hashtags: parsed.hashtags || '',
      platforms: ['facebook', 'instagram'],
      status: 'pending_approval',
      ai_generated: true,
      tone: parsed.content_type || ct,
      short_version: parsed.short_version || '',
      cta: parsed.cta || '',
      image_ideas: parsed.image_ideas || '',
      fb_post_id: tkn
    });
  } catch (e) {}

  var approveUrl = SITE_URL + '/.netlify/functions/auto-post?action=approve&token=' + tkn;
  var rejectUrl = SITE_URL + '/.netlify/functions/auto-post?action=reject&token=' + tkn;

  return {
    success: true,
    token: tkn,
    post: parsed,
    approve_url: approveUrl,
    reject_url: rejectUrl,
    message: 'Daily post generated! Click Approve to publish.'
  };
}

async function doApprove(token) {
  if (!token) return '<h1>Token required</h1>';

  var posts = await dbGet('social_posts', 'fb_post_id=eq.' + token + '&status=eq.pending_approval&limit=1');
  if (!posts || !posts.length) return '<h1>Post not found or already processed</h1>';

  var post = posts[0];
  var msg = (post.caption || '') + '\n\n' + (post.hashtags || '');
  if (post.cta) msg += '\n\n' + post.cta;
  var results = [];

  // Facebook
  if (PAGE_TOKEN && PAGE_ID) {
    try {
      var p = new URLSearchParams();
      p.append('access_token', PAGE_TOKEN);
      p.append('message', msg);
      var r = await fetch(GRAPH_URL + '/' + PAGE_ID + '/feed', { method: 'POST', body: p });
      var d = await r.json();
      if (d.id) { results.push('Facebook: Published'); } else { results.push('Facebook: ' + (d.error && d.error.message ? d.error.message : 'Failed')); }
    } catch (e) { results.push('Facebook error: ' + e.message); }
  }

  // Instagram
  if (PAGE_TOKEN && IG_USER_ID && post.image_url) {
    try {
      var cp = new URLSearchParams();
      cp.append('access_token', PAGE_TOKEN);
      cp.append('image_url', post.image_url);
      cp.append('caption', msg);
      var cr = await fetch(GRAPH_URL + '/' + IG_USER_ID + '/media', { method: 'POST', body: cp });
      var cd = await cr.json();
      if (cd.id) {
        await new Promise(function(resolve) { setTimeout(resolve, 5000); });
        var pp = new URLSearchParams();
        pp.append('access_token', PAGE_TOKEN);
        pp.append('creation_id', cd.id);
        var pr = await fetch(GRAPH_URL + '/' + IG_USER_ID + '/media_publish', { method: 'POST', body: pp });
        var pd = await pr.json();
        if (pd.id) { results.push('Instagram: Published'); } else { results.push('Instagram: ' + (pd.error && pd.error.message ? pd.error.message : 'Failed')); }
      } else { results.push('Instagram: ' + (cd.error && cd.error.message ? cd.error.message : 'Failed')); }
    } catch (e) { results.push('Instagram error: ' + e.message); }
  } else {
    results.push('Instagram: Skipped (no image URL)');
  }

  // Update DB
  try { await dbPatch('social_posts', 'id=eq.' + post.id, { status: 'published', published_at: new Date().toISOString(), fb_post_id: '' }); } catch(e) {}

  return '<html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#0a0a0a;color:#fff"><h2>🔱 Post Approved!</h2>' + results.map(function(r) { return '<p>' + r + '</p>'; }).join('') + '<p><a href="' + SITE_URL + '" style="color:#a855f7">Open Dashboard</a></p></body></html>';
}

async function doReject(token) {
  if (!token) return '<h1>Token required</h1>';
  var posts = await dbGet('social_posts', 'fb_post_id=eq.' + token + '&status=eq.pending_approval&limit=1');
  if (!posts || !posts.length) return '<h1>Already processed</h1>';
  try { await dbPatch('social_posts', 'id=eq.' + posts[0].id, { status: 'rejected', fb_post_id: '' }); } catch(e) {}
  return '<html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#0a0a0a;color:#fff"><h2>🔱 Post Rejected</h2><p>Not published. New one tomorrow.</p><p><a href="' + SITE_URL + '" style="color:#a855f7">Dashboard</a></p></body></html>';
}
