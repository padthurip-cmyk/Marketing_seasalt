const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const PAGE_TOKEN = process.env.META_PAGE_TOKEN || '';
const PAGE_ID = process.env.META_PAGE_ID || '';
const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ID || '';
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_KEY || '';
const GRAPH_URL = 'https://graph.facebook.com/v25.0';

function sbH(pref) {
  var h = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
  if (pref) h['Prefer'] = pref;
  return h;
}
async function dbGet(table, q) {
  if (!SB_URL || !SB_KEY) return [];
  return (await fetch(SB_URL + '/rest/v1/' + table + '?' + q, { headers: sbH() })).json();
}
async function dbAdd(table, row) {
  if (!SB_URL || !SB_KEY) return null;
  return (await fetch(SB_URL + '/rest/v1/' + table, { method: 'POST', headers: sbH('return=representation'), body: JSON.stringify(row) })).json();
}

// ═══ PRODUCT CATALOG WITH REAL IMAGES FROM seasaltpickles.com ═══
var PRODUCTS = [
  {
    name: 'Non-Veg Pickles Collection',
    price: '₹399+',
    desc: 'Chicken, mutton, prawn & fish pickles in authentic Andhra spices',
    image: 'https://static.wixstatic.com/media/163af4_0f310878fded4483878262a9b5bd7a2c~mv2.jpg/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/1.jpg'
  },
  {
    name: 'Veg Pickles Collection',
    price: '₹199+',
    desc: 'Avakaya, gongura, tomato, lemon & more homemade veg pickles',
    image: 'https://static.wixstatic.com/media/163af4_0a7bce5cd55c43ffbca9a8d13a530c17~mv2.jpg/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/2.jpg'
  },
  {
    name: 'Masalas & Karam Podis',
    price: '₹149+',
    desc: 'Biryani masala, karam podi, rasam powder & authentic spice blends',
    image: 'https://static.wixstatic.com/media/163af4_816f672a49084747b491158f8cd2708b~mv2.jpg/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/4.jpg'
  },
  {
    name: 'Dry Fruit Laddu & Sweets',
    price: '₹299+',
    desc: 'Healthy dry fruit laddu with nuts & natural sweeteners',
    image: 'https://static.wixstatic.com/media/163af4_8807a03859674ca3b6231625c93ec525~mv2.jpg/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/3.jpg'
  },
  {
    name: 'Special Combo Pack',
    price: '₹599+',
    desc: 'Veg & non-veg pickle combo with authentic spices - perfect gift',
    image: 'https://static.wixstatic.com/media/163af4_9d4b318bfc3b4f9b842ad99c34357cdf~mv2.jpg/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/5.jpg'
  },
  {
    name: 'Sea Salt Pickles Logo Brand',
    price: '',
    desc: 'Premium homemade Andhra pickles brand from Hyderabad',
    image: 'https://static.wixstatic.com/media/163af4_1a88c8f7a40d44f3a2ed6a0d10586dd4~mv2.jpg/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/Sea%20salt%20pickles%20logo.jpg'
  },
  {
    name: 'Chicken Pickle',
    price: '₹399',
    desc: 'Spicy boneless chicken pickle slow-cooked in sesame oil',
    image: 'https://static.wixstatic.com/media/163af4_0f310878fded4483878262a9b5bd7a2c~mv2.jpg/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/1.jpg'
  },
  {
    name: 'Avakaya Pickle',
    price: '₹299',
    desc: 'Authentic raw mango pickle with red chili mustard and sesame oil',
    image: 'https://static.wixstatic.com/media/163af4_0a7bce5cd55c43ffbca9a8d13a530c17~mv2.jpg/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/2.jpg'
  },
  {
    name: 'Gongura Pickle',
    price: '₹249',
    desc: 'Tangy roselle leaf pickle - classic Andhra flavor',
    image: 'https://static.wixstatic.com/media/163af4_0a7bce5cd55c43ffbca9a8d13a530c17~mv2.jpg/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/2.jpg'
  },
  {
    name: 'Biryani Masala',
    price: '₹149',
    desc: 'Authentic Hyderabadi biryani masala blend',
    image: 'https://static.wixstatic.com/media/163af4_816f672a49084747b491158f8cd2708b~mv2.jpg/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/4.jpg'
  }
];

export const handler = async function(event) {
  var H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

  var action = 'generate';
  try { if (event.body) { action = JSON.parse(event.body).action || 'generate'; } } catch(e) {}
  if ((event.queryStringParameters || {}).action) action = event.queryStringParameters.action;

  try {
    if (action === 'generate') return { statusCode: 200, headers: H, body: JSON.stringify(await generateAndPublish()) };
    return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: e.message || 'Error', stack: (e.stack || '').substring(0, 200) }) };
  }
};

async function generateAndPublish() {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');
  if (!PAGE_TOKEN) throw new Error('META_PAGE_TOKEN not set');

  // === 1. PICK RANDOM PRODUCT (with image!) ===
  var product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];

  // Avoid recent repeats
  try {
    var recent = await dbGet('social_posts', 'ai_generated=eq.true&order=created_at.desc&limit=5&select=caption');
    if (recent && recent.length) {
      for (var i = 0; i < 5; i++) {
        var nm = (product.name || '').toLowerCase();
        var used = false;
        for (var j = 0; j < recent.length; j++) {
          if ((recent[j].caption || '').toLowerCase().indexOf(nm) >= 0) { used = true; break; }
        }
        if (!used) break;
        product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      }
    }
  } catch(e) {}

  var pInfo = product.name + (product.price ? ' (' + product.price + ')' : '') + ' - ' + product.desc;
  var imageUrl = product.image;

  // === 2. GEMINI AI CONTENT ===
  var types = ['product_highlight', 'behind_the_scenes', 'customer_love', 'recipe_tip', 'fun_fact', 'health_benefit', 'origin_story'];
  var ct = types[Math.floor(Math.random() * types.length)];
  var now = new Date();
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var prompt = 'You are social media manager for Sea Salt Pickles (@seasaltpickles) - premium homemade Andhra pickles from Hyderabad. Website: seasaltpickles.com\n\n';
  prompt += 'TODAY: ' + days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate() + '\n';
  prompt += 'PRODUCT: ' + pInfo + '\nSTYLE: ' + ct + '\n\n';
  prompt += 'Create a social media post. Caption 100-200 words, emojis, 15-20 hashtags, call to action. Must feel authentic.\n\n';
  prompt += 'RESPOND IN EXACT JSON only:\n';
  prompt += '{"caption":"caption","hashtags":"hashtags","short_version":"short","cta":"cta","content_type":"' + ct + '","product_featured":"' + product.name + '"}';

  var gRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 2048 }
    })
  });

  var gData = await gRes.json();
  if (gData.error) throw new Error('Gemini: ' + (gData.error.message || 'error'));

  // Gemini 2.5 Flash is a "thinking" model - text may be in different parts
  var txt = '';
  try {
    var parts = gData.candidates[0].content.parts;
    for (var pi = 0; pi < parts.length; pi++) {
      // Skip "thought" parts, get the actual text response
      if (parts[pi].text && !parts[pi].thought) {
        txt = parts[pi].text;
        break;
      }
    }
    // If no non-thought text found, try last part
    if (!txt && parts.length > 0) {
      txt = parts[parts.length - 1].text || '';
    }
  } catch(e) {
    // Fallback: stringify entire response for debugging
    throw new Error('Gemini response parse failed: ' + JSON.stringify(gData).substring(0, 300));
  }

  var parsed;
  try { parsed = JSON.parse(txt.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); }
  catch (e) { parsed = { caption: txt.substring(0, 500), hashtags: '#SeaSaltPickles #AndhraPickles', cta: 'Order at seasaltpickles.com', content_type: ct, product_featured: product.name }; }

  // === 3. BUILD FULL MESSAGE ===
  var fullMsg = (parsed.caption || '') + '\n\n' + (parsed.hashtags || '');
  if (parsed.cta) fullMsg += '\n\n' + parsed.cta;

  var results = [];
  var fbPostId = '';
  var igMediaId = '';
  var postUrl = '';

  // === 4. POST TO FACEBOOK (with image!) ===
  if (PAGE_TOKEN && PAGE_ID) {
    try {
      var fbParams = new URLSearchParams();
      fbParams.append('access_token', PAGE_TOKEN);
      
      if (imageUrl) {
        // Photo post - use /photos with 'message' not 'caption'
        fbParams.append('url', imageUrl);
        fbParams.append('message', fullMsg);
        var fbRes = await fetch(GRAPH_URL + '/' + PAGE_ID + '/photos', { method: 'POST', body: fbParams });
      } else {
        // Text-only post
        fbParams.append('message', fullMsg);
        var fbRes = await fetch(GRAPH_URL + '/' + PAGE_ID + '/feed', { method: 'POST', body: fbParams });
      }
      var fbData = await fbRes.json();
      
      if (fbData.id || fbData.post_id) {
        fbPostId = fbData.id || fbData.post_id;
        postUrl = 'https://facebook.com/' + fbPostId;
        results.push('Facebook: POSTED ✅');
      } else {
        // If photo endpoint fails, try text-only as fallback
        var fb2 = new URLSearchParams();
        fb2.append('access_token', PAGE_TOKEN);
        fb2.append('message', fullMsg);
        var fbRes2 = await fetch(GRAPH_URL + '/' + PAGE_ID + '/feed', { method: 'POST', body: fb2 });
        var fbData2 = await fbRes2.json();
        if (fbData2.id) {
          fbPostId = fbData2.id;
          postUrl = 'https://facebook.com/' + fbData2.id;
          results.push('Facebook: POSTED ✅ (text only)');
        } else {
          results.push('Facebook: FAILED ❌ ' + (fbData2.error && fbData2.error.message ? fbData2.error.message : JSON.stringify(fbData)));
        }
      }
    } catch (e) { results.push('Facebook: ERROR ❌ ' + e.message); }
  } else {
    results.push('Facebook: SKIPPED (no token)');
  }

  // === 5. POST TO INSTAGRAM (with product image!) ===
  if (PAGE_TOKEN && IG_USER_ID && imageUrl) {
    try {
      // Step 1: Create media container
      var igParams = new URLSearchParams();
      igParams.append('access_token', PAGE_TOKEN);
      igParams.append('image_url', imageUrl);
      igParams.append('caption', fullMsg);
      var igRes = await fetch(GRAPH_URL + '/' + IG_USER_ID + '/media', { method: 'POST', body: igParams });
      var igContainer = await igRes.json();

      if (igContainer.id) {
        // Step 2: Wait for processing
        var ready = false;
        for (var w = 0; w < 15; w++) {
          await new Promise(function(r) { setTimeout(r, 2000); });
          var sRes = await fetch(GRAPH_URL + '/' + igContainer.id + '?fields=status_code&access_token=' + PAGE_TOKEN);
          var sData = await sRes.json();
          if (sData.status_code === 'FINISHED') { ready = true; break; }
          if (sData.status_code === 'ERROR') { results.push('Instagram: PROCESSING ERROR ❌'); break; }
        }

        if (ready) {
          // Step 3: Publish
          var pubParams = new URLSearchParams();
          pubParams.append('access_token', PAGE_TOKEN);
          pubParams.append('creation_id', igContainer.id);
          var pubRes = await fetch(GRAPH_URL + '/' + IG_USER_ID + '/media_publish', { method: 'POST', body: pubParams });
          var pubData = await pubRes.json();
          if (pubData.id) {
            igMediaId = pubData.id;
            results.push('Instagram: POSTED ✅');
          } else {
            results.push('Instagram: PUBLISH FAILED ❌ ' + (pubData.error && pubData.error.message ? pubData.error.message : ''));
          }
        } else if (!results.some(function(r) { return r.indexOf('Instagram') >= 0; })) {
          results.push('Instagram: TIMEOUT ❌ (image processing took too long)');
        }
      } else {
        results.push('Instagram: CONTAINER FAILED ❌ ' + (igContainer.error && igContainer.error.message ? igContainer.error.message : JSON.stringify(igContainer)));
      }
    } catch (e) { results.push('Instagram: ERROR ❌ ' + e.message); }
  } else {
    results.push('Instagram: SKIPPED (no IG_USER_ID or image)');
  }

  // === 6. SAVE TO DATABASE ===
  try {
    await dbAdd('social_posts', {
      caption: parsed.caption || '',
      hashtags: parsed.hashtags || '',
      platforms: fbPostId && igMediaId ? ['facebook', 'instagram'] : fbPostId ? ['facebook'] : igMediaId ? ['instagram'] : [],
      status: 'published',
      published_at: new Date().toISOString(),
      ai_generated: true,
      tone: parsed.content_type || ct,
      short_version: parsed.short_version || '',
      cta: parsed.cta || '',
      image_ideas: parsed.image_ideas || '',
      image_url: imageUrl || '',
      fb_post_id: fbPostId,
      ig_media_id: igMediaId,
      post_url: postUrl
    });
  } catch (e) { results.push('Database: ERROR ' + e.message); }

  return {
    success: (fbPostId || igMediaId) ? true : false,
    post: parsed,
    image_url: imageUrl,
    facebook: fbPostId ? { id: fbPostId, url: postUrl, status: 'posted' } : { status: 'failed' },
    instagram: igMediaId ? { id: igMediaId, status: 'posted' } : { status: imageUrl ? 'failed' : 'skipped' },
    results: results,
    message: results.join(' | ')
  };
}
