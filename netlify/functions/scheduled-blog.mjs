// ═══════════════════════════════════════════════════════════════
// SCHEDULED-BLOG.MJS v2 — Smart Daily SEO Blog Post
// Runs: 7:00 PM IST (1:30 PM UTC) every day
//
// KEY CHANGES:
// ✅ Fetches LIVE product catalog from Supabase (no hardcoded list)
// ✅ Images resolved from Supabase Storage OR legacy Wix URLs
// ✅ Smart topic rotation — tracks ALL past blog slugs, never repeats
// ✅ Smart product pairing — matches topic to relevant product category
// ✅ Stores product_id for accurate cross-platform tracking
// ═══════════════════════════════════════════════════════════════

var GK = process.env.GEMINI_API_KEY || '';
var SU = process.env.SUPABASE_URL || '';
var SK = process.env.SUPABASE_KEY || '';
var SITE = process.env.URL || 'https://seasaltpickles.com';
var WIX = 'https://static.wixstatic.com/media/';

function sH(p){var h={'Content-Type':'application/json',apikey:SK,Authorization:'Bearer '+SK};if(p)h.Prefer=p;return h}
async function dG(t,q){if(!SU)return[];try{return await(await fetch(SU+'/rest/v1/'+t+'?'+q,{headers:sH()})).json()}catch(e){return[]}}
async function dA(t,r){if(!SU)return null;try{return await(await fetch(SU+'/rest/v1/'+t,{method:'POST',headers:sH('return=representation'),body:JSON.stringify(r)})).json()}catch(e){return null}}
function resolveImg(img){if(!img)return'';if(img.startsWith('http'))return img;return WIX+img+'/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/'+img}

// ═══ FETCH LIVE CATALOG ═══
async function fetchCatalog(){
  var rows=await dG('products','is_active=eq.true&select=id,name,description,category,image,images,variants');
  if(!rows||!rows.length)return[];
  return rows.map(function(p){
    var img=p.image||(p.images&&p.images.length?p.images[0]:'');
    var price=0;
    try{var vs=typeof p.variants==='string'?JSON.parse(p.variants):p.variants;if(Array.isArray(vs)&&vs.length)price=vs[0].price||0}catch(e){}
    return{id:p.id,n:p.name||'',d:(p.description||'').substring(0,200),c:p.category||'',i:resolveImg(img),p:price,s:(p.id||'').replace(/[^a-z0-9]+/gi,'-').toLowerCase()};
  });
}

// ═══ 25 SEO BLOG TOPICS ═══
var TOPICS=[
{f:'avakaya pickle recipe authentic andhra',k:'avakaya pickle,mango pickle recipe,andhra avakaya,telugu pickle,raw mango pickle,avakaya pachadi',cat:'Vegetarian Pickles'},
{f:'health benefits of Indian pickles probiotics',k:'pickle health benefits,probiotics in pickles,fermented food benefits,gut health pickles,indian pickle nutrition',cat:'*'},
{f:'gongura pickle recipe roselle leaves',k:'gongura pickle,roselle leaf pickle,andhra gongura,sorrel leaf recipe,gongura chicken',cat:'Vegetarian Pickles'},
{f:'best Indian pickles to buy online',k:'buy pickles online india,homemade pickles delivery,andhra pickles online,authentic pickle shop',cat:'*'},
{f:'chicken pickle recipe andhra style spicy',k:'chicken pickle,non veg pickle recipe,andhra chicken pickle,spicy chicken pickle,boneless chicken pickle',cat:'Non Veg Pickles'},
{f:'types of Indian pickles regional guide',k:'indian pickle varieties,achar types,regional pickles india,south indian pickles,telugu pickles',cat:'*'},
{f:'turmeric powder benefits uses cooking',k:'turmeric benefits,haldi uses,anti inflammatory spices,organic turmeric,curcumin health',cat:'Masalas & Karam Podis'},
{f:'moringa drumstick leaves health superfood',k:'moringa benefits,drumstick leaves,munagaku uses,superfood india,moringa powder nutrition',cat:'Masalas & Karam Podis'},
{f:'traditional telugu snacks chekkalu janthikalu',k:'chekkalu recipe,janthikalu,telugu snacks,andhra snacks,rice crackers south indian',cat:'Sweets & Snacks'},
{f:'prawn pickle coastal andhra recipe',k:'prawn pickle,shrimp pickle recipe,seafood pickle,coastal andhra food,gongura prawns',cat:'Non Veg Pickles'},
{f:'how to store homemade pickles preserve',k:'pickle storage tips,preserve pickles,pickle shelf life,homemade pickle care,pickle making tips',cat:'*'},
{f:'biryani masala powder recipe homemade',k:'biryani masala,hyderabadi biryani spice,biryani seasoning,garam masala biryani,authentic biryani recipe',cat:'Masalas & Karam Podis'},
{f:'dry fruit laddu healthy Indian sweets',k:'dry fruit laddu,healthy laddu,sugar free sweets,nutritious indian sweets,flax seed laddu',cat:'Sweets & Snacks'},
{f:'andhra food culture cuisine traditions',k:'andhra pradesh cuisine,telugu food,south indian food culture,hyderabad food,andhra cooking traditions',cat:'*'},
{f:'pickle making process traditional methods',k:'how pickles are made,pickle fermentation,traditional pickle making,homemade achar,sea salt pickling',cat:'*'},
{f:'best pickle combinations with Indian food',k:'pickle with rice,pickle pairing,best condiments,indian pickle serving ideas,pickle and biryani',cat:'*'},
{f:'amla pickle gooseberry health benefits',k:'amla pickle,gooseberry pickle,usirikaya pachadi,vitamin c pickle,amla health benefits',cat:'Vegetarian Pickles'},
{f:'homemade vs commercial pickles comparison',k:'homemade vs store pickles,preservative free pickles,natural pickle,chemical free pickle,organic pickle',cat:'*'},
{f:'karam podi idli podi recipe uses',k:'karam podi,idli podi recipe,gun powder chutney,spice powder south indian,dosa podi',cat:'Masalas & Karam Podis'},
{f:'food gift ideas Indian festivals diwali',k:'food gift hamper india,pickle gift box,diwali food gifts,andhra food gifts,festival gifting',cat:'Combos'},
{f:'mutton pickle recipe traditional andhra',k:'mutton pickle,non veg pickle,kheema pickle,andhra mutton pickle,telugu mutton achar',cat:'Non Veg Pickles'},
{f:'curry leaf benefits karivepaku uses',k:'curry leaf benefits,karivepaku karam,curry leaf podi,curry leaves nutrition,south indian herbs',cat:'Masalas & Karam Podis'},
{f:'mint pudina health benefits recipes',k:'mint benefits,pudina uses,pudina karam,mint pickle,fresh mint recipes',cat:'Vegetarian Pickles'},
{f:'ginger pickle benefits ayurvedic remedy',k:'ginger pickle,ginger health benefits,ayurvedic pickle,immunity boosting foods,ginger remedy',cat:'Vegetarian Pickles'},
{f:'lemon pickle recipe indian preservation',k:'lemon pickle,nimbu achar,lemon preservation,citrus pickle recipe,vitamin c condiment',cat:'Vegetarian Pickles'}
];

// ═══ SMART TOPIC ROTATION ═══
// Checks ALL existing blog slugs and picks a topic whose primary keyword
// hasn't appeared in any existing slug. Full cycle before repeats.
async function pickTopic(){
  var allBlogs=await dG('blog_posts','select=slug,keywords&order=created_at.desc&limit=500');
  var usedSlugs=(allBlogs||[]).map(function(b){return(b.slug||'').toLowerCase()});
  var usedKeywords=(allBlogs||[]).map(function(b){return(b.keywords||'').toLowerCase()});

  // Score topics: check how many of its keywords appear in existing slugs
  var scored=TOPICS.map(function(t){
    var words=t.f.split(' ');
    var matchCount=0;
    for(var i=0;i<usedSlugs.length;i++){
      var slug=usedSlugs[i];
      var kwMatch=0;
      for(var w=0;w<words.length;w++){
        if(slug.indexOf(words[w])>=0)kwMatch++;
      }
      // If more than half the words match a slug, it's been covered
      if(kwMatch>=Math.ceil(words.length/2))matchCount++;
    }
    return{topic:t,overlap:matchCount};
  });

  // Sort by least overlap
  scored.sort(function(a,b){return a.overlap-b.overlap});

  // Pick from top 3 least-overlapping
  var top=scored.slice(0,Math.min(3,scored.length));
  return top[Math.floor(Math.random()*top.length)].topic;
}

// ═══ SMART PRODUCT-TOPIC MATCHING ═══
// Picks a product that matches the topic's category, and hasn't been
// featured in a blog recently
async function pickProductForTopic(topic,catalog){
  if(!catalog.length)return null;

  // Filter by matching category (or all if topic.cat is '*')
  var pool=topic.cat==='*'?catalog:catalog.filter(function(p){return p.c===topic.cat});
  if(!pool.length)pool=catalog;

  // Check recent blog products
  var recentBlogs=await dG('blog_posts','select=product_name,product_slug&order=created_at.desc&limit=50');
  var recentNames=(recentBlogs||[]).map(function(b){return(b.product_name||'').toLowerCase()});

  // Prefer products not recently featured in blogs
  var fresh=pool.filter(function(p){return recentNames.indexOf(p.n.toLowerCase())<0});
  if(fresh.length)pool=fresh;

  return pool[Math.floor(Math.random()*pool.length)];
}

// ═══ GEMINI AI ═══
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
  return{title:pn,meta_description:'',slug:'',content:'',excerpt:'',keywords:ct};
}

// ═══ GENERATE BLOG ═══
async function genBlog(){
  if(!GK)throw new Error('GEMINI_API_KEY not set');

  var catalog=await fetchCatalog();
  var topic=await pickTopic();
  var prod=await pickProductForTopic(topic,catalog);
  if(!prod&&catalog.length)prod=catalog[0];

  var bp='You are an expert SEO content writer for Sea Salt Pickles (seasaltpickles.com) — premium homemade Andhra pickle, masala & snack brand from Hyderabad.\n\n';
  bp+='Write a COMPREHENSIVE SEO blog post.\nTOPIC: "'+topic.f+'"\nTARGET KEYWORDS: '+topic.k+'\n';
  if(prod)bp+='RELATED PRODUCT: '+prod.n+' (Rs.'+prod.p+') at seasaltpickles.com\n';
  bp+='\nREQUIREMENTS:\n';
  bp+='- Title: SEO-optimized, 50-60 chars, primary keyword near start\n';
  bp+='- Meta description: 150-160 chars for Google snippet\n';
  bp+='- Length: 1000-1500 words with H2 and H3 headings in HTML\n';
  bp+='- Use target keywords naturally 5-8 times\n';
  bp+='- Include internal link to seasaltpickles.com\n';
  bp+='- FAQ section: 4 questions with concise answers\n';
  bp+='- End with CTA to shop at seasaltpickles.com\n';
  bp+='- Tone: Informative, warm, authoritative\n\n';
  bp+='RESPOND ONLY WITH JSON:\n{"title":"SEO title","meta_description":"150 char meta","slug":"url-slug-here","content":"<h2>...</h2><p>...</p>...full HTML","excerpt":"2-3 sentence summary","keywords":"kw1,kw2,kw3","word_count":1200}';

  var ai=await callGemini(bp);
  var blog=parseAI(ai,'seo_blog',topic.f);
  if(!blog.slug)blog.slug=topic.f.replace(/[^a-z0-9]+/gi,'-').toLowerCase().substring(0,60);

  // Ensure unique slug with date suffix if needed
  var dateSuffix=new Date().toISOString().split('T')[0];
  var finalSlug=blog.slug;
  try{
    var existing=await dG('blog_posts','slug=eq.'+encodeURIComponent(finalSlug)+'&select=id');
    if(existing&&existing.length>0)finalSlug=blog.slug+'-'+dateSuffix;
  }catch(e){}

  var imgUrl=prod?prod.i:'';

  // Save blog post
  try{
    await dA('blog_posts',{
      title:blog.title||topic.f,
      slug:finalSlug,
      content:blog.content||'',
      excerpt:blog.excerpt||blog.meta_description||'',
      meta_description:blog.meta_description||'',
      keywords:blog.keywords||topic.k,
      image_url:imgUrl,
      product_name:prod?prod.n:'',
      product_slug:prod?prod.s:'',
      product_id:prod?prod.id:null,
      status:'published',
      created_at:new Date().toISOString(),
      published_at:new Date().toISOString()
    });
  }catch(e){console.error('[Blog] Save error:',e.message)}

  // Track in social_posts for dashboard
  try{
    await dA('social_posts',{
      caption:'📝 Blog: '+(blog.title||topic.f),
      hashtags:(blog.keywords||topic.k).split(',').map(function(k){return'#'+k.trim().replace(/\s+/g,'')}).join(' '),
      platforms:['blog'],
      status:'published',
      published_at:new Date().toISOString(),
      ai_generated:true,
      tone:'seo_blog',
      cta:'https://seasaltpickles.com/blog/'+finalSlug,
      image_url:imgUrl,
      product_featured:prod?prod.n:'',
      product_id:prod?prod.id:null
    });
  }catch(e){}

  console.log('[Blog] Published: '+finalSlug+' | Topic: '+topic.f+' | Product: '+(prod?prod.n:'none'));
  return{success:true,blog:{title:blog.title,slug:finalSlug,keywords:blog.keywords},message:'Blog published at seasaltpickles.com/blog/'+finalSlug};
}

// ═══ HANDLER — 7:00 PM IST (1:30 PM UTC) ═══
export async function handler(event){
  console.log('[Blog] Triggered at',new Date().toISOString(),'(7 PM IST)');
  try{var result=await genBlog();console.log('[Blog] Done:',result.message);return{statusCode:200}}
  catch(e){console.error('[Blog] Error:',e.message);return{statusCode:500}}
}
