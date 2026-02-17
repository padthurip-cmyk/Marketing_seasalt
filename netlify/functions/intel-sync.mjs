// ═══════════════════════════════════════════════════════════════════
// SeaSalt Intelligence — DEEP SYNC Engine v4
// ═══════════════════════════════════════════════════════════════════
// Data Sources:
// 1. Google Places API → ratings, reviews, address, phone, website
// 2. Google Places Reviews → reviewer names, profiles, sentiments
// 3. YouTube Data API v3 → subscribers, videos, views
// 4. YouTube Comments API → commenter names, channel links, sentiments
// 5. Website meta scraping → social links, tech stack, e-commerce
// 6. Auto-Insights Engine → AI-generated competitive intelligence
// ═══════════════════════════════════════════════════════════════════

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_KEY || '';

const COMPETITORS = [
  { name: "Vellanki Foods", searches: ["Vellanki Foods", "Vellanki Foods Hyderabad"], url: "vellankifoods.com", code: "VF", color: "#C2410C", youtube: "Vellanki Foods" },
  { name: "Tulasi Pickles", searches: ["Tulasi Pickles", "Tulasi Pickles Hyderabad"], url: "tulasipickles.com", code: "TP", color: "#16A34A", youtube: "Tulasi Pickles" },
  { name: "Aavarampoo Pickles", searches: ["Aavarampoo Pickles", "Aavarampoo Foods"], url: "aavarampoo.com", code: "AP", color: "#7C3AED", youtube: "Aavarampoo Pickles" },
  { name: "Nirupama Pickles", searches: ["Nirupama Pickles", "Nirupama Foods Hyderabad"], url: "nirupamapickles.in", code: "NP", color: "#DC2626", youtube: "Nirupama Pickles" },
  { name: "Priya Pickles", searches: ["Priya Foods", "Priya Pickles Hyderabad"], url: "priyapickles.com", code: "PP", color: "#0891B2", youtube: "Priya Foods" },
  { name: "Ammas Homemade Pickles", searches: ["Ammas Pickles Hyderabad", "Amma's Homemade Pickles"], url: "ammashomemade.in", code: "AH", color: "#EA580C", youtube: "Ammas Pickles" },
  { name: "Sitara Pickles", searches: ["Sitara Pickles", "Sitara Foods Hyderabad"], url: "sitarapickles.com", code: "SP", color: "#65A30D", youtube: "Sitara Pickles" },
  { name: "Ruchulu Pickles", searches: ["Ruchulu Pickles", "Ruchulu Foods"], url: "ruchulupickles.com", code: "RP", color: "#9333EA", youtube: "Ruchulu Pickles" },
  { name: "Andhra Pickles", searches: ["Andhra Pickles", "Andhra Pickles online"], url: "andhrapickles.co", code: "AC", color: "#0369A1", youtube: "Andhra Pickles" },
  { name: "Hyderabad Pickles", searches: ["Hyderabad Pickles", "Hyderabad Pickles online"], url: "hyderabadpickles.in", code: "HP", color: "#B91C1C", youtube: "Hyderabad Pickles" }
];

// ═══════ SIMPLE SENTIMENT ANALYSIS ═══════
function analyzeSentiment(text) {
  if (!text) return 'neutral';
  const t = text.toLowerCase();
  const pos = ['amazing','excellent','great','love','best','fantastic','awesome','delicious','wonderful','perfect','fresh','tasty','recommend','good','happy','satisfied','quality','super','nice','yummy','favourite','favorite'];
  const neg = ['bad','worst','terrible','horrible','awful','disgusting','poor','waste','never','disappointed','stale','expired','rotten','avoid','refund','complaint','fraud','fake','unhygienic','dirty','pathetic','rubbish'];
  let score = 0;
  for (const w of pos) { if (t.includes(w)) score++; }
  for (const w of neg) { if (t.includes(w)) score--; }
  if (score >= 1) return 'positive';
  if (score <= -1) return 'negative';
  return 'neutral';
}

// ═══════ 1. GOOGLE PLACES — search + details + reviews ═══════
async function searchPlace(queries) {
  for (const query of queries) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results?.length > 0) {
        const p = data.results[0];
        return {
          place_id: p.place_id, name: p.name,
          address: p.formatted_address || '',
          rating: p.rating || 0, total_reviews: p.user_ratings_total || 0,
          lat: p.geometry?.location?.lat || 0, lng: p.geometry?.location?.lng || 0,
          business_status: p.business_status || 'OPERATIONAL',
          photo_ref: p.photos?.[0]?.photo_reference || null,
          matched_query: query
        };
      }
    } catch (e) { console.error(`[places] ${query}:`, e.message); }
  }
  // Fallback
  try {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(queries[0])}&inputtype=textquery&fields=place_id,name,formatted_address,rating,user_ratings_total,geometry,business_status,photos&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.candidates?.length > 0) {
      const p = data.candidates[0];
      return {
        place_id: p.place_id, name: p.name, address: p.formatted_address || '',
        rating: p.rating || 0, total_reviews: p.user_ratings_total || 0,
        lat: p.geometry?.location?.lat || 0, lng: p.geometry?.location?.lng || 0,
        business_status: p.business_status || 'OPERATIONAL',
        photo_ref: p.photos?.[0]?.photo_reference || null,
        matched_query: queries[0] + ' (fallback)'
      };
    }
  } catch (e) {}
  return null;
}

async function getPlaceDetails(placeId) {
  try {
    const fields = 'name,rating,user_ratings_total,formatted_phone_number,website,url,reviews,opening_hours,price_level,business_status';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.result) {
      const r = data.result;
      return {
        website: r.website || '', phone: r.formatted_phone_number || '',
        google_maps_url: r.url || '', price_level: r.price_level || 0,
        is_open: r.opening_hours?.open_now || false,
        reviews: (r.reviews || []).slice(0, 5).map(rv => ({
          author: rv.author_name,
          author_url: rv.author_url || null,
          profile_photo: rv.profile_photo_url || null,
          rating: rv.rating,
          text: rv.text?.substring(0, 500),
          time: rv.relative_time_description,
          relative_time: rv.time ? new Date(rv.time * 1000).toISOString() : null
        }))
      };
    }
  } catch (e) { console.error(`[details] ${placeId}:`, e.message); }
  return null;
}

// ═══════ 2. YOUTUBE — channel + videos + COMMENTS ═══════
async function getYouTubeData(searchQuery) {
  try {
    // Search for channel
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=channel&maxResults=1&key=${GOOGLE_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (searchData.error) { console.log(`[youtube] Error: ${searchData.error.message}`); return null; }
    if (!searchData.items?.length) return null;

    const channelId = searchData.items[0].snippet.channelId;
    const channelTitle = searchData.items[0].snippet.title;

    // Get channel stats
    const statsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${GOOGLE_KEY}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();
    if (!statsData.items?.length) return null;
    const stats = statsData.items[0].statistics;

    // Get ALL videos from channel (paginated)
    let allVideoItems = [];
    let vidNextPage = null;
    let vidPageCount = 0;
    const maxVidPages = 20; // 20 pages × 50 = 1000 videos max

    do {
      let videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=50&type=video&key=${GOOGLE_KEY}`;
      if (vidNextPage) videosUrl += `&pageToken=${vidNextPage}`;
      const videosRes = await fetch(videosUrl);
      const videosData = await videosRes.json();

      if (videosData.error) {
        console.log(`[youtube] Video list error: ${videosData.error.message}`);
        break;
      }

      if (videosData.items) allVideoItems.push(...videosData.items);
      vidNextPage = videosData.nextPageToken || null;
      vidPageCount++;
      console.log(`[youtube] Videos page ${vidPageCount}: +${videosData.items?.length || 0} (total: ${allVideoItems.length})`);
    } while (vidNextPage && vidPageCount < maxVidPages);

    let recentVideos = [];
    let allComments = [];

    if (allVideoItems.length) {
      // Get stats for videos in batches of 50
      const videoIds = allVideoItems.map(v => v.id.videoId).filter(Boolean);

      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50);
        const vStatsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${batch.join(',')}&key=${GOOGLE_KEY}`;
        const vStatsRes = await fetch(vStatsUrl);
        const vStatsData = await vStatsRes.json();

        const batchVideos = (vStatsData.items || []).map(v => ({
          id: v.id, title: v.snippet.title,
          published: v.snippet.publishedAt,
          views: parseInt(v.statistics.viewCount || 0),
          likes: parseInt(v.statistics.likeCount || 0),
          comments: parseInt(v.statistics.commentCount || 0),
          url: `https://youtube.com/watch?v=${v.id}`
        }));
        recentVideos.push(...batchVideos);
      }

      // ═══ PULL ALL COMMENTS from ALL videos (paginated) ═══
      for (const videoId of videoIds) {
          try {
            let nextPageToken = null;
            let pageCount = 0;
            const maxPages = 50; // safety limit: 50 pages × 100 = 5000 comments per video max

            do {
              let commUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&order=time&key=${GOOGLE_KEY}`;
              if (nextPageToken) commUrl += `&pageToken=${nextPageToken}`;

              const commRes = await fetch(commUrl);
              const commData = await commRes.json();

              if (commData.error) {
                console.log(`[yt-comments] ${videoId} error: ${commData.error.message}`);
                break;
              }

              if (commData.items) {
                for (const item of commData.items) {
                  const c = item.snippet.topLevelComment.snippet;
                  allComments.push({
                    author: c.authorDisplayName,
                    author_channel_url: c.authorChannelUrl || null,
                    author_channel_id: c.authorChannelId?.value || null,
                    author_profile_image: c.authorProfileImageUrl || null,
                    text: c.textDisplay?.substring(0, 500),
                    likes: c.likeCount || 0,
                    published: c.publishedAt,
                    video_id: videoId,
                    video_title: recentVideos.find(v => v.id === videoId)?.title || ''
                  });
                }
              }

              nextPageToken = commData.nextPageToken || null;
              pageCount++;
              console.log(`[yt-comments] ${videoId} page ${pageCount}: +${commData.items?.length || 0} comments (total: ${allComments.length})`);

            } while (nextPageToken && pageCount < maxPages);

          } catch (e) {
            console.log(`[yt-comments] ${videoId}: ${e.message}`);
          }
          // Small delay between videos to respect rate limits
          await new Promise(r => setTimeout(r, 200));
        }
    }

    return {
      channel_id: channelId, channel_title: channelTitle,
      channel_url: `https://youtube.com/channel/${channelId}`,
      subscribers: parseInt(stats.subscriberCount || 0),
      total_views: parseInt(stats.viewCount || 0),
      video_count: parseInt(stats.videoCount || 0),
      recent_videos: recentVideos,
      comments: allComments
    };
  } catch (e) {
    console.error(`[youtube] ${searchQuery}:`, e.message);
    return null;
  }
}

// ═══════ 3. WEBSITE META SCRAPING ═══════
async function scrapeWebsiteMeta(websiteUrl) {
  if (!websiteUrl) return null;
  try {
    const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeaSaltBot/1.0)' },
      redirect: 'follow', signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();

    const getMetaContent = (name) => {
      const patterns = [
        new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i')
      ];
      for (const p of patterns) { const m = html.match(p); if (m) return m[1]; }
      return null;
    };

    const socialPatterns = {
      instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi,
      facebook: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.]+/gi,
      youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|c\/|@)[a-zA-Z0-9_.-]+/gi,
      twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/gi,
      linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/gi
    };

    const socialLinks = {};
    for (const [platform, regex] of Object.entries(socialPatterns)) {
      const matches = html.match(regex);
      if (matches) socialLinks[platform] = [...new Set(matches)][0];
    }

    return {
      title: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null,
      description: getMetaContent('description') || getMetaContent('og:description') || null,
      social_links: socialLinks,
      has_ecommerce: /add.to.cart|buy.now|shop.now|price|₹|\$|cart/i.test(html),
      has_whatsapp: /wa\.me|whatsapp/i.test(html),
      has_blog: /\/blog|\/articles|\/news/i.test(html),
      tech_stack: detectTechStack(html)
    };
  } catch (e) {
    console.log(`[website] ${websiteUrl}: ${e.message}`);
    return null;
  }
}

function detectTechStack(html) {
  const stack = [];
  if (/shopify/i.test(html)) stack.push('Shopify');
  if (/woocommerce|wordpress|wp-content/i.test(html)) stack.push('WordPress');
  if (/squarespace/i.test(html)) stack.push('Squarespace');
  if (/wix\.com/i.test(html)) stack.push('Wix');
  if (/react|__next/i.test(html)) stack.push('React/Next.js');
  if (/razorpay/i.test(html)) stack.push('Razorpay');
  if (/stripe/i.test(html)) stack.push('Stripe');
  if (/gtm\.js|google.tag.manager/i.test(html)) stack.push('GTM');
  if (/google.analytics|gtag/i.test(html)) stack.push('Google Analytics');
  if (/fbq|facebook.pixel/i.test(html)) stack.push('Facebook Pixel');
  if (/hotjar/i.test(html)) stack.push('Hotjar');
  if (/tawk\.to/i.test(html)) stack.push('Tawk.to');
  if (/crisp\.chat/i.test(html)) stack.push('Crisp');
  if (/mailchimp/i.test(html)) stack.push('Mailchimp');
  if (/klaviyo/i.test(html)) stack.push('Klaviyo');
  if (/instamojo/i.test(html)) stack.push('Instamojo');
  if (/shiprocket/i.test(html)) stack.push('Shiprocket');
  return stack;
}

// ═══════ 4. AUTO-INSIGHTS ENGINE ═══════
function generateInsights(allResults) {
  const insights = [];
  const found = allResults.filter(r => r.found);
  if (!found.length) return insights;

  // Rating analysis
  const rated = found.filter(r => r.rating > 0).sort((a, b) => b.rating - a.rating);
  if (rated.length >= 2) {
    insights.push({
      type: 'threat', priority: 'high',
      title: `${rated[0].name} leads with ${rated[0].rating}★ (${rated[0].reviews} reviews)`,
      body: `Study their reviews to understand customer satisfaction drivers.`
    });
    const bottom = rated[rated.length - 1];
    insights.push({
      type: 'opportunity', priority: 'high',
      title: `${bottom.name} has lowest rating (${bottom.rating}★) — target their unhappy customers`,
      body: `${bottom.name} has ${bottom.reviews} reviews at ${bottom.rating}★. Their dissatisfied customers are your opportunity.`
    });
  }

  // Review volume
  const byReviews = [...found].sort((a, b) => b.reviews - a.reviews);
  if (byReviews[0]?.reviews > 500) {
    insights.push({
      type: 'trend', priority: 'medium',
      title: `${byReviews[0].name} dominates with ${byReviews[0].reviews} reviews`,
      body: `Massive social proof advantage. Launch a review generation campaign.`
    });
  }

  // YouTube
  const withYT = allResults.filter(r => r.youtube_data?.subscribers > 0).sort((a, b) => (b.youtube_data?.subscribers || 0) - (a.youtube_data?.subscribers || 0));
  if (withYT.length) {
    insights.push({
      type: 'trend', priority: 'high',
      title: `${withYT[0].name} leads YouTube: ${withYT[0].youtube_data.subscribers.toLocaleString()} subscribers`,
      body: `${withYT[0].youtube_data.video_count} videos, ${withYT[0].youtube_data.total_views.toLocaleString()} total views. Video is a key channel.`
    });
  }

  const noYT = allResults.filter(r => !r.youtube_data || r.youtube_data.subscribers === 0);
  if (noYT.length > 4) {
    insights.push({
      type: 'opportunity', priority: 'medium',
      title: `${noYT.length} competitors have weak/no YouTube`,
      body: `${noYT.map(r => r.name).slice(0, 3).join(', ')} and more. Video content is wide open.`
    });
  }

  // Engager insights
  const engagerCounts = allResults.map(r => ({ name: r.name, count: (r.engagers_saved || 0) })).sort((a, b) => b.count - a.count);
  const topEngaged = engagerCounts.find(e => e.count > 10);
  if (topEngaged) {
    insights.push({
      type: 'action', priority: 'critical',
      title: `${topEngaged.count} people engaging with ${topEngaged.name} captured`,
      body: `YouTube commenters and Google reviewers captured. These are active pickle buyers — prime targets for SeaSalt ads.`
    });
  }

  // E-commerce
  const withShop = allResults.filter(r => r.website_meta?.has_ecommerce);
  if (withShop.length) {
    insights.push({
      type: 'action', priority: 'medium',
      title: `${withShop.length} competitors sell online directly`,
      body: `${withShop.map(r => r.name).join(', ')}. Ensure SeaSalt's online store competes.`
    });
  }

  // Facebook Pixel
  const withPixel = allResults.filter(r => r.website_meta?.tech_stack?.includes('Facebook Pixel'));
  if (withPixel.length) {
    insights.push({
      type: 'action', priority: 'high',
      title: `${withPixel.length} competitors use Facebook Pixel retargeting`,
      body: `${withPixel.map(r => r.name).join(', ')} retarget website visitors with ads. Consider implementing the same.`
    });
  }

  // Negative review opportunity
  const negReviewComps = allResults.filter(r => r.negative_engagers > 0).sort((a, b) => b.negative_engagers - a.negative_engagers);
  if (negReviewComps.length) {
    insights.push({
      type: 'opportunity', priority: 'critical',
      title: `${negReviewComps[0].negative_engagers} negative reviews found for ${negReviewComps[0].name}`,
      body: `Unhappy customers are the easiest to convert. Target them with "switch to SeaSalt" messaging.`
    });
  }

  return insights;
}

// ═══════ 5. SUPABASE OPS ═══════
async function sbUpsert(table, data) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.text(); console.error(`[sb] ${table}:`, e); return { ok: false, error: e }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

  const params = event.queryStringParameters || {};

  // Diagnostic modes
  if (params.test) {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(params.test)}&key=${GOOGLE_KEY}`;
    const data = await (await fetch(url)).json();
    return { statusCode: 200, headers: H, body: JSON.stringify({ mode: 'places_test', query: params.test, status: data.status, results: data.results?.length || 0, first: data.results?.[0]?.name || null, key: GOOGLE_KEY ? GOOGLE_KEY.substring(0,8)+'...' : 'MISSING' }, null, 2) };
  }
  if (params.yttest) {
    const yt = await getYouTubeData(params.yttest);
    return { statusCode: 200, headers: H, body: JSON.stringify({ mode: 'youtube_test', result: yt }, null, 2) };
  }

  // Validate
  if (!GOOGLE_KEY) return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not set' }) };
  if (!SB_KEY) return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'SUPABASE_KEY not set' }) };
  if (!SB_URL) return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'SUPABASE_URL not set' }) };

  console.log(`\n[DEEP SYNC v4] ═══ Starting ${COMPETITORS.length} competitors ═══`);
  const startTime = Date.now();
  const allResults = [];
  let successCount = 0;
  let totalEngagers = 0;

  for (const comp of COMPETITORS) {
    console.log(`\n[${comp.code}] ─── ${comp.name} ───`);

    // 1. Google Places
    const placeData = await searchPlace(comp.searches);
    let detailData = null;
    if (placeData?.place_id) detailData = await getPlaceDetails(placeData.place_id);
    console.log(`[${comp.code}] Places: ${placeData ? `${placeData.rating}★ (${placeData.total_reviews})` : '✗'}`);

    // 2. YouTube (channel + videos + comments)
    const ytData = await getYouTubeData(comp.youtube || comp.name);
    console.log(`[${comp.code}] YouTube: ${ytData ? `${ytData.subscribers} subs, ${ytData.comments?.length || 0} comments` : '✗'}`);

    // 3. Website scrape
    const webMeta = await scrapeWebsiteMeta(detailData?.website || comp.url);
    console.log(`[${comp.code}] Website: ${webMeta ? `${webMeta.tech_stack?.join(',')||'basic'}` : '✗'}`);

    // ═══ SAVE ENGAGERS — Google Reviewers ═══
    let engagersSaved = 0;
    let negativeEngagers = 0;

    if (detailData?.reviews?.length) {
      for (const rev of detailData.reviews) {
        const sentiment = rev.rating >= 4 ? 'positive' : rev.rating <= 2 ? 'negative' : 'neutral';
        if (sentiment === 'negative') negativeEngagers++;
        const saved = await sbInsert('competitor_engagers', {
          person_name: rev.author,
          profile_url: rev.author_url || null,
          profile_photo: rev.profile_photo || null,
          platform: 'google_reviews',
          platform_user_id: rev.author_url || rev.author,
          competitor_name: comp.name,
          competitor_code: comp.code,
          engagement_type: 'review',
          content: rev.text,
          rating: rev.rating,
          sentiment: sentiment,
          content_url: detailData.google_maps_url || null,
          content_title: placeData?.name || comp.name,
          engaged_at: rev.relative_time || new Date().toISOString()
        });
        if (saved) engagersSaved++;
      }
    }

    // ═══ SAVE ENGAGERS — YouTube Commenters ═══
    if (ytData?.comments?.length) {
      for (const c of ytData.comments) {
        const sentiment = analyzeSentiment(c.text);
        if (sentiment === 'negative') negativeEngagers++;
        const saved = await sbInsert('competitor_engagers', {
          person_name: c.author,
          profile_url: c.author_channel_url || null,
          profile_photo: c.author_profile_image || null,
          platform: 'youtube',
          platform_user_id: c.author_channel_id || c.author,
          competitor_name: comp.name,
          competitor_code: comp.code,
          engagement_type: 'comment',
          content: c.text,
          sentiment: sentiment,
          likes: c.likes,
          content_url: `https://youtube.com/watch?v=${c.video_id}`,
          content_title: c.video_title,
          engaged_at: c.published
        });
        if (saved) engagersSaved++;
      }
    }

    totalEngagers += engagersSaved;
    console.log(`[${comp.code}] Engagers: ${engagersSaved} saved (${negativeEngagers} negative)`);

    // ═══ SAVE COMPETITOR PROFILE ═══
    const row = {
      name: comp.name, code: comp.code, color: comp.color, url: comp.url,
      search_query: comp.searches[0],
      place_id: placeData?.place_id || null,
      address: placeData?.address || null,
      rating: placeData?.rating || 0,
      total_reviews: placeData?.total_reviews || 0,
      lat: placeData?.lat || 0, lng: placeData?.lng || 0,
      business_status: placeData?.business_status || 'UNKNOWN',
      website: detailData?.website || comp.url || '',
      phone: detailData?.phone || '',
      google_maps_url: detailData?.google_maps_url || '',
      price_level: detailData?.price_level || 0,
      is_open: detailData?.is_open || false,
      recent_reviews: JSON.stringify(detailData?.reviews || []),
      photo_ref: placeData?.photo_ref || null,
      youtube_url: ytData?.channel_url || webMeta?.social_links?.youtube || '',
      youtube_subscribers: ytData?.subscribers || 0,
      instagram_url: webMeta?.social_links?.instagram || '',
      facebook_url: webMeta?.social_links?.facebook || '',
      social_score: calcSocialScore(placeData, ytData, webMeta),
      threat_level: calcThreatLevel(placeData, ytData, webMeta),
      notes: buildNotes(ytData, webMeta, engagersSaved),
      synced_at: new Date().toISOString()
    };

    const saveResult = await sbUpsert('competitor_profiles', row);
    if (saveResult.ok) successCount++;

    // Save YouTube videos as competitor_content
    if (ytData?.recent_videos?.length) {
      for (const vid of ytData.recent_videos) {
        await sbInsert('competitor_content', {
          competitor_name: comp.name, competitor_code: comp.code,
          platform: 'YouTube', post_type: 'Video', post_url: vid.url,
          caption: vid.title, likes: vid.likes, comments: vid.comments,
          engagement_rate: vid.views > 0 ? parseFloat(((vid.likes + vid.comments) / vid.views * 100).toFixed(2)) : 0,
          posted_at: vid.published, scraped_at: new Date().toISOString()
        });
      }
    }

    const result = {
      name: comp.name, code: comp.code,
      found: !!(placeData?.place_id),
      rating: placeData?.rating || 0,
      reviews: placeData?.total_reviews || 0,
      youtube_data: ytData ? { subscribers: ytData.subscribers, video_count: ytData.video_count, total_views: ytData.total_views, comments_pulled: ytData.comments?.length || 0 } : null,
      website_meta: webMeta ? { has_ecommerce: webMeta.has_ecommerce, tech_stack: webMeta.tech_stack, social_links: webMeta.social_links } : null,
      engagers_saved: engagersSaved,
      negative_engagers: negativeEngagers,
      saved: saveResult.ok,
      save_error: saveResult.error || null
    };

    allResults.push(result);
    await new Promise(r => setTimeout(r, 300));
  }

  // ═══ AUTO-INSIGHTS ═══
  console.log(`\n[DEEP SYNC v4] 🧠 Generating insights...`);
  const insights = generateInsights(allResults);
  let insightsSaved = 0;
  for (const ins of insights) {
    ins.source = 'auto-sync';
    ins.created_at = new Date().toISOString();
    if (await sbInsert('intel_insights', ins)) insightsSaved++;
  }

  // ═══ SYNC LOG ═══
  const duration = Date.now() - startTime;
  await sbInsert('intel_sync_log', {
    sync_type: 'deep_sync_v4',
    status: 'complete',
    competitors_synced: successCount,
    errors: JSON.stringify(allResults.filter(r => !r.saved).map(r => ({ name: r.name, error: r.save_error }))),
    duration_ms: duration,
    synced_at: new Date().toISOString()
  });

  console.log(`\n[DEEP SYNC v4] ═══ Done: ${successCount} saved, ${totalEngagers} engagers, ${insightsSaved} insights, ${duration}ms ═══`);

  return {
    statusCode: 200, headers: H,
    body: JSON.stringify({
      status: 'complete',
      version: 'deep_sync_v4',
      synced_at: new Date().toISOString(),
      duration_ms: duration,
      total: COMPETITORS.length,
      success: successCount,
      failed: COMPETITORS.length - successCount,
      total_engagers_captured: totalEngagers,
      insights_generated: insights.length,
      data_sources: ['Google Places API', 'Google Places Reviews', 'YouTube Data API', 'YouTube Comments API', 'Website Scraping', 'Sentiment Analysis', 'Auto-Insights Engine'],
      results: allResults
    }, null, 2)
  };
};

function calcSocialScore(place, yt, web) {
  let s = 0;
  if (place?.rating >= 4.5) s += 30; else if (place?.rating >= 4) s += 20; else if (place?.rating > 0) s += 10;
  if (place?.total_reviews >= 500) s += 20; else if (place?.total_reviews >= 100) s += 10;
  if (yt?.subscribers >= 10000) s += 25; else if (yt?.subscribers >= 1000) s += 15; else if (yt?.subscribers > 0) s += 5;
  if (web?.has_ecommerce) s += 10;
  if (web?.social_links?.instagram) s += 5;
  if (web?.social_links?.facebook) s += 5;
  if (web?.tech_stack?.includes('Facebook Pixel')) s += 5;
  return Math.min(s, 100);
}

function calcThreatLevel(place, yt, web) {
  const s = calcSocialScore(place, yt, web);
  if (s >= 70) return 'critical';
  if (s >= 50) return 'high';
  if (s >= 30) return 'medium';
  return 'low';
}

function buildNotes(yt, web, engagers) {
  const n = [];
  if (yt) n.push(`YT: ${yt.subscribers} subs, ${yt.video_count} vids, ${yt.total_views} views`);
  if (web?.tech_stack?.length) n.push(`Tech: ${web.tech_stack.join(', ')}`);
  if (web?.social_links) n.push(`Social: ${Object.keys(web.social_links).join(', ')}`);
  if (web?.has_ecommerce) n.push('Online store');
  if (web?.has_blog) n.push('Has blog');
  if (engagers) n.push(`${engagers} engagers captured`);
  return n.join(' | ') || null;
}
