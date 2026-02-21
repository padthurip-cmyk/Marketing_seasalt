// ═══════════════════════════════════════════════════════
// SeaSalt — Gemini AI Post Creator
// ═══════════════════════════════════════════════════════
// Endpoint: /.netlify/functions/gemini-ai
// Method: POST
// Body: { action, topic, platforms, tone, language, image, image_type }
// ═══════════════════════════════════════════════════════

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

export const handler = async (event) => {
  const H = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: H, body: JSON.stringify({ error: 'POST only' }) };
  if (!GEMINI_KEY) return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'GEMINI_API_KEY not set. Add it in Netlify Environment Variables.' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, topic, platforms, tone, language, image, image_type } = body;

    if (action === 'create_post') {
      const result = await createPost(topic, platforms, tone, language, image, image_type);
      return { statusCode: 200, headers: H, body: JSON.stringify(result) };
    }

    return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
  } catch (e) {
    console.error('[Gemini AI] Error:', e);
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: e.message }) };
  }
};

async function createPost(topic, platforms = ['instagram'], tone = 'promotional', language = 'english', image = null, image_type = null) {
  const platformStr = platforms.join(', ');
  
  const langGuide = {
    'english': 'Write in English only.',
    'telugu_english': 'Write in a natural mix of Telugu and English (Tenglish). Use Telugu script for some words and English for others, like how Hyderabad youth talk.',
    'hindi_english': 'Write in a natural mix of Hindi and English (Hinglish).',
    'telugu': 'Write entirely in Telugu script.'
  };

  const toneGuide = {
    'casual': 'Fun, friendly, like chatting with a friend. Use emojis liberally.',
    'professional': 'Polished and brand-worthy. Clean language, minimal emojis.',
    'promotional': 'Sales-focused but not pushy. Highlight benefits, create urgency.',
    'storytelling': 'Tell a story — the making process, a customer journey, heritage.',
    'educational': 'Teach something — pickle facts, health benefits, cooking tips.',
    'festive': 'Celebrate the season/festival. Warm, joyful, community-focused.'
  };

  const prompt = `You are a social media expert for "SeaSalt Pickles" — a premium homemade Andhra-style pickle brand from Hyderabad, India. We sell authentic avakaya, gongura, chicken pickle, prawn pickle, and more.

TASK: Create a social media post about: "${topic}"

TARGET PLATFORMS: ${platformStr}
TONE: ${toneGuide[tone] || 'Promotional'}
LANGUAGE: ${langGuide[language] || 'English'}

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no backticks):
{
  "caption": "The main post caption (150-300 words for Instagram, shorter for Twitter). Include emojis naturally.",
  "hashtags": "15-20 relevant hashtags including #SeaSaltPickles #AndhraPickles #HyderabadFood and topic-specific ones",
  "short_version": "A 1-2 line version for Stories/Reels/Twitter",
  "cta": "A clear call-to-action like 'Order now at seasaltpickles.com' or 'DM us to order'",
  "image_ideas": "2-3 image or video ideas that would work well with this post",
  "best_time": "Suggested posting time like '12:00 PM IST' or '6:00 PM IST'",
  "tone": "${tone}"
}`;

  // Build Gemini API request
  const parts = [];
  
  // Add image if provided
  if (image && image_type) {
    parts.push({
      inline_data: {
        mime_type: image_type,
        data: image
      }
    });
    parts.push({ text: "Analyze this image and use it as context for the post. Describe what you see and incorporate it naturally.\n\n" + prompt });
  } else {
    parts.push({ text: prompt });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
  
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048
      }
    })
  });

  const data = await res.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'Gemini API error');
  }

  // Gemini 2.5 Flash returns "thinking" parts - find the actual text
  let text = '';
  try {
    const parts = data.candidates[0].content.parts;
    for (let pi = 0; pi < parts.length; pi++) {
      if (parts[pi].text && !parts[pi].thought) { text = parts[pi].text; break; }
    }
    if (!text && parts.length > 0) text = parts[parts.length - 1].text || '';
  } catch(e) { text = ''; }
  console.log('[Gemini] Raw response:', text.substring(0, 200));

  // Parse JSON from response
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(clean);
    return parsed;
  } catch (e) {
    // If JSON parsing fails, structure the raw text
    return {
      caption: text.substring(0, 500),
      hashtags: '#SeaSaltPickles #AndhraPickles #HyderabadFood #HomemadePickles',
      short_version: text.substring(0, 100),
      cta: 'Order at seasaltpickles.com 🔱',
      image_ideas: 'Product flatlay, Behind-the-scenes making, Customer unboxing',
      tone: tone
    };
  }
}
