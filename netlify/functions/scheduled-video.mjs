// ═══════════════════════════════════════════════════════════════
// SCHEDULED-VIDEO.MJS — Daily Animated Video Ad for YouTube
// Runs: 8:00 AM IST (2:30 AM UTC) every day
// Generates: Animated HTML page (1080x1920 vertical) with spin wheel
// Access preview: /.netlify/functions/scheduled-video?preview=true
// ═══════════════════════════════════════════════════════════════
// HTTP-only function (no schedule — video is on-demand preview)

var SU = process.env.SUPABASE_URL || '';
var SK = process.env.SUPABASE_KEY || '';
var W = 'https://static.wixstatic.com/media/';

function sH(p){var h={'Content-Type':'application/json',apikey:SK,Authorization:'Bearer '+SK};if(p)h.Prefer=p;return h}
async function dA(t,r){if(!SU)return null;return(await fetch(SU+'/rest/v1/'+t,{method:'POST',headers:sH('return=representation'),body:JSON.stringify(r)})).json()}
function im(f,w,h){return W+f+'/v1/fill/w_'+w+',h_'+h+',al_c,q_85,enc_auto/'+f}

// ═══ PRODUCTS (top sellers for video) ═══
var PRODUCTS=[
{n:'Chicken Pickle',p:630,i:'53b0e3_4a25ae4fca044360a5317828d4bf9dc3~mv2.jpg'},
{n:'Avakaya Pickle',p:330,i:'163af4_58038c71b77b4b8eae82c58c8e4f9b5c~mv2.jpg'},
{n:'Mutton Kheema',p:1000,i:'53b0e3_3be3a6d6eeb44946828b9b967a645931~mv2.jpg'},
{n:'Gongura Chicken',p:630,i:'53b0e3_99a38423b54b4327828de1ef6b257a46~mv2.png'},
{n:'Prawn Pickle',p:800,i:'53b0e3_52f7a2f8bf9b4e95975f93aa19b63c26~mv2.jpg'},
{n:'Chicken Boneless',p:630,i:'53b0e3_bd4b8d8643724c3dbbded34896cc40c4~mv2.jpg'},
{n:'Gongura Prawns',p:850,i:'53b0e3_6a2ee4df6cfe45bfa571742350b0a551~mv2.png'},
{n:'Tomato Pickle',p:300,i:'53b0e3_315289d09db24d65a1b33ecab2a2a8e9~mv2.jpg'},
{n:'Biryani Masala',p:200,i:'163af4_7f81a30887664bba8fc94f652c1dd5e1~mv2.jpg'},
{n:'Dry Fruit Laddu',p:350,i:'163af4_e6a395f4ac2549f5a77ad25f2ec23b60~mv2.jpg'},
{n:'Flax Seeds Laddu',p:220,i:'163af4_9b4713713ca44be29f4b3cedd665d38c~mv2.jpg'},
{n:'Lemon Pickle',p:330,i:'163af4_4b0acd7a2e6048bd8f740d24f8f33a6a~mv2.jpg'},
{n:'Gongura Pachadi',p:330,i:'53b0e3_d3504025073140cab435c56935e0a2ef~mv2.jpg'},
{n:'Kura Karam',p:300,i:'163af4_a97d93f9ec1a4dfb95de4954b433d257~mv2.jpg'},
{n:'Turmeric Powder',p:125,i:'163af4_76e4b86c589c416fb6d30ecdf540fd66~mv2.jpg'}
];

function pickDaily5() {
  var now = new Date(new Date().getTime() + 5.5*60*60*1000);
  var seed = now.getFullYear()*10000 + (now.getMonth()+1)*100 + now.getDate() + 9999;
  var arr = PRODUCTS.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    var j = seed % (i + 1);
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr.slice(0, 5);
}

// ═══ GENERATE ANIMATED HTML AD (1080x1920 vertical for YouTube Shorts) ═══
function buildHTML(prods) {
  var p = prods;
  var cards = '';
  for (var i = 0; i < 5; i++) {
    cards += '<div class="pc" style="animation-delay:'+(1.0+i*0.2)+'s">' +
      '<div class="pw"><img src="'+im(p[i].i,300,250)+'" alt="'+p[i].n+'"></div>' +
      '<div class="pn">'+p[i].n+'</div><div class="pp">₹'+p[i].p+'</div></div>';
  }

  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
  '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">' +
  '<style>' +
  '*{margin:0;padding:0;box-sizing:border-box}' +
  'body{width:1080px;height:1920px;font-family:Poppins,sans-serif;' +
  'background:linear-gradient(165deg,#1a0a05 0%,#6b1d0b 18%,#b83a14 40%,#e55b1f 62%,#f59538 92%);overflow:hidden;position:relative}' +

  // Noise overlay
  'body::before{content:"";position:absolute;inset:0;' +
  'background:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.03\'/%3E%3C/svg%3E");' +
  'pointer-events:none;z-index:1}' +

  // Animations
  '@keyframes fadeDown{from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:translateY(0)}}' +
  '@keyframes popIn{0%{opacity:0;transform:scale(.4) translateY(20px)}60%{opacity:1;transform:scale(1.08) translateY(-4px)}100%{opacity:1;transform:scale(1) translateY(0)}}' +
  '@keyframes fadeUp{from{opacity:0;transform:translateY(50px)}to{opacity:1;transform:translateY(0)}}' +
  '@keyframes fadeIn{from{opacity:0}to{opacity:1}}' +
  '@keyframes slideL{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:translateX(0)}}' +
  '@keyframes spinW{0%{transform:rotate(0)}100%{transform:rotate(1440deg)}}' +
  '@keyframes glow{0%,100%{box-shadow:0 0 25px rgba(255,215,0,.2)}50%{box-shadow:0 0 50px rgba(255,215,0,.6)}}' +
  '@keyframes priceIn{0%{opacity:0;transform:scale(.3)}50%{transform:scale(1.2)}100%{opacity:1;transform:scale(1)}}' +
  '@keyframes badgePop{0%{opacity:0;transform:scale(.5)}60%{transform:scale(1.1)}100%{opacity:1;transform:scale(1)}}' +

  // Header
  '.hdr{text-align:center;padding:55px 40px 15px;animation:fadeDown .8s ease-out .2s both;position:relative;z-index:2}' +
  '.logo{width:70px;height:70px;background:linear-gradient(135deg,#e05a1a,#c44012);border-radius:16px;' +
  'display:inline-flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px;box-shadow:0 4px 20px rgba(0,0,0,.3)}' +
  '.bn{color:#fff;font-size:40px;font-weight:900;letter-spacing:.5px}' +
  '.bs{color:rgba(255,255,255,.7);font-size:16px;margin-top:2px}' +
  '.badge{display:inline-block;background:rgba(255,255,255,.95);padding:9px 24px;border-radius:24px;' +
  'font-size:14px;font-weight:700;color:#333;margin-top:14px;animation:badgePop .5s ease-out .8s both}' +

  // Products
  '.prow{display:flex;justify-content:center;gap:14px;padding:25px 30px;position:relative;z-index:2}' +
  '.pc{text-align:center;flex:1;max-width:185px;animation:popIn .6s ease-out both}' +
  '.pw{width:155px;height:130px;margin:0 auto;border-radius:14px;overflow:hidden;' +
  'background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.12)}' +
  '.pw img{width:100%;height:100%;object-fit:cover;display:block}' +
  '.pn{color:#fff;font-size:14px;font-weight:600;margin:8px 0 2px}' +
  '.pp{font-weight:800;font-size:19px;background:linear-gradient(135deg,#ffd700,#ffb300);' +
  '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}' +

  // Promo card
  '.promo{background:linear-gradient(145deg,rgba(180,50,10,.95),rgba(230,85,28,.88),rgba(245,120,40,.85));' +
  'margin:15px 35px;border-radius:28px;padding:40px;display:flex;align-items:center;gap:30px;' +
  'min-height:430px;animation:fadeIn .6s ease-out 2.2s both;position:relative;z-index:2;' +
  'border:1.5px solid rgba(255,255,255,.08);box-shadow:0 15px 50px rgba(0,0,0,.25)}' +
  '.pl{flex:1}' +
  '.otag{display:inline-block;background:rgba(255,255,255,.15);padding:8px 20px;border-radius:10px;' +
  'color:#ffd700;font-size:16px;font-weight:700;letter-spacing:1px;margin-bottom:16px;animation:slideL .5s ease-out 2.5s both}' +
  '.hl{font-family:"Playfair Display",serif;color:#fff;font-size:60px;font-weight:900;line-height:1.08;animation:slideL .6s ease-out 2.8s both}' +
  '.hl .g{color:#ffd700;font-style:italic}' +
  '.hl .bp{font-family:Poppins,sans-serif;font-size:80px;font-weight:900;color:#ffd700;' +
  'text-shadow:0 2px 20px rgba(255,215,0,.4);animation:priceIn .6s ease-out 3s both;display:inline-block}' +
  '.stxt{color:rgba(255,255,255,.85);font-size:18px;line-height:1.5;margin-top:10px;animation:fadeIn .5s ease-out 3.2s both}' +
  '.stxt strong{color:#ffd700}' +

  // Wheel
  '.pr{flex-shrink:0;width:270px;height:270px;position:relative;animation:popIn .8s ease-out 3.4s both}' +
  '.wg{position:absolute;inset:-20px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,50,.15),transparent 70%)}' +
  '.wr{transform-origin:140px 140px;animation:spinW 2.8s cubic-bezier(.15,.7,.1,1) 3.8s both}' +

  // CTA
  '.cta{display:flex;justify-content:space-between;align-items:center;padding:25px 45px 45px;animation:fadeUp .5s ease-out 7s both;position:relative;z-index:2}' +
  '.cbtn{background:linear-gradient(135deg,#1a1a1a,#2a2a2a);padding:18px 42px;border-radius:16px;' +
  'border:1.5px solid rgba(255,215,0,.2);animation:glow 2.5s ease-in-out 7.5s infinite}' +
  '.cbtn span{font-weight:800;font-size:23px;color:#ffd700}' +
  '.si{text-align:right}.si .u{font-weight:700;font-size:21px;color:#fff}.si .s{color:rgba(255,255,255,.55);font-size:14px;margin-top:2px}' +
  '</style></head><body>' +

  // Header
  '<div class="hdr"><div class="logo">🏺</div>' +
  '<div class="bn">SeaSalt Pickles</div>' +
  '<div class="bs">Authentic Andhra Homemade Pickles</div>' +
  '<div class="badge">🌿 NO PRESERVATIVES</div></div>' +

  // Products
  '<div class="prow">' + cards + '</div>' +

  // Promo
  '<div class="promo"><div class="pl">' +
  '<div class="otag">🏆 FIRST ORDER OFFER</div>' +
  '<div class="hl">Spin <span class="g">&amp;</span> Win<br>Up to <span class="bp">₹599</span></div>' +
  '<div class="stxt">on your pickle order!<br>Visit our store, spin the wheel &amp; get<br><strong>instant wallet cashback</strong>!</div>' +
  '</div>' +

  // Wheel
  '<div class="pr"><div class="wg"></div>' +
  '<svg style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);z-index:5" width="28" height="24" viewBox="0 0 28 24">' +
  '<polygon points="14,0 2,24 26,24" fill="#FFD700" stroke="#8B6914" stroke-width="1.5"/></svg>' +
  '<svg viewBox="0 0 280 280" width="270" height="270" style="margin-top:12px">' +
  '<g class="wr">' +
  '<circle cx="140" cy="140" r="136" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="2.5"/>' +
  '<path d="M140,140 L140,4 A136,136 0 0,1 236,43 Z" fill="#C62828" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M140,140 L236,43 A136,136 0 0,1 276,140 Z" fill="#2E7D32" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M140,140 L276,140 A136,136 0 0,1 236,237 Z" fill="#F57F17" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M140,140 L236,237 A136,136 0 0,1 140,276 Z" fill="#6A1B9A" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M140,140 L140,276 A136,136 0 0,1 44,237 Z" fill="#C62828" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M140,140 L44,237 A136,136 0 0,1 4,140 Z" fill="#2E7D32" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M140,140 L4,140 A136,136 0 0,1 44,43 Z" fill="#F57F17" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M140,140 L44,43 A136,136 0 0,1 140,4 Z" fill="#6A1B9A" stroke="#fff" stroke-width="1.5"/>' +
  // Labels
  '<text x="185" y="65" fill="#fff" font-family="Poppins" font-size="15" font-weight="800" text-anchor="middle" transform="rotate(-67.5,185,65)">₹199</text>' +
  '<text x="230" y="120" fill="#fff" font-family="Poppins" font-size="15" font-weight="800" text-anchor="middle" transform="rotate(-22.5,230,120)">₹99</text>' +
  '<text x="230" y="195" fill="#fff" font-family="Poppins" font-size="15" font-weight="800" text-anchor="middle" transform="rotate(22.5,230,195)">₹399</text>' +
  '<text x="185" y="240" fill="#fff" font-family="Poppins" font-size="15" font-weight="800" text-anchor="middle" transform="rotate(67.5,185,240)">₹599</text>' +
  '<text x="95" y="240" fill="#fff" font-family="Poppins" font-size="15" font-weight="800" text-anchor="middle" transform="rotate(112.5,95,240)">₹499</text>' +
  '<text x="50" y="195" fill="#fff" font-family="Poppins" font-size="15" font-weight="800" text-anchor="middle" transform="rotate(157.5,50,195)">₹299</text>' +
  '<text x="50" y="120" fill="#fff" font-family="Poppins" font-size="15" font-weight="800" text-anchor="middle" transform="rotate(202.5,50,120)">₹199</text>' +
  '<text x="95" y="65" fill="#fff" font-family="Poppins" font-size="15" font-weight="800" text-anchor="middle" transform="rotate(247.5,95,65)">₹99</text>' +
  // Center
  '<circle cx="140" cy="140" r="26" fill="#fff" stroke="#ccc" stroke-width="2"/>' +
  '<rect x="128" y="128" width="24" height="24" rx="5" fill="#e05a1a"/>' +
  '<rect x="131" y="131" width="18" height="4" rx="1" fill="#fff" opacity=".85"/>' +
  '<rect x="131" y="137" width="18" height="10" rx="2" fill="#fff" opacity=".85"/>' +
  '</g></svg></div></div>' +

  // CTA
  '<div class="cta"><div class="cbtn"><span>🎲 SPIN NOW — FREE!</span></div>' +
  '<div class="si"><div class="u">seasaltpickles.com</div><div class="s">Ships All India 🇮🇳</div></div></div>' +

  '</body></html>';
}

// ═══ HTTP HANDLER — preview at ?preview=true ═══
export async function handler(event) {
  var params = event.queryStringParameters || {};

  if (params.preview === 'true') {
    var prods = pickDaily5();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: buildHTML(prods)
    };
  }

  // Manual trigger — generate and save
  var prods = pickDaily5();
  var html = buildHTML(prods);

  try {
    await dA('video_ads', {
      html_content: html,
      products_featured: prods.map(function(p){return p.n}).join(', '),
      promo_type: 'spinwheel',
      format: '1080x1920',
      duration_seconds: 10,
      created_at: new Date().toISOString(),
      status: 'generated'
    });
  } catch(e) {
    console.log('[Video] Supabase save skipped: ' + e.message);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, products: prods.map(function(p){return p.n}) })
  };
}
