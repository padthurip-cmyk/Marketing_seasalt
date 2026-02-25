// ═══════════════════════════════════════════════════════════════
// SCHEDULED-PROMO.MJS — Daily Promotion Post (Spin & Win)
// Runs: 8:00 AM IST (2:30 AM UTC) every day
// Posts: Promo image (5 products + spin wheel) + promo caption → FB & Instagram
// Change PROMO_THEMES to switch campaigns (e.g. festival sale, combo deal)
// ═══════════════════════════════════════════════════════════════
import { schedule } from "@netlify/functions";

var GK = process.env.GEMINI_API_KEY || '';
var PT = process.env.META_PAGE_TOKEN || '';
var PI = process.env.META_PAGE_ID || '';
var IG = process.env.INSTAGRAM_BUSINESS_ID || '';
var SU = process.env.SUPABASE_URL || '';
var SK = process.env.SUPABASE_KEY || '';
var G = 'https://graph.facebook.com/v25.0';
var W = 'https://static.wixstatic.com/media/';

function sH(p){var h={'Content-Type':'application/json',apikey:SK,Authorization:'Bearer '+SK};if(p)h.Prefer=p;return h}
async function dG(t,q){if(!SU)return[];return(await fetch(SU+'/rest/v1/'+t+'?'+q,{headers:sH()})).json()}
async function dA(t,r){if(!SU)return null;return(await fetch(SU+'/rest/v1/'+t,{method:'POST',headers:sH('return=representation'),body:JSON.stringify(r)})).json()}
function im(f,w,h){w=w||1080;h=h||1080;return W+f+'/v1/fill/w_'+w+',h_'+h+',al_c,q_85,enc_auto/'+f}

// ═══ CURRENT PROMOTION — Change this to switch campaigns ═══
var PROMO = {
  type: 'spinwheel',
  headline: 'Spin & Win Up to ₹599',
  subtext: 'First Order Offer! Visit our store, spin the wheel & get instant wallet cashback on Andhra pickles, masalas & sweets!',
  cta: '🎲 SPIN NOW — FREE!',
  badge: '🌿 NO PRESERVATIVES',
  link: 'seasaltpickles.com'
};

// ═══ ALL 35 PRODUCTS ═══
var PRODUCTS=[
{n:'Dry Fruit Laddu',p:350,d:'Wholesome energy-packed sweet with almonds, cashews, dates, pumpkin seeds.',c:'Sweets & Snacks',i:'163af4_e6a395f4ac2549f5a77ad25f2ec23b60~mv2.jpg'},
{n:'Turmeric Powder',p:125,d:'Pure sun-dried turmeric, rich in curcumin.',c:'Masalas & Karam Podis',i:'163af4_76e4b86c589c416fb6d30ecdf540fd66~mv2.jpg'},
{n:'Kura Karam',p:300,d:'Sun-dried red chillies finely ground.',c:'Masalas & Karam Podis',i:'163af4_a97d93f9ec1a4dfb95de4954b433d257~mv2.jpg'},
{n:'Mutton Kheema Pickle',p:1000,d:'Finely minced tender mutton in Andhra masala.',c:'Non Veg Pickles',i:'53b0e3_3be3a6d6eeb44946828b9b967a645931~mv2.jpg'},
{n:'Gongura Prawns',p:850,d:'Fresh succulent prawns with tangy gongura.',c:'Non Veg Pickles',i:'53b0e3_6a2ee4df6cfe45bfa571742350b0a551~mv2.png'},
{n:'Gongura Chicken Boneless',p:630,d:'Tender boneless chicken with gongura.',c:'Non Veg Pickles',i:'53b0e3_99a38423b54b4327828de1ef6b257a46~mv2.png'},
{n:'Flax Seeds Laddu',p:220,d:'Roasted flax seeds, sesame, jaggery, ghee.',c:'Sweets & Snacks',i:'163af4_9b4713713ca44be29f4b3cedd665d38c~mv2.jpg'},
{n:'Janthikalu',p:150,d:'Crispy golden spirals of rice flour.',c:'Sweets & Snacks',i:'163af4_a2137bc79ea74d20af5fd90b82f88e3b~mv2.jpg'},
{n:'Chekkalu - Sago',p:170,d:'Rice flour crackers with sago.',c:'Sweets & Snacks',i:'163af4_281785428c1a4f1ebb5821acf8cbd370~mv2.jpg'},
{n:'Chekkalu',p:150,d:'Peanut chekkalu with curry leaves.',c:'Sweets & Snacks',i:'163af4_ba68548805f943cb9e2e8f6fc31f57f3~mv2.jpg'},
{n:'Munagaaku Karam',p:80,d:'Drumstick leaves podi.',c:'Masalas & Karam Podis',i:'163af4_8e4278b579364734ba7ff3650898bcf8~mv2.jpg'},
{n:'Pudina Karam',p:80,d:'Mint leaf podi with garlic.',c:'Masalas & Karam Podis',i:'163af4_625bd2ee00b7403aa27e238f8f270290~mv2.jpg'},
{n:'Karivepaku Karam',p:80,d:'Curry leaf chutney powder.',c:'Masalas & Karam Podis',i:'163af4_1f3cc39a9ba543ed881feb8ae3a27ce0~mv2.jpg'},
{n:'Chicken + Coriander Combo',p:800,d:'500g Chicken + 500g Coriander Pickle.',c:'Combos',i:'163af4_7dc576230bc64852b4861a7bcb77015c~mv2.jpg'},
{n:'Avakaya + Tomato Combo',p:550,d:'500g Avakaya + 500g Tomato.',c:'Combos',i:'163af4_a5be29aba0f7461583b94fe4daa4f830~mv2.jpg'},
{n:'Kakarakaya Karam',p:80,d:'Sun-dried bitter gourd podi.',c:'Masalas & Karam Podis',i:'163af4_058b8624a4a0474e973d90b19e119a1a~mv2.jpg'},
{n:'Nalla Karam',p:80,d:'Roasted lentils, chillies, garlic, sesame.',c:'Masalas & Karam Podis',i:'163af4_b1dc36c9300848e8b343b93fb28488c3~mv2.jpg'},
{n:'Garam Masala',p:80,d:'Warm aromatic spice blend.',c:'Masalas & Karam Podis',i:'163af4_02d29cde3ae1441fb01b32dcde60046f~mv2.jpg'},
{n:'Pandu Mirchi Pachadi',p:300,d:'Fiery red chilli pickle.',c:'Vegetarian Pickles',i:'53b0e3_1383b71f1c1541f78e702c5364c59f09~mv2.jpg'},
{n:'Biryani Masala',p:200,d:'Whole spices slow-roasted and ground.',c:'Masalas & Karam Podis',i:'163af4_7f81a30887664bba8fc94f652c1dd5e1~mv2.jpg'},
{n:'Kara Podi',p:80,d:'Idli Podi — flavorful spice powder.',c:'Masalas & Karam Podis',i:'163af4_a2bfe3454c4e456cb2b6aedc429a3484~mv2.jpg'},
{n:'Chicken Pickle Boneless',p:630,d:'Finest boneless chicken in aromatic spices.',c:'Non Veg Pickles',i:'53b0e3_bd4b8d8643724c3dbbded34896cc40c4~mv2.jpg'},
{n:'Gongura Nilva Pachadi',p:330,d:'Tangy gongura leaves with spices.',c:'Vegetarian Pickles',i:'53b0e3_d3504025073140cab435c56935e0a2ef~mv2.jpg'},
{n:'Chicken Pickle with Bone',p:540,d:'Hand-picked chicken pieces, aromatic spices.',c:'Non Veg Pickles',i:'53b0e3_4a25ae4fca044360a5317828d4bf9dc3~mv2.jpg'},
{n:'Coriander Nilva Pachadi',p:330,d:'Fresh coriander leaves pickle.',c:'Vegetarian Pickles',i:'53b0e3_df7b35b3764a4fb0888e24e5e0e7facb~mv2.jpg'},
{n:'Dhaniyala Maagaya',p:330,d:'Tangy mangoes with coriander.',c:'Vegetarian Pickles',i:'53b0e3_44f8a3dc204f49c781d426335bf62ad8~mv2.jpg'},
{n:'Amla Patchadi',p:330,d:'Hand-picked amla with spices.',c:'Vegetarian Pickles',i:'163af4_23da098b073749529dca236bbdb68880~mv2.jpg'},
{n:'Ginger Pickle',p:330,d:'Fiery tangy ginger pickle.',c:'Vegetarian Pickles',i:'53b0e3_fd749ebdc8b345a0843acca96e7f6114~mv2.jpg'},
{n:'Avakaya',p:330,d:'Authentic homemade Avakaya.',c:'Vegetarian Pickles',i:'163af4_58038c71b77b4b8eae82c58c8e4f9b5c~mv2.jpg'},
{n:'Prawn Pickle',p:800,d:'Hand-picked prawns in aromatic spices.',c:'Non Veg Pickles',i:'53b0e3_52f7a2f8bf9b4e95975f93aa19b63c26~mv2.jpg'},
{n:'Tomato Pickle',p:300,d:'Green chilies and ripe tomatoes.',c:'Vegetarian Pickles',i:'53b0e3_315289d09db24d65a1b33ecab2a2a8e9~mv2.jpg'},
{n:'Mint Pickle',p:330,d:'Fresh mint leaves, aromatic spices.',c:'Vegetarian Pickles',i:'53b0e3_f21bc86babaf464dbf6d199bdaa3de15~mv2.jpg'},
{n:'Maagaya',p:330,d:'Authentic mango pickle.',c:'Vegetarian Pickles',i:'53b0e3_ad2fb569d13446b8a80e30ec17ec1c2d~mv2.jpg'},
{n:'Lemon Pickle',p:330,d:'Hand-picked lemons — tangy, spicy.',c:'Vegetarian Pickles',i:'163af4_4b0acd7a2e6048bd8f740d24f8f33a6a~mv2.jpg'},
{n:'Mixed Vegetable Avakaya',p:300,d:'Carrots, tindora, cauliflower, mango.',c:'Vegetarian Pickles',i:'53b0e3_cf6497e892ba4f1b9ecc11129f7b6325~mv2.jpg'}
];

// ═══ HELPERS ═══
async function callGemini(prompt){
  var r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+GK,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.85,maxOutputTokens:4096}})
  });
  var d=await r.json();
  if(d.error)throw new Error('Gemini: '+(d.error.message||'error'));
  var txt='';
  try{var parts=d.candidates[0].content.parts;for(var i=0;i<parts.length;i++){if(parts[i].text&&!parts[i].thought){txt=parts[i].text;break}}if(!txt&&parts.length>0)txt=parts[parts.length-1].text||''}catch(e){throw new Error('Gemini parse error')}
  return txt;
}

function parseAI(txt,pn){
  var c=txt.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
  if(c.indexOf('<think>')>=0)c=c.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
  var m=c.match(/\{[\s\S]*\}/);
  if(m){try{return JSON.parse(m[0])}catch(e){}}
  return {caption:c.substring(0,500),hashtags:'#SeaSaltPickles #SpinAndWin #AndhraPickles #FirstOrderOffer',cta:'🎲 Spin the wheel at seasaltpickles.com',content_type:'spinwheel_promo',product_featured:pn};
}

// ═══ PICK 5 DAILY PRODUCTS (date-seeded so different each day) ═══
function pickDaily5() {
  var now = new Date(new Date().getTime() + 5.5*60*60*1000);
  var seed = now.getFullYear()*10000 + (now.getMonth()+1)*100 + now.getDate() + 5555;
  var arr = PRODUCTS.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    var j = seed % (i + 1);
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr.slice(0, 5);
}

// ═══ GENERATE PROMO POST + PUBLISH ═══
async function genPromo() {
  if (!GK) throw new Error('GEMINI_API_KEY not set');

  var products = pickDaily5();
  var featured = products[0];
  // Use first product image as the post image (promo caption does the selling)
  var imageUrl = im(featured.i);

  var now = new Date(new Date().getTime()+5.5*60*60*1000);
  var ds = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var ms = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var productList = products.map(function(p){return p.n+' (₹'+p.p+')'}).join(', ');

  var prompt = 'You are social media manager for Sea Salt Pickles (@seasaltpickles) - premium homemade Andhra pickles, masalas & snacks from Hyderabad. Website: seasaltpickles.com\n\n';
  prompt += 'TODAY: ' + ds[now.getDay()] + ', ' + ms[now.getMonth()] + ' ' + now.getDate() + '\n';
  prompt += 'TIME: 8:00 AM IST — Morning promotion post!\n\n';
  prompt += '🎯 CURRENT PROMOTION: Spin & Win — First order offer!\n';
  prompt += 'Customers spin a wheel on our website for instant wallet cashback up to ₹599 on their first order.\n\n';
  prompt += 'TODAY\'S FEATURED PRODUCTS: ' + productList + '\n';
  prompt += 'HERO PRODUCT: ' + featured.n + ' (₹' + featured.p + ') — ' + featured.d + '\n\n';
  prompt += 'Create an engaging Instagram/Facebook PROMOTIONAL post that:\n';
  prompt += '1. Leads with the Spin & Win cashback offer (up to ₹599)\n';
  prompt += '2. Mentions 2-3 products naturally as examples\n';
  prompt += '3. Creates urgency (limited time, first order only)\n';
  prompt += '4. Caption 120-200 words, natural emojis, exciting but authentic tone\n';
  prompt += '5. Include 15-20 hashtags including #SeaSaltPickles #SpinAndWin #FirstOrderOffer #AndhraPickles\n';
  prompt += '6. CTA: "🎲 Spin the wheel at seasaltpickles.com — Free for first orders!"\n\n';
  prompt += 'RESPOND ONLY WITH JSON:\n{"caption":"...","hashtags":"#SeaSaltPickles #SpinAndWin ...","cta":"🎲 Spin the wheel at seasaltpickles.com","content_type":"spinwheel_promo","product_featured":"' + featured.n + '"}';

  var ai = await callGemini(prompt);
  var parsed = parseAI(ai, featured.n);
  var fullMsg = (parsed.caption || '') + '\n\n' + (parsed.hashtags || '');
  if (parsed.cta) fullMsg += '\n\n' + parsed.cta;

  var results = [], fbId = '', igId = '', postUrl = '';

  // Facebook
  if(PT&&PI){try{var fp=new URLSearchParams();fp.append('access_token',PT);fp.append('message',fullMsg);fp.append('url',imageUrl);var fr=await fetch(G+'/'+PI+'/photos',{method:'POST',body:fp});var fd=await fr.json();if(fd.id||fd.post_id){fbId=fd.id||fd.post_id;postUrl='https://facebook.com/'+fbId;results.push('Facebook: POSTED ✅')}else{results.push('Facebook: FAILED ❌ '+(fd.error&&fd.error.message?fd.error.message:''))}}catch(e){results.push('Facebook: ERROR ❌ '+e.message)}}

  // Instagram
  if(PT&&IG&&imageUrl){try{var ip=new URLSearchParams();ip.append('access_token',PT);ip.append('image_url',imageUrl);ip.append('caption',fullMsg);var ir=await fetch(G+'/'+IG+'/media',{method:'POST',body:ip});var ic=await ir.json();if(ic.id){for(var w=0;w<15;w++){await new Promise(function(r){setTimeout(r,2000)});var sr=await fetch(G+'/'+ic.id+'?fields=status_code&access_token='+PT);var sd=await sr.json();if(sd.status_code==='FINISHED'||sd.status_code==='ERROR')break}var pp=new URLSearchParams();pp.append('access_token',PT);pp.append('creation_id',ic.id);var pr=await fetch(G+'/'+IG+'/media_publish',{method:'POST',body:pp});var pd=await pr.json();if(pd.id){igId=pd.id;results.push('Instagram: POSTED ✅')}else{results.push('Instagram: PUBLISH FAILED ❌ '+(pd.error&&pd.error.message?pd.error.message:''))}}else{results.push('Instagram: CONTAINER FAILED ❌ '+(ic.error&&ic.error.message?ic.error.message:''))}}catch(e){results.push('Instagram: ERROR ❌ '+e.message)}}

  // Save to Supabase
  try{await dA('social_posts',{caption:parsed.caption,hashtags:parsed.hashtags,platforms:[fbId?'facebook':'',igId?'instagram':''].filter(Boolean),status:'published',published_at:new Date().toISOString(),ai_generated:true,tone:'spinwheel_promo',cta:parsed.cta,image_url:imageUrl,fb_post_id:fbId,ig_media_id:igId,post_url:postUrl,product_featured:featured.n})}catch(e){}

  console.log('[Scheduled-Promo] 8AM IST — Products: '+productList+' | Results: '+results.join(', '));
  return {success:!!(fbId||igId),post:parsed,image_url:imageUrl,products:products.map(function(p){return p.n}),results:results};
}

// ═══ SCHEDULED HANDLER — 8:00 AM IST (2:30 AM UTC) ═══
var handler = schedule("30 2 * * *", async (event) => {
  console.log('[Scheduled-Promo] Triggered at', new Date().toISOString(), '(8 AM IST)');
  try {
    var result = await genPromo();
    console.log('[Scheduled-Promo] Done:', JSON.stringify(result.results));
    return { statusCode: 200 };
  } catch(e) {
    console.error('[Scheduled-Promo] Error:', e.message);
    return { statusCode: 500 };
  }
});

export { handler };
