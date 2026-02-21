// ═══════════════════════════════════════════════════════
// SeaSalt — Automated Daily Post Generator
// ═══════════════════════════════════════════════════════
// Scheduled: Every day at 8:00 AM IST (2:30 AM UTC)
// Flow: 
//   1. Pulls product data from Supabase
//   2. Gemini AI creates a post about a random product
//   3. Saves draft to Supabase with approval_token
//   4. Sends email with Approve/Reject links
//   5. On approve → auto-publishes to FB + IG
// ═══════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const PAGE_TOKEN = process.env.META_PAGE_TOKEN || '';
const PAGE_ID = process.env.META_PAGE_ID || '';
const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ID || '';
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || '';
const SITE_URL = process.env.URL || process.env.DEPLOY_URL || 'https://sage-paletas-ad2239.netlify.app';
const GRAPH_URL = 'https://graph.facebook.com/v25.0';

// ═══ SCHEDULED TRIGGER (runs daily) ═══
export const handler = async (event) => {
  const H = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const action = body.action || event.queryStringParameters?.action || 'generate';

    switch (action) {
      case 'generate':
        return { statusCode: 200, headers: H, body: JSON.stringify(await generateDailyPost()) };
      case 'approve':
        return { statusCode: 200, headers: H, body: JSON.stringify(await approvePost(body.token || event.queryStringParameters?.token)) };
      case 'reject':
        return { statusCode: 200, headers: H, body: JSON.stringify(await rejectPost(body.token || event.queryStringParameters?.token)) };
      case 'status':
        return { statusCode: 200, headers: H, body: JSON.stringify(await getPendingPosts()) };
      default:
        return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Unknown action' }) };
    }
  } catch (e) {
    console.error('[Auto Post] Error:', e);
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: e.message }) };
  }
};

// ═══ GENERATE DAILY POST ═══
async function generateDailyPost() {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');
  if (!SB_URL || !SB_KEY) throw new Error('Supabase credentials not set');

  const db = createClient(SB_URL, SB_KEY);

  // 1. Get products from website_intelligence
  let products = [];
  try {
    const { data } = await db.from('website_intelligence').select('brand_name,products,marketplace_platforms,site_score').eq('brand_name', 'Seasaltpickles').limit(1);
    if (data && data[0] && data[0].products) {
      products = typeof data[0].products === 'string' ? JSON.parse(data[0].products) : data[0].products;
    }
  } catch (e) { console.log('[Auto Post] No website_intelligence data:', e.message); }

  // 2. If no products from DB, use hardcoded Sea Salt Pickles product catalog
  if (!products || !products.length) {
    products = [
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
  }

  // 3. Check what was posted recently to avoid repeats
  let recentProducts = [];
  try {
    const { data: recent } = await db.from('social_posts')
      .select('caption')
      .eq('ai_generated', true)
      .order('created_at', { ascending: false })
      .limit(5);
    if (recent) recentProducts = recent.map(r => r.caption || '');
  } catch (e) {}

  // 4. Pick a random product (avoiding recent ones)
  let product = products[Math.floor(Math.random() * products.length)];
  const productName = product.name || product.product_name || product;
  
  // Try to avoid recently posted products
  for (let i = 0; i < 5; i++) {
    const name = typeof product === 'string' ? product : (product.name || product.product_name || '');
    const wasRecent = recentProducts.some(r => r.toLowerCase().includes(name.toLowerCase()));
    if (!wasRecent) break;
    product = products[Math.floor(Math.random() * products.length)];
  }

  // 5. Get today's context (day of week, season, etc.)
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = days[now.getDay()];
  const monthName = months[now.getMonth()];

  // 6. Randomly pick a content type for variety
  const contentTypes = [
    'product_highlight',
    'behind_the_scenes',
    'customer_love',
    'recipe_tip',
    'fun_fact',
    'festive_offer',
    'health_benefit',
    'origin_story'
  ];
  const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];

  const contentTypeGuide = {
    'product_highlight': 'Create a mouth-watering product showcase post. Highlight the taste, ingredients, and what makes it special.',
    'behind_the_scenes': 'Create a behind-the-scenes post about how this product is made. Show the craft, the care, the family tradition.',
    'customer_love': 'Create a post as if sharing a customer testimonial/review. Make it feel authentic and relatable.',
    'recipe_tip': 'Create a post with a quick recipe or serving suggestion using this product. What pairs well with it?',
    'fun_fact': 'Create an engaging post with an interesting fact about pickles, the ingredients, or Andhra food culture.',
    'festive_offer': `Create a ${monthName} seasonal post. Connect the product to current season, weather, or upcoming festivals.`,
    'health_benefit': 'Create a post about the health benefits of this product — probiotics, spices, traditional wellness.',
    'origin_story': 'Create a storytelling post about the origin of this pickle variety — Andhra heritage, family recipes, tradition.'
  };

  // 7. Build Gemini prompt
  const productInfo = typeof product === 'string' ? product : 
    `${product.name || product.product_name || 'Pickle'} ${product.price ? '('+product.price+')' : ''} ${product.desc || product.description || ''}`;

  const prompt = `You are the social media manager for "Sea Salt Pickles" (@seasaltpickles) — a premium homemade Andhra-style pickle brand from Hyderabad, India. Website: seasaltpickles.com

TODAY: ${dayName}, ${monthName} ${now.getDate()}, ${now.getFullYear()}
PRODUCT: ${productInfo}
CONTENT TYPE: ${contentTypeGuide[contentType]}

Create a social media post for BOTH Instagram and Facebook.

RULES:
- Caption should be 100-200 words, engaging, with natural emojis
- Include 15-20 hashtags 
- Must feel authentic, not AI-generated
- Include a call to action (order link, DM, etc.)
- Vary between fun, emotional, educational, and promotional tones

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no backticks):
{
  "caption": "The main post caption with emojis",
  "hashtags": "#SeaSaltPickles #AndhraPickles and 15+ more relevant hashtags",
  "short_version": "1-2 line version for Stories",
  "cta": "Clear call to action",
  "image_ideas": "2-3 specific image/video ideas for this post",
  "content_type": "${contentType}",
  "product_featured": "${typeof product === 'string' ? product : (product.name || '')}"
}`;

  // 8. Call Gemini
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;
  
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 2048 }
    })
  });

  const data = await res.json();
  if (data.error) throw new Error('Gemini: ' + (data.error.message || 'API error'));

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let parsed;
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(clean);
  } catch (e) {
    parsed = {
      caption: text.substring(0, 500),
      hashtags: '#SeaSaltPickles #AndhraPickles #HyderabadFood #HomemadePickles',
      short_version: text.substring(0, 100),
      cta: 'Order at seasaltpickles.com 🔱',
      image_ideas: 'Product photo, Flatlay, Behind-the-scenes',
      content_type: contentType,
      product_featured: typeof product === 'string' ? product : (product.name || '')
    };
  }

  // 9. Generate approval token
  const token = 'apt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);

  // 10. Save to Supabase as pending_approval
  const fullCaption = (parsed.caption || '') + '\n\n' + (parsed.hashtags || '');
  const postRecord = {
    caption: parsed.caption || '',
    hashtags: parsed.hashtags || '',
    platforms: ['facebook', 'instagram'],
    status: 'pending_approval',
    ai_generated: true,
    tone: parsed.content_type || contentType,
    short_version: parsed.short_version || '',
    cta: parsed.cta || '',
    image_ideas: parsed.image_ideas || '',
    fb_post_id: token // Store approval token here temporarily
  };

  try {
    await db.from('social_posts').insert(postRecord);
  } catch (e) {
    console.error('[Auto Post] DB save error:', e.message);
  }

  // 11. Send approval email
  const approveUrl = `${SITE_URL}/.netlify/functions/auto-post?action=approve&token=${token}`;
  const rejectUrl = `${SITE_URL}/.netlify/functions/auto-post?action=reject&token=${token}`;

  if (OWNER_EMAIL) {
    await sendApprovalEmail(OWNER_EMAIL, parsed, approveUrl, rejectUrl, productInfo);
  }

  return {
    success: true,
    token: token,
    post: parsed,
    approve_url: approveUrl,
    reject_url: rejectUrl,
    message: OWNER_EMAIL ? 
      `Daily post generated! Approval email sent to ${OWNER_EMAIL}` : 
      `Daily post generated! Set OWNER_EMAIL in Netlify to receive approval emails. Use approve URL manually.`
  };
}

// ═══ APPROVE POST ═══
async function approvePost(token) {
  if (!token) throw new Error('Approval token required');
  
  const db = createClient(SB_URL, SB_KEY);

  // Find the pending post
  const { data: posts } = await db.from('social_posts')
    .select('*')
    .eq('fb_post_id', token)
    .eq('status', 'pending_approval')
    .limit(1);

  if (!posts || !posts.length) {
    return { success: false, message: 'Post not found or already processed. Token: ' + token };
  }

  const post = posts[0];
  const fullMsg = (post.caption || '') + '\n\n' + (post.hashtags || '') + (post.cta ? '\n\n' + post.cta : '');

  let fbResult = null, igResult = null;
  const results = [];

  // Post to Facebook
  if (PAGE_TOKEN && PAGE_ID) {
    try {
      const params = new URLSearchParams();
      params.append('access_token', PAGE_TOKEN);
      params.append('message', fullMsg);
      
      const res = await fetch(`${GRAPH_URL}/${PAGE_ID}/feed`, { method: 'POST', body: params });
      fbResult = await res.json();
      
      if (fbResult.id) {
        results.push('✅ Facebook posted');
      } else {
        results.push('❌ Facebook: ' + (fbResult.error?.message || 'Failed'));
      }
    } catch (e) {
      results.push('❌ Facebook error: ' + e.message);
    }
  }

  // Post to Instagram (needs image — use a default or skip)
  if (PAGE_TOKEN && IG_USER_ID && post.image_url) {
    try {
      // Step 1: Create container
      const containerParams = new URLSearchParams();
      containerParams.append('access_token', PAGE_TOKEN);
      containerParams.append('image_url', post.image_url);
      containerParams.append('caption', fullMsg);

      const containerRes = await fetch(`${GRAPH_URL}/${IG_USER_ID}/media`, { method: 'POST', body: containerParams });
      const containerData = await containerRes.json();

      if (containerData.id) {
        // Wait for processing
        await new Promise(r => setTimeout(r, 5000));
        
        // Step 2: Publish
        const pubParams = new URLSearchParams();
        pubParams.append('access_token', PAGE_TOKEN);
        pubParams.append('creation_id', containerData.id);

        const pubRes = await fetch(`${GRAPH_URL}/${IG_USER_ID}/media_publish`, { method: 'POST', body: pubParams });
        igResult = await pubRes.json();

        if (igResult.id) {
          results.push('✅ Instagram posted');
        } else {
          results.push('❌ Instagram: ' + (igResult.error?.message || 'Failed'));
        }
      } else {
        results.push('❌ Instagram container: ' + (containerData.error?.message || 'Failed'));
      }
    } catch (e) {
      results.push('❌ Instagram error: ' + e.message);
    }
  } else if (!post.image_url) {
    // Post to FB only, log that IG needs image
    results.push('⏭️ Instagram skipped (no image URL)');
  }

  // Update post status
  await db.from('social_posts').update({
    status: 'published',
    published_at: new Date().toISOString(),
    fb_post_id: fbResult?.id || '',
    ig_media_id: igResult?.id || ''
  }).eq('id', post.id);

  const resultHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SeaSalt Post Approved</title>
    <style>body{font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#0a0a0a;color:#e5e5e5}
    .card{background:#1a1a2e;border-radius:16px;padding:30px;border:1px solid #333}.title{font-size:24px;margin-bottom:8px}
    .status{padding:8px 16px;border-radius:8px;margin:4px 0;font-size:14px}
    .ok{background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3)}
    .fail{background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3)}
    .skip{background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3)}</style></head>
    <body><div class="card"><div class="title">🔱 SeaSalt Post Approved!</div>
    <p style="color:#888">Your AI-generated post has been published.</p>
    ${results.map(r => `<div class="status ${r.includes('✅')?'ok':r.includes('⏭️')?'skip':'fail'}">${r}</div>`).join('')}
    <div style="margin-top:20px;padding:16px;background:rgba(100,50,255,0.1);border-radius:10px;font-size:13px;line-height:1.6">
    <strong>Caption:</strong><br>${(post.caption||'').substring(0,200)}...</div>
    <p style="margin-top:20px;font-size:12px;color:#666">
    <a href="${SITE_URL}" style="color:#a855f7">Open SeaSalt Intelligence Hub →</a></p></div></body></html>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: resultHtml,
    isBase64Encoded: false
  };
}

// ═══ REJECT POST ═══
async function rejectPost(token) {
  if (!token) throw new Error('Token required');
  
  const db = createClient(SB_URL, SB_KEY);
  
  const { data: posts } = await db.from('social_posts')
    .select('id')
    .eq('fb_post_id', token)
    .eq('status', 'pending_approval')
    .limit(1);

  if (!posts || !posts.length) {
    return { success: false, message: 'Post not found or already processed.' };
  }

  await db.from('social_posts').update({
    status: 'rejected',
    fb_post_id: ''
  }).eq('id', posts[0].id);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Post Rejected</title>
    <style>body{font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#0a0a0a;color:#e5e5e5}
    .card{background:#1a1a2e;border-radius:16px;padding:30px;border:1px solid #333}</style></head>
    <body><div class="card"><div style="font-size:24px;margin-bottom:8px">🔱 Post Rejected</div>
    <p style="color:#888">The AI-generated post was not published. A new one will be generated tomorrow at 8 AM.</p>
    <p style="margin-top:20px;font-size:12px"><a href="${SITE_URL}" style="color:#a855f7">Open SeaSalt Intelligence Hub →</a></p></div></body></html>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: html,
    isBase64Encoded: false
  };
}

// ═══ GET PENDING POSTS ═══
async function getPendingPosts() {
  const db = createClient(SB_URL, SB_KEY);
  const { data } = await db.from('social_posts')
    .select('*')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false })
    .limit(10);
  return { posts: data || [] };
}

// ═══ SEND APPROVAL EMAIL (via Netlify Email / Resend) ═══
async function sendApprovalEmail(to, post, approveUrl, rejectUrl, productInfo) {
  // Use Resend API (free tier: 100 emails/day)
  const RESEND_KEY = process.env.RESEND_API_KEY || '';
  
  if (!RESEND_KEY) {
    console.log('[Auto Post] No RESEND_API_KEY set. Skipping email. Approve URL:', approveUrl);
    return;
  }

  const emailHtml = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;padding:0">
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px;border-radius:16px 16px 0 0">
        <div style="font-size:28px;font-weight:800;color:#fff">🔱 SeaSalt Daily Post</div>
        <div style="color:#888;font-size:13px;margin-top:4px">AI-Generated · Awaiting Your Approval</div>
      </div>
      
      <div style="padding:24px;background:#111;border:1px solid #222">
        <div style="background:rgba(100,50,255,0.08);border:1px solid rgba(100,50,255,0.2);border-radius:12px;padding:20px;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;color:#a855f7;margin-bottom:8px">📝 CAPTION</div>
          <div style="font-size:14px;line-height:1.7;color:#e5e5e5">${(post.caption || '').replace(/\n/g, '<br>')}</div>
        </div>
        
        <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;color:#3b82f6;margin-bottom:6px">🏷️ HASHTAGS</div>
          <div style="font-size:12px;color:#60a5fa">${post.hashtags || ''}</div>
        </div>
        
        ${post.cta ? `<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;color:#10b981;margin-bottom:6px">🎯 CTA</div>
          <div style="font-size:13px;color:#34d399">${post.cta}</div>
        </div>` : ''}
        
        ${post.image_ideas ? `<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;color:#f59e0b;margin-bottom:6px">📸 IMAGE IDEAS</div>
          <div style="font-size:12px;color:#fbbf24">${post.image_ideas}</div>
        </div>` : ''}
        
        <div style="font-size:12px;color:#666;margin-bottom:20px">
          📦 Product: <strong>${productInfo}</strong><br>
          🎨 Content Type: <strong>${post.content_type || 'promotional'}</strong><br>
          📅 Platforms: <strong>Facebook + Instagram</strong>
        </div>
        
        <div style="display:flex;gap:12px;margin-top:24px">
          <a href="${approveUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">✅ Approve & Publish</a>
          <a href="${rejectUrl}" style="display:inline-block;padding:14px 32px;background:rgba(239,68,68,0.15);color:#ef4444;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;border:1px solid rgba(239,68,68,0.3)">❌ Reject</a>
        </div>
        
        <div style="margin-top:20px;padding:12px;background:rgba(245,158,11,0.08);border-radius:8px;font-size:11px;color:#f59e0b">
          ⚠️ Note: Instagram posting requires a public image URL. If no image is provided, only Facebook will be posted. 
          You can add an image URL later from the SeaSalt Intelligence Hub.
        </div>
      </div>
      
      <div style="padding:16px;text-align:center;font-size:11px;color:#555">
        🔱 SeaSalt Intelligence Hub · Automated by AI<br>
        <a href="${SITE_URL}" style="color:#a855f7">Open Dashboard</a>
      </div>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: 'SeaSalt AI <onboarding@resend.dev>',
        to: [to],
        subject: `🔱 SeaSalt Daily Post — ${post.product_featured || 'New Post'} — Approve?`,
        html: emailHtml
      })
    });
    const result = await res.json();
    console.log('[Auto Post] Email sent:', result);
  } catch (e) {
    console.error('[Auto Post] Email error:', e.message);
  }
}
