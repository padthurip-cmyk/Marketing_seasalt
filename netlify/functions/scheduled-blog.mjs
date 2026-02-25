// Scheduled Blog Post — Runs daily at 7:00 PM IST (1:30 PM UTC)
// Generates SEO blog via Gemini and publishes to Supabase blog_posts table
import { schedule } from "@netlify/functions";

var GK = process.env.GEMINI_API_KEY || '';
var SU = process.env.SUPABASE_URL || '';
var SK = process.env.SUPABASE_KEY || '';
var SITE = process.env.URL || 'https://seasaltpickles.com';
var W = 'https://static.wixstatic.com/media/';

function sH(p){var h={'Content-Type':'application/json',apikey:SK,Authorization:'Bearer '+SK};if(p)h.Prefer=p;return h}
async function dG(t,q){if(!SU)return[];return(await fetch(SU+'/rest/v1/'+t+'?'+q,{headers:sH()})).json()}
async function dA(t,r){if(!SU)return null;return(await fetch(SU+'/rest/v1/'+t,{method:'POST',headers:sH('return=representation'),body:JSON.stringify(r)})).json()}
function im(f){return W+f+'/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/'+f}

// ═══ ALL 35 PRODUCTS ═══
var PRODUCTS=[
{n:'Dry Fruit Laddu',p:350,d:'Wholesome energy-packed sweet with almonds, cashews, dates, pumpkin seeds.',c:'Sweets & Snacks',i:'163af4_e6a395f4ac2549f5a77ad25f2ec23b60~mv2.jpg',s:'dry-fruit-laddu'},
{n:'Turmeric Powder',p:125,d:'Pure sun-dried turmeric, rich in curcumin. Golden hue, warm flavor.',c:'Masalas & Karam Podis',i:'163af4_76e4b86c589c416fb6d30ecdf540fd66~mv2.jpg',s:'turmeric-powder'},
{n:'Kura Karam',p:300,d:'Sun-dried red chillies finely ground. Bold flavor, vibrant color.',c:'Masalas & Karam Podis',i:'163af4_a97d93f9ec1a4dfb95de4954b433d257~mv2.jpg',s:'kura-karam'},
{n:'Mutton Kheema Pickle',p:1000,d:'Finely minced tender mutton slow-cooked in Andhra masala.',c:'Non Veg Pickles',i:'53b0e3_3be3a6d6eeb44946828b9b967a645931~mv2.jpg',s:'mutton-kheema-pickle'},
{n:'Gongura Prawns',p:850,d:'Fresh succulent prawns with tangy gongura leaves.',c:'Non Veg Pickles',i:'53b0e3_6a2ee4df6cfe45bfa571742350b0a551~mv2.png',s:'gongura-prawns'},
{n:'Gongura Chicken Boneless',p:630,d:'Tender boneless chicken with gongura, traditional spices.',c:'Non Veg Pickles',i:'53b0e3_99a38423b54b4327828de1ef6b257a46~mv2.png',s:'gongura-chicken-boneless'},
{n:'Flax Seeds Laddu',p:220,d:'Roasted flax seeds, sesame, jaggery, ghee. Rich in omega-3.',c:'Sweets & Snacks',i:'163af4_9b4713713ca44be29f4b3cedd665d38c~mv2.jpg',s:'flax-seeds-laddu'},
{n:'Janthikalu',p:150,d:'Crispy golden spirals of rice flour, gram flour, butter, spices.',c:'Sweets & Snacks',i:'163af4_a2137bc79ea74d20af5fd90b82f88e3b~mv2.jpg',s:'janthikalu'},
{n:'Chekkalu - Sago',p:170,d:'Rice flour crackers with sago, green chilli masala.',c:'Sweets & Snacks',i:'163af4_281785428c1a4f1ebb5821acf8cbd370~mv2.jpg',s:'chekkalu-sago'},
{n:'Chekkalu',p:150,d:'Peanut chekkalu with curry leaves, just the right spice.',c:'Sweets & Snacks',i:'163af4_ba68548805f943cb9e2e8f6fc31f57f3~mv2.jpg',s:'chekkalu'},
{n:'Munagaaku Karam',p:80,d:'Drumstick leaves podi with roasted lentils, chillies.',c:'Masalas & Karam Podis',i:'163af4_8e4278b579364734ba7ff3650898bcf8~mv2.jpg',s:'munagaaku-karam'},
{n:'Pudina Karam',p:80,d:'Mint leaf podi with roasted lentils, garlic.',c:'Masalas & Karam Podis',i:'163af4_625bd2ee00b7403aa27e238f8f270290~mv2.jpg',s:'pudina-karam'},
{n:'Karivepaku Karam',p:80,d:'Curry leaf chutney powder with lentils, garlic.',c:'Masalas & Karam Podis',i:'163af4_1f3cc39a9ba543ed881feb8ae3a27ce0~mv2.jpg',s:'karivepaku-karam'},
{n:'Chicken + Coriander Combo',p:800,d:'500g Chicken Bone Pickle + 500g Coriander Pickle.',c:'Combos',i:'163af4_7dc576230bc64852b4861a7bcb77015c~mv2.jpg',s:'chicken-coriander'},
{n:'Avakaya + Tomato Combo',p:550,d:'500g Avakaya + 500g Tomato. Perfect veg pickle duo.',c:'Combos',i:'163af4_a5be29aba0f7461583b94fe4daa4f830~mv2.jpg',s:'avakaya-tomato'},
{n:'Kakarakaya Karam',p:80,d:'Sun-dried bitter gourd podi with lentils.',c:'Masalas & Karam Podis',i:'163af4_058b8624a4a0474e973d90b19e119a1a~mv2.jpg',s:'kakarakaya-karam'},
{n:'Nalla Karam',p:80,d:'Roasted lentils, dry red chillies, garlic, sesame seeds.',c:'Masalas & Karam Podis',i:'163af4_b1dc36c9300848e8b343b93fb28488c3~mv2.jpg',s:'nalla-karam'},
{n:'Garam Masala',p:80,d:'Warm aromatic spice blend — cumin, coriander, cardamom.',c:'Masalas & Karam Podis',i:'163af4_02d29cde3ae1441fb01b32dcde60046f~mv2.jpg',s:'garam-masala'},
{n:'Pandu Mirchi Pachadi',p:300,d:'Fiery red chilli pickle — traditional Andhra condiment.',c:'Vegetarian Pickles',i:'53b0e3_1383b71f1c1541f78e702c5364c59f09~mv2.jpg',s:'pandu-mirchi-pachadi'},
{n:'Biryani Masala',p:200,d:'Black Biryani Masala — whole spices slow-roasted and ground.',c:'Masalas & Karam Podis',i:'163af4_7f81a30887664bba8fc94f652c1dd5e1~mv2.jpg',s:'biryani-masala'},
{n:'Kara Podi',p:80,d:'Idli Podi / Karam Podi — flavorful spice powder.',c:'Masalas & Karam Podis',i:'163af4_a2bfe3454c4e456cb2b6aedc429a3484~mv2.jpg',s:'kara-podi'},
{n:'Chicken Pickle Boneless',p:630,d:'Finest boneless chicken marinated in aromatic spices.',c:'Non Veg Pickles',i:'53b0e3_bd4b8d8643724c3dbbded34896cc40c4~mv2.jpg',s:'chicken-pickle-boneless'},
{n:'Gongura Nilva Pachadi',p:330,d:'Tangy gongura leaves with aromatic spices.',c:'Vegetarian Pickles',i:'53b0e3_d3504025073140cab435c56935e0a2ef~mv2.jpg',s:'gongura-nilva-pachadi'},
{n:'Chicken Pickle with Bone',p:540,d:'Hand-picked chicken pieces, aromatic spices.',c:'Non Veg Pickles',i:'53b0e3_4a25ae4fca044360a5317828d4bf9dc3~mv2.jpg',s:'chicken-pickle-bone'},
{n:'Coriander Nilva Pachadi',p:330,d:'Fresh coriander leaves pickle — refreshing, tangy.',c:'Vegetarian Pickles',i:'53b0e3_df7b35b3764a4fb0888e24e5e0e7facb~mv2.jpg',s:'coriander-nilva-pachadi'},
{n:'Dhaniyala Maagaya',p:330,d:'Tangy mangoes with aromatic coriander.',c:'Vegetarian Pickles',i:'53b0e3_44f8a3dc204f49c781d426335bf62ad8~mv2.jpg',s:'dhaniyala-maagaya'},
{n:'Amla Patchadi',p:330,d:'Hand-picked amla fruits with aromatic spices.',c:'Vegetarian Pickles',i:'163af4_23da098b073749529dca236bbdb68880~mv2.jpg',s:'amla-patchadi'},
{n:'Ginger Pickle',p:330,d:'Fiery tangy ginger pickle — hand-picked ginger roots.',c:'Vegetarian Pickles',i:'53b0e3_fd749ebdc8b345a0843acca96e7f6114~mv2.jpg',s:'ginger-pickle'},
{n:'Avakaya',p:330,d:'Authentic homemade Avakaya — hand-picked mangoes, herbs.',c:'Vegetarian Pickles',i:'163af4_58038c71b77b4b8eae82c58c8e4f9b5c~mv2.jpg',s:'avakaya'},
{n:'Prawn Pickle',p:800,d:'Hand-picked prawns marinated in aromatic spices.',c:'Non Veg Pickles',i:'53b0e3_52f7a2f8bf9b4e95975f93aa19b63c26~mv2.jpg',s:'prawn-pickle'},
{n:'Tomato Pickle',p:300,d:'Green chilies and ripe tomatoes — tangy, spicy, sweet.',c:'Vegetarian Pickles',i:'53b0e3_315289d09db24d65a1b33ecab2a2a8e9~mv2.jpg',s:'tomato-pickle'},
{n:'Mint Pickle',p:330,d:'Fresh mint leaves, aromatic spices, tangy goodness.',c:'Vegetarian Pickles',i:'53b0e3_f21bc86babaf464dbf6d199bdaa3de15~mv2.jpg',s:'mint-pickle'},
{n:'Maagaya',p:330,d:'Authentic mango pickle — hand-picked mangoes, herbs.',c:'Vegetarian Pickles',i:'53b0e3_ad2fb569d13446b8a80e30ec17ec1c2d~mv2.jpg',s:'maagaya'},
{n:'Lemon Pickle',p:330,d:'Hand-picked lemons — tangy, spicy traditional condiment.',c:'Vegetarian Pickles',i:'163af4_4b0acd7a2e6048bd8f740d24f8f33a6a~mv2.jpg',s:'lemon-pickle'},
{n:'Mixed Vegetable Avakaya',p:300,d:'Carrots, tindora, cauliflower, mango — sour and spicy.',c:'Vegetarian Pickles',i:'53b0e3_cf6497e892ba4f1b9ecc11129f7b6325~mv2.jpg',s:'mixed-vegetable-avakaya'}
];

// ═══ 25 SEO BLOG TOPICS ═══
var TOPICS=[
{f:'avakaya pickle recipe authentic andhra',k:'avakaya pickle,mango pickle recipe,andhra avakaya,telugu pickle,raw mango pickle,avakaya pachadi'},
{f:'health benefits of Indian pickles probiotics',k:'pickle health benefits,probiotics in pickles,fermented food benefits,gut health pickles,indian pickle nutrition'},
{f:'gongura pickle recipe roselle leaves',k:'gongura pickle,roselle leaf pickle,andhra gongura,sorrel leaf recipe,gongura chicken'},
{f:'best Indian pickles to buy online',k:'buy pickles online india,homemade pickles delivery,andhra pickles online,authentic pickle shop'},
{f:'chicken pickle recipe andhra style spicy',k:'chicken pickle,non veg pickle recipe,andhra chicken pickle,spicy chicken pickle,boneless chicken pickle'},
{f:'types of Indian pickles regional guide',k:'indian pickle varieties,achar types,regional pickles india,south indian pickles,telugu pickles'},
{f:'turmeric powder benefits uses cooking',k:'turmeric benefits,haldi uses,anti inflammatory spices,organic turmeric,curcumin health'},
{f:'moringa drumstick leaves health superfood',k:'moringa benefits,drumstick leaves,munagaku uses,superfood india,moringa powder nutrition'},
{f:'traditional telugu snacks chekkalu janthikalu',k:'chekkalu recipe,janthikalu,telugu snacks,andhra snacks,rice crackers south indian'},
{f:'prawn pickle coastal andhra recipe',k:'prawn pickle,shrimp pickle recipe,seafood pickle,coastal andhra food,gongura prawns'},
{f:'how to store homemade pickles preserve',k:'pickle storage tips,preserve pickles,pickle shelf life,homemade pickle care,pickle making tips'},
{f:'biryani masala powder recipe homemade',k:'biryani masala,hyderabadi biryani spice,biryani seasoning,garam masala biryani,authentic biryani recipe'},
{f:'dry fruit laddu healthy Indian sweets',k:'dry fruit laddu,healthy laddu,sugar free sweets,nutritious indian sweets,flax seed laddu'},
{f:'andhra food culture cuisine traditions',k:'andhra pradesh cuisine,telugu food,south indian food culture,hyderabad food,andhra cooking traditions'},
{f:'pickle making process traditional methods',k:'how pickles are made,pickle fermentation,traditional pickle making,homemade achar,sea salt pickling'},
{f:'best pickle combinations with Indian food',k:'pickle with rice,pickle pairing,best condiments,indian pickle serving ideas,pickle and biryani'},
{f:'amla pickle gooseberry health benefits',k:'amla pickle,gooseberry pickle,usirikaya pachadi,vitamin c pickle,amla health benefits'},
{f:'homemade vs commercial pickles comparison',k:'homemade vs store pickles,preservative free pickles,natural pickle,chemical free pickle,organic pickle'},
{f:'karam podi idli podi recipe uses',k:'karam podi,idli podi recipe,gun powder chutney,spice powder south indian,dosa podi'},
{f:'food gift ideas Indian festivals diwali',k:'food gift hamper india,pickle gift box,diwali food gifts,andhra food gifts,festival gifting'},
{f:'mutton pickle recipe traditional andhra',k:'mutton pickle,non veg pickle,kheema pickle,andhra mutton pickle,telugu mutton achar'},
{f:'curry leaf benefits karivepaku uses',k:'curry leaf benefits,karivepaku karam,curry leaf podi,curry leaves nutrition,south indian herbs'},
{f:'mint pudina health benefits recipes',k:'mint benefits,pudina uses,pudina karam,mint pickle,fresh mint recipes'},
{f:'ginger pickle benefits ayurvedic remedy',k:'ginger pickle,ginger health benefits,ayurvedic pickle,immunity boosting foods,ginger remedy'},
{f:'lemon pickle recipe indian preservation',k:'lemon pickle,nimbu achar,lemon preservation,citrus pickle recipe,vitamin c condiment'}
];

// ═══ HELPERS ═══
async function callGemini(prompt){
  var r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+GK,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.85,maxOutputTokens:8192}})
  });
  var d=await r.json();
  if(d.error)throw new Error('Gemini: '+(d.error.message||'error'));
  var txt='';
  try{var parts=d.candidates[0].content.parts;for(var i=0;i<parts.length;i++){if(parts[i].text&&!parts[i].thought){txt=parts[i].text;break}}if(!txt&&parts.length>0)txt=parts[parts.length-1].text||''}catch(e){throw new Error('Gemini parse error')}
  return txt;
}

function parseAI(txt,ct,pn){
  var c=txt.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
  if(c.indexOf('<think>')>=0)c=c.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
  var m=c.match(/\{[\s\S]*\}/);
  if(m){try{return JSON.parse(m[0])}catch(e){}}
  return {caption:c.substring(0,500),hashtags:'#SeaSaltPickles #AndhraPickles',cta:'seasaltpickles.com',content_type:ct,product_featured:pn};
}

// ═══ GENERATE SEO BLOG ═══
async function genBlog() {
  if (!GK) throw new Error('GEMINI_API_KEY not set');

  // Pick a topic, avoid repeats
  var topic = TOPICS[Math.floor(Math.random()*TOPICS.length)];
  try {
    var rb = await dG('blog_posts','order=created_at.desc&limit=10&select=slug');
    if (rb && rb.length) {
      for(var i=0;i<10;i++){
        var u=false;
        var ts=topic.f.split(' ')[0].toLowerCase();
        for(var j=0;j<rb.length;j++){if((rb[j].slug||'').toLowerCase().indexOf(ts)>=0){u=true;break}}
        if(!u)break;
        topic=TOPICS[Math.floor(Math.random()*TOPICS.length)];
      }
    }
  } catch(e){}

  var prod = PRODUCTS[Math.floor(Math.random()*PRODUCTS.length)];

  var bp='You are an expert SEO content writer for Sea Salt Pickles (seasaltpickles.com) — premium homemade Andhra pickle, masala & snack brand from Hyderabad.\n\n';
  bp+='Write a COMPREHENSIVE SEO blog post.\nTOPIC: "'+topic.f+'"\nTARGET KEYWORDS: '+topic.k+'\nRELATED PRODUCT: '+prod.n+' (Rs.'+prod.p+') at seasaltpickles.com\n\n';
  bp+='REQUIREMENTS:\n';
  bp+='- Title: SEO-optimized, 50-60 chars, primary keyword near start\n';
  bp+='- Meta description: 150-160 chars for Google snippet\n';
  bp+='- Length: 1000-1500 words with H2 and H3 headings in HTML\n';
  bp+='- Use target keywords naturally 5-8 times\n';
  bp+='- Include internal link to seasaltpickles.com\n';
  bp+='- FAQ section: 4 questions with concise answers\n';
  bp+='- End with CTA to shop at seasaltpickles.com\n';
  bp+='- Tone: Informative, warm, authoritative\n\n';
  bp+='RESPOND ONLY WITH JSON:\n{"title":"SEO title","meta_description":"150 char meta","slug":"url-slug-here","content":"<h2>...</h2><p>...</p>...full HTML","excerpt":"2-3 sentence summary","keywords":"kw1,kw2,kw3","word_count":1200}';

  var ai = await callGemini(bp);
  var blog = parseAI(ai,'seo_blog',topic.f);

  // Ensure slug
  if (!blog.slug) blog.slug = topic.f.replace(/[^a-z0-9]+/gi,'-').toLowerCase().substring(0,60);

  // Add date suffix to prevent duplicates
  var dateSuffix = new Date().toISOString().split('T')[0]; // e.g., 2026-02-25
  var finalSlug = blog.slug;

  // Check if slug already exists
  try {
    var existing = await dG('blog_posts','slug=eq.'+encodeURIComponent(finalSlug)+'&select=id');
    if (existing && existing.length > 0) {
      finalSlug = blog.slug + '-' + dateSuffix;
    }
  } catch(e){}

  // Save to blog_posts table (published immediately on seasaltpickles.com/blog)
  try {
    await dA('blog_posts',{
      title: blog.title || topic.f,
      slug: finalSlug,
      content: blog.content || '',
      excerpt: blog.excerpt || blog.meta_description || '',
      meta_description: blog.meta_description || '',
      keywords: blog.keywords || topic.k,
      image_url: im(prod.i),
      product_name: prod.n,
      product_slug: prod.s,
      status: 'published',
      created_at: new Date().toISOString(),
      published_at: new Date().toISOString()
    });
  } catch(e){ console.error('[Scheduled-Blog] Save blog_posts error:', e.message); }

  // Also save to social_posts for dashboard tracking
  try {
    await dA('social_posts',{
      caption: '📝 Blog: '+(blog.title||topic.f),
      hashtags: (blog.keywords||topic.k).split(',').map(function(k){return '#'+k.trim().replace(/\s+/g,'')}).join(' '),
      platforms: ['blog'],
      status: 'published',
      published_at: new Date().toISOString(),
      ai_generated: true,
      tone: 'seo_blog',
      cta: 'https://seasaltpickles.com/blog/'+finalSlug,
      image_url: im(prod.i)
    });
  } catch(e){}

  console.log('[Scheduled-Blog] 7PM IST — Published: '+finalSlug+' | Topic: '+topic.f);
  return {
    success: true,
    blog: { title: blog.title, slug: finalSlug, keywords: blog.keywords },
    message: 'Blog published at seasaltpickles.com/blog/'+finalSlug
  };
}

// ═══ SCHEDULED HANDLER — runs at 7:00 PM IST (1:30 PM UTC) ═══
var handler = schedule("30 13 * * *", async (event) => {
  console.log('[Scheduled-Blog] Triggered at', new Date().toISOString(), '(7 PM IST)');
  try {
    var result = await genBlog();
    console.log('[Scheduled-Blog] Done:', result.message);
    return { statusCode: 200 };
  } catch(e) {
    console.error('[Scheduled-Blog] Error:', e.message);
    return { statusCode: 500 };
  }
});

export { handler };
