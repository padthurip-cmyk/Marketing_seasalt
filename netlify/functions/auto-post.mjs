// ═══════════════════════════════════════════════════════
// SeaSalt — Facebook + Instagram Auto-Post Function
// ═══════════════════════════════════════════════════════
// Endpoint: /.netlify/functions/social-post
// Methods:
//   POST { action: 'post_facebook', message, link, image_url }
//   POST { action: 'post_instagram', caption, image_url }
//   POST { action: 'post_instagram_reel', caption, video_url }
//   POST { action: 'post_both', message, image_url }
//   POST { action: 'get_metrics', post_id }
//   POST { action: 'get_feed' }
//   POST { action: 'get_ig_feed' }
//   POST { action: 'get_ig_metrics', media_id }
//   POST { action: 'convert_token' } — get long-lived token
// ═══════════════════════════════════════════════════════

const PAGE_ID = process.env.META_PAGE_ID || '';
const PAGE_TOKEN = process.env.META_PAGE_TOKEN || '';
const APP_ID = process.env.META_APP_ID || '';
const APP_SECRET = process.env.META_APP_SECRET || '';
const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ID || '';
const GRAPH_URL = 'https://graph.facebook.com/v25.0';

export const handler = async (event) => {
  const H = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: H, body: JSON.stringify({ error: 'POST only' }) };

  if (!PAGE_TOKEN) {
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'META_PAGE_TOKEN not set. Add it in Netlify Environment Variables.' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action } = body;

    switch (action) {
      case 'post_facebook':
        return { statusCode: 200, headers: H, body: JSON.stringify(await postToFacebook(body)) };
      case 'post_photo':
        return { statusCode: 200, headers: H, body: JSON.stringify(await postPhoto(body)) };
      case 'post_instagram':
        return { statusCode: 200, headers: H, body: JSON.stringify(await postToInstagram(body)) };
      case 'post_instagram_reel':
        return { statusCode: 200, headers: H, body: JSON.stringify(await postInstagramReel(body)) };
      case 'post_both':
        return { statusCode: 200, headers: H, body: JSON.stringify(await postBoth(body)) };
      case 'get_metrics':
        return { statusCode: 200, headers: H, body: JSON.stringify(await getPostMetrics(body.post_id)) };
      case 'get_feed':
        return { statusCode: 200, headers: H, body: JSON.stringify(await getPageFeed()) };
      case 'get_ig_feed':
        return { statusCode: 200, headers: H, body: JSON.stringify(await getInstagramFeed()) };
      case 'get_ig_metrics':
        return { statusCode: 200, headers: H, body: JSON.stringify(await getIGMediaMetrics(body.media_id)) };
      case 'get_page_info':
        return { statusCode: 200, headers: H, body: JSON.stringify(await getPageInfo()) };
      case 'convert_token':
        return { statusCode: 200, headers: H, body: JSON.stringify(await convertToLongLived(body.short_token)) };
      default:
        return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
    }
  } catch (e) {
    console.error('[Social Post] Error:', e);
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: e.message }) };
  }
};

// ═══ POST TEXT/LINK TO FACEBOOK PAGE ═══
async function postToFacebook({ message, link, scheduled_publish_time }) {
  const params = new URLSearchParams();
  params.append('access_token', PAGE_TOKEN);
  if (message) params.append('message', message);
  if (link) params.append('link', link);

  // Schedule for future (Unix timestamp)
  if (scheduled_publish_time) {
    params.append('published', 'false');
    params.append('scheduled_publish_time', scheduled_publish_time);
  }

  const url = `${GRAPH_URL}/${PAGE_ID}/feed`;
  console.log('[FB Post] Posting to:', url);

  const res = await fetch(url, {
    method: 'POST',
    body: params
  });

  const data = await res.json();

  if (data.error) {
    console.error('[FB Post] Error:', data.error);
    throw new Error(data.error.message || 'Facebook API error');
  }

  console.log('[FB Post] Success! Post ID:', data.id);
  return {
    success: true,
    post_id: data.id,
    post_url: `https://www.facebook.com/${data.id.replace('_', '/posts/')}`,
    platform: 'facebook',
    message: 'Posted to Sea Salt Pickles Facebook Page!'
  };
}

// ═══ POST PHOTO TO FACEBOOK PAGE ═══
async function postPhoto({ message, image_url }) {
  if (!image_url) throw new Error('image_url required for photo posts');

  const params = new URLSearchParams();
  params.append('access_token', PAGE_TOKEN);
  params.append('url', image_url);
  if (message) params.append('message', message);

  const url = `${GRAPH_URL}/${PAGE_ID}/photos`;
  console.log('[FB Photo] Posting photo to:', url);

  const res = await fetch(url, {
    method: 'POST',
    body: params
  });

  const data = await res.json();

  if (data.error) {
    console.error('[FB Photo] Error:', data.error);
    throw new Error(data.error.message || 'Facebook API error');
  }

  console.log('[FB Photo] Success! Post ID:', data.post_id || data.id);
  return {
    success: true,
    post_id: data.post_id || data.id,
    photo_id: data.id,
    platform: 'facebook',
    message: 'Photo posted to Sea Salt Pickles Facebook Page!'
  };
}

// ═══ GET POST METRICS ═══
async function getPostMetrics(post_id) {
  if (!post_id) throw new Error('post_id required');

  // Get basic post data + reactions/comments/shares
  const url = `${GRAPH_URL}/${post_id}?fields=id,message,created_time,permalink_url,shares,likes.summary(true),comments.summary(true),insights.metric(post_impressions,post_engaged_users,post_clicks)&access_token=${PAGE_TOKEN}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    // Try without insights (some posts don't have insights)
    const url2 = `${GRAPH_URL}/${post_id}?fields=id,message,created_time,permalink_url,shares,likes.summary(true),comments.summary(true)&access_token=${PAGE_TOKEN}`;
    const res2 = await fetch(url2);
    const data2 = await res2.json();
    if (data2.error) throw new Error(data2.error.message);

    return {
      post_id: data2.id,
      message: (data2.message || '').substring(0, 100),
      created_time: data2.created_time,
      permalink: data2.permalink_url,
      likes: data2.likes?.summary?.total_count || 0,
      comments: data2.comments?.summary?.total_count || 0,
      shares: data2.shares?.count || 0
    };
  }

  // Parse insights
  const insights = {};
  if (data.insights && data.insights.data) {
    data.insights.data.forEach(m => {
      insights[m.name] = m.values?.[0]?.value || 0;
    });
  }

  return {
    post_id: data.id,
    message: (data.message || '').substring(0, 100),
    created_time: data.created_time,
    permalink: data.permalink_url,
    likes: data.likes?.summary?.total_count || 0,
    comments: data.comments?.summary?.total_count || 0,
    shares: data.shares?.count || 0,
    impressions: insights.post_impressions || 0,
    engaged_users: insights.post_engaged_users || 0,
    clicks: insights.post_clicks || 0
  };
}

// ═══ GET PAGE FEED (recent posts) ═══
async function getPageFeed() {
  const url = `${GRAPH_URL}/${PAGE_ID}/posts?fields=id,message,created_time,permalink_url,full_picture,shares,likes.summary(true),comments.summary(true)&limit=20&access_token=${PAGE_TOKEN}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) throw new Error(data.error.message);

  return {
    posts: (data.data || []).map(p => ({
      post_id: p.id,
      message: (p.message || '').substring(0, 150),
      created_time: p.created_time,
      permalink: p.permalink_url,
      image: p.full_picture || '',
      likes: p.likes?.summary?.total_count || 0,
      comments: p.comments?.summary?.total_count || 0,
      shares: p.shares?.count || 0
    })),
    page_id: PAGE_ID,
    count: (data.data || []).length
  };
}

// ═══ GET PAGE INFO ═══
async function getPageInfo() {
  const url = `${GRAPH_URL}/${PAGE_ID}?fields=id,name,fan_count,followers_count,new_like_count,talking_about_count,website,picture&access_token=${PAGE_TOKEN}`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  return data;
}

// ═══ CONVERT SHORT-LIVED TOKEN TO LONG-LIVED ═══
async function convertToLongLived(shortToken) {
  if (!shortToken) throw new Error('short_token required');
  if (!APP_ID || !APP_SECRET) throw new Error('META_APP_ID and META_APP_SECRET required');

  const url = `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) throw new Error(data.error.message);

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
    message: 'Long-lived token generated! Expires in ~60 days. Add this as META_PAGE_TOKEN in Netlify.'
  };
}

// ═══════════════════════════════════════════════════════
// INSTAGRAM AUTO-POSTING (via Graph API)
// ═══════════════════════════════════════════════════════

// ═══ POST IMAGE TO INSTAGRAM ═══
async function postToInstagram({ caption, image_url }) {
  if (!IG_USER_ID) throw new Error('INSTAGRAM_BUSINESS_ID not set in Netlify Environment Variables.');
  if (!image_url) throw new Error('image_url required. Instagram requires a publicly accessible image URL.');

  console.log('[IG Post] Creating container for:', image_url);

  // Step 1: Create media container
  const containerParams = new URLSearchParams();
  containerParams.append('access_token', PAGE_TOKEN);
  containerParams.append('image_url', image_url);
  if (caption) containerParams.append('caption', caption);

  const containerRes = await fetch(`${GRAPH_URL}/${IG_USER_ID}/media`, {
    method: 'POST',
    body: containerParams
  });
  const containerData = await containerRes.json();

  if (containerData.error) {
    console.error('[IG Post] Container error:', containerData.error);
    throw new Error(containerData.error.message);
  }

  const creationId = containerData.id;
  console.log('[IG Post] Container created:', creationId);

  // Step 2: Wait for processing (poll status)
  await waitForIGContainer(creationId);

  // Step 3: Publish
  const publishParams = new URLSearchParams();
  publishParams.append('access_token', PAGE_TOKEN);
  publishParams.append('creation_id', creationId);

  const publishRes = await fetch(`${GRAPH_URL}/${IG_USER_ID}/media_publish`, {
    method: 'POST',
    body: publishParams
  });
  const publishData = await publishRes.json();

  if (publishData.error) {
    console.error('[IG Post] Publish error:', publishData.error);
    throw new Error(publishData.error.message);
  }

  console.log('[IG Post] Published! Media ID:', publishData.id);
  return {
    success: true,
    media_id: publishData.id,
    post_url: `https://www.instagram.com/seasaltpickles/`,
    platform: 'instagram',
    message: 'Posted to @seasaltpickles Instagram!'
  };
}

// ═══ POST REEL TO INSTAGRAM ═══
async function postInstagramReel({ caption, video_url, cover_url }) {
  if (!IG_USER_ID) throw new Error('INSTAGRAM_BUSINESS_ID not set.');
  if (!video_url) throw new Error('video_url required for Reels.');

  const containerParams = new URLSearchParams();
  containerParams.append('access_token', PAGE_TOKEN);
  containerParams.append('video_url', video_url);
  containerParams.append('media_type', 'REELS');
  if (caption) containerParams.append('caption', caption);
  if (cover_url) containerParams.append('cover_url', cover_url);

  const containerRes = await fetch(`${GRAPH_URL}/${IG_USER_ID}/media`, {
    method: 'POST',
    body: containerParams
  });
  const containerData = await containerRes.json();
  if (containerData.error) throw new Error(containerData.error.message);

  // Wait for video processing (can take longer)
  await waitForIGContainer(containerData.id, 30);

  const publishParams = new URLSearchParams();
  publishParams.append('access_token', PAGE_TOKEN);
  publishParams.append('creation_id', containerData.id);

  const publishRes = await fetch(`${GRAPH_URL}/${IG_USER_ID}/media_publish`, {
    method: 'POST',
    body: publishParams
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(publishData.error.message);

  return {
    success: true,
    media_id: publishData.id,
    platform: 'instagram',
    message: 'Reel posted to @seasaltpickles!'
  };
}

// ═══ POST TO BOTH FB + INSTAGRAM ═══
async function postBoth({ message, image_url, caption }) {
  const results = { facebook: null, instagram: null };

  // Post to Facebook
  try {
    if (image_url) {
      results.facebook = await postPhoto({ message, image_url });
    } else {
      results.facebook = await postToFacebook({ message });
    }
  } catch (e) {
    results.facebook = { error: e.message };
  }

  // Post to Instagram (requires image)
  if (image_url && IG_USER_ID) {
    try {
      results.instagram = await postToInstagram({ caption: caption || message, image_url });
    } catch (e) {
      results.instagram = { error: e.message };
    }
  } else if (!image_url) {
    results.instagram = { error: 'Instagram requires an image_url. Text-only posts not supported.' };
  }

  return {
    success: !!(results.facebook?.success || results.instagram?.success),
    facebook: results.facebook,
    instagram: results.instagram,
    message: 'Posted to ' + 
      (results.facebook?.success ? 'Facebook ✅' : 'Facebook ❌') + ' + ' +
      (results.instagram?.success ? 'Instagram ✅' : 'Instagram ❌')
  };
}

// ═══ WAIT FOR IG CONTAINER PROCESSING ═══
async function waitForIGContainer(containerId, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${GRAPH_URL}/${containerId}?fields=status_code,status&access_token=${PAGE_TOKEN}`);
    const data = await res.json();
    
    if (data.status_code === 'FINISHED') return true;
    if (data.status_code === 'ERROR') throw new Error('Instagram media processing failed: ' + (data.status || 'Unknown error'));
    
    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Instagram media processing timed out. Try again.');
}

// ═══ GET INSTAGRAM FEED ═══
async function getInstagramFeed() {
  if (!IG_USER_ID) throw new Error('INSTAGRAM_BUSINESS_ID not set.');

  const url = `${GRAPH_URL}/${IG_USER_ID}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=20&access_token=${PAGE_TOKEN}`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  return {
    posts: (data.data || []).map(p => ({
      media_id: p.id,
      caption: (p.caption || '').substring(0, 150),
      media_type: p.media_type,
      media_url: p.media_url || '',
      permalink: p.permalink,
      timestamp: p.timestamp,
      likes: p.like_count || 0,
      comments: p.comments_count || 0
    })),
    count: (data.data || []).length,
    platform: 'instagram'
  };
}

// ═══ GET IG MEDIA METRICS ═══
async function getIGMediaMetrics(mediaId) {
  if (!mediaId) throw new Error('media_id required');

  const url = `${GRAPH_URL}/${mediaId}?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count,media_url&access_token=${PAGE_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  // Try to get insights
  let insights = {};
  try {
    const insUrl = `${GRAPH_URL}/${mediaId}/insights?metric=impressions,reach,engagement&access_token=${PAGE_TOKEN}`;
    const insRes = await fetch(insUrl);
    const insData = await insRes.json();
    if (insData.data) {
      insData.data.forEach(m => { insights[m.name] = m.values?.[0]?.value || 0; });
    }
  } catch (e) { /* insights may not be available for all media */ }

  return {
    media_id: data.id,
    caption: (data.caption || '').substring(0, 100),
    media_type: data.media_type,
    permalink: data.permalink,
    likes: data.like_count || 0,
    comments: data.comments_count || 0,
    impressions: insights.impressions || 0,
    reach: insights.reach || 0,
    engagement: insights.engagement || 0
  };
}
