// ═══════════════════════════════════════════════════════════════
// SeaSalt Intelligence — Competitor Sync Function
// Fetches live data from Google Places API → stores in Supabase
// Endpoint: /.netlify/functions/intel-sync
// ═══════════════════════════════════════════════════════════════

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const SB_URL = process.env.SUPABASE_URL || 'https://yosjbsncvghpscsrvxds.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY || '';

const COMPETITORS = [
  { name: "Vellanki Foods", search: "Vellanki Foods pickles Hyderabad", url: "vellankifoods.com", code: "VF", color: "#C2410C" },
  { name: "Tulasi Pickles", search: "Tulasi Pickles Hyderabad", url: "tulasipickles.com", code: "TP", color: "#16A34A" },
  { name: "Aavarampoo Pickles", search: "Aavarampoo Pickles Hyderabad", url: "aavarampoo.com", code: "AP", color: "#7C3AED" },
  { name: "Nirupama Pickles", search: "Nirupama Pickles Hyderabad", url: "nirupamapickles.in", code: "NP", color: "#DC2626" },
  { name: "Priya Pickles", search: "Priya Pickles Hyderabad", url: "priyapickles.com", code: "PP", color: "#0891B2" },
  { name: "Ammas Homemade Pickles", search: "Ammas Homemade Pickles Hyderabad", url: "ammashomemade.in", code: "AH", color: "#EA580C" },
  { name: "Sitara Pickles", search: "Sitara Pickles Hyderabad", url: "sitarapickles.com", code: "SP", color: "#65A30D" },
  { name: "Ruchulu Pickles", search: "Ruchulu Pickles Hyderabad", url: "ruchulupickles.com", code: "RP", color: "#9333EA" },
  { name: "Andhra Pickles", search: "Andhra Pickles online Hyderabad", url: "andhrapickles.co", code: "AC", color: "#0369A1" },
  { name: "Hyderabad Pickles", search: "Hyderabad Pickles online", url: "hyderabadpickles.in", code: "HP", color: "#B91C1C" }
];

// ─── Google Places: Text Search ──────────────────────────────
async function searchPlace(query) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const place = data.results[0];
      return {
        place_id: place.place_id,
        name: place.name,
        address: place.formatted_address || '',
        rating: place.rating || 0,
        total_reviews: place.user_ratings_total || 0,
        lat: place.geometry?.location?.lat || 0,
        lng: place.geometry?.location?.lng || 0,
        business_status: place.business_status || 'UNKNOWN',
        types: place.types || [],
        photo_ref: place.photos?.[0]?.photo_reference || null
      };
    }
    return null;
  } catch (err) {
    console.error(`Google Places search failed for "${query}":`, err.message);
    return null;
  }
}

// ─── Google Places: Place Details ────────────────────────────
async function getPlaceDetails(placeId) {
  try {
    const fields = 'name,rating,user_ratings_total,formatted_phone_number,website,url,reviews,opening_hours,price_level,business_status';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.result) {
      const r = data.result;
      return {
        website: r.website || '',
        phone: r.formatted_phone_number || '',
        google_maps_url: r.url || '',
        price_level: r.price_level || 0,
        opening_hours: r.opening_hours?.weekday_text || [],
        is_open: r.opening_hours?.open_now || false,
        reviews: (r.reviews || []).slice(0, 5).map(rv => ({
          author: rv.author_name,
          rating: rv.rating,
          text: rv.text?.substring(0, 300),
          time: rv.relative_time_description,
          profile_photo: rv.profile_photo_url
        }))
      };
    }
    return null;
  } catch (err) {
    console.error(`Place details failed for ${placeId}:`, err.message);
    return null;
  }
}

// ─── Supabase: Upsert competitor data ────────────────────────
async function upsertToSupabase(competitor, placeData, detailData) {
  try {
    const row = {
      name: competitor.name,
      code: competitor.code,
      color: competitor.color,
      url: competitor.url,
      search_query: competitor.search,
      place_id: placeData?.place_id || null,
      address: placeData?.address || null,
      rating: placeData?.rating || 0,
      total_reviews: placeData?.total_reviews || 0,
      lat: placeData?.lat || 0,
      lng: placeData?.lng || 0,
      business_status: placeData?.business_status || 'UNKNOWN',
      website: detailData?.website || '',
      phone: detailData?.phone || '',
      google_maps_url: detailData?.google_maps_url || '',
      price_level: detailData?.price_level || 0,
      is_open: detailData?.is_open || false,
      recent_reviews: detailData?.reviews || [],
      photo_ref: placeData?.photo_ref || null,
      synced_at: new Date().toISOString()
    };

    const res = await fetch(`${SB_URL}/rest/v1/competitor_profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(row)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Supabase upsert failed for ${competitor.name}:`, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Supabase upsert error for ${competitor.name}:`, err.message);
    return false;
  }
}

// ─── Main Handler ────────────────────────────────────────────
export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Validate keys
  if (!GOOGLE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not set in environment variables' })
    };
  }
  if (!SB_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'SUPABASE_KEY not set in environment variables' })
    };
  }

  console.log(`[intel-sync] Starting sync for ${COMPETITORS.length} competitors...`);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const comp of COMPETITORS) {
    console.log(`[intel-sync] Syncing: ${comp.name}...`);

    // Step 1: Search for the place
    const placeData = await searchPlace(comp.search);

    let detailData = null;
    if (placeData?.place_id) {
      // Step 2: Get detailed info
      detailData = await getPlaceDetails(placeData.place_id);
    }

    // Step 3: Store in Supabase
    const saved = await upsertToSupabase(comp, placeData, detailData);

    const result = {
      name: comp.name,
      code: comp.code,
      found: !!placeData,
      rating: placeData?.rating || 0,
      reviews: placeData?.total_reviews || 0,
      saved: saved
    };

    results.push(result);
    if (saved) successCount++;
    else failCount++;

    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[intel-sync] Complete: ${successCount} saved, ${failCount} failed`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'complete',
      synced_at: new Date().toISOString(),
      total: COMPETITORS.length,
      success: successCount,
      failed: failCount,
      results: results
    })
  };
};
