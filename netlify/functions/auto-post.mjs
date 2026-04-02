// ═══════════════════════════════════════════════════════════════
// AUTO-POST.MJS v2 — Manual Trigger for Social + Blog
// Endpoint: POST /.netlify/functions/auto-post
// Actions: ?action=generate | ?action=blog | ?action=daily
//
// KEY CHANGES:
// ✅ Fetches LIVE catalog from Supabase (no hardcoded products)
// ✅ Images from Supabase Storage or legacy Wix
// ✅ Smart round-robin product rotation
// ✅ Smart topic rotation for blogs
// ✅ Stores product_id for tracking
// ═══════════════════════════════════════════════════════════════

var GK = process.env.GEMINI_API_KEY || '';
var PT = process.env.META_PAGE_TOKEN || '';
var PI = process.env.META_PAGE_ID || '';
var IG = process.env.INSTAGRAM_BUSINESS_ID || '';
var SU = process.env.SUPABASE_URL || '';
var SK = process.env.SUPABASE_KEY || '';
var SITE = process.env.URL || 'https://seasalt-intelligence-hub.netlify.app';
var G = 'https://graph.facebook.com/v25.0';
var WIX = 'https://static.wixstatic.com/media/';

function sH(p){var h={'Content-Type':'application/json',apikey:SK,Authorization:'Bearer '+SK};if(p)h.Prefer=p;return h}
async function dG(t,q){if(!SU)return[];try{return await(await fetch(SU+'/rest/v1/'+t+'?'+q,{headers:sH()})).json()}catch(e){return[]}}
async function dA(t,r){if(!SU)return null;try{return await(await fetch(SU+'/rest/v1/'+t,{method:'POST',headers:sH('return=representation'),body:JSON.stringify(r)})).json()}catch(e){return null}}
function resolveImg(img){if(!img)return'';if(img.startsWith('http'))return img;return WIX+img+'/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/'+img}

// ═══ LIVE CATALOG ═══
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

// ═══ SMART PRODUCT ROTATION ═══
async function pickNextProduct(catalog){
  if(!catalog.length)return null;
  var posts=await dG('social_posts','select=product_id,product_featured,created_at&order=created_at.desc&limit=500');
  var lastSeen={};
  if(posts&&posts.length){
    for(var i=0;i<posts.length;i++){
      var pid=posts[i].product_id||'';
      if(!pid&&posts[i].product_featured){
        var m=catalog.find(function(p){return p.n.toLowerCase()===(posts[i].product_featured||'').toLowerCase()});
        if(m)pid=m.id;
      }
      if(pid&&!lastSeen[pid])lastSeen[pid]=posts[i].created_at||'';
    }
  }
  var scored=catalog.map(function(p){var last=lastSeen[p.id];return{product:p,score:last?new Date(last).getTime():0}});
  scored.sort(function(a,b){if(a.score===0&&b.score!==0)return-1;if(b.score===0&&a.score!==0)return 1;return a.score-b.score});
  var top=scored.slice(0,Math.min(5,scored.length));
  return top[Math.floor(Math.random()*top.length)].product;
}

// ═══ BLOG TOPICS ═══
var TOPICS=[
{f:'avakaya pickle recipe authentic andhra',k:'avakaya pickle,mango pickle recipe,andhra avakaya,telugu pickle',cat:'Vegetarian Pickles'},
{f:'health benefits of Indian pickles probiotics',k:'pickle health benefits,probiotics in pickles,fermented food benefits',cat:'*'},
{f:'gongura pickle recipe roselle leaves',k:'gongura pickle,roselle leaf pickle,andhra gongura,gongura chicken',cat:'Vegetarian Pickles'},
{f:'best Indian pickles to buy online',k:'buy pickles online india,homemade pickles delivery,andhra pickles online',cat:'*'},
{f:'chicken pickle recipe andhra style spicy',k:'chicken pickle,non veg pickle recipe,andhra chicken pickle',cat:'Non Veg Pickles'},
{f:'types of Indian pickles regional guide',k:'indian pickle varieties,achar types,regional pickles india',cat:'*'},
{f:'turmeric powder benefits uses cooking',k:'turmeric benefits,haldi uses,anti inflammatory spices',cat:'Masalas & Karam Podis'},
{f:'moringa drumstick leaves health superfood',k:'moringa benefits,drumstick leaves,munagaku uses',cat:'Masalas & Karam Podis'},
{f:'traditional telugu snacks chekkalu janthikalu',k:'chekkalu recipe,janthikalu,telugu snacks,andhra snacks',cat:'Sweets & Snacks'},
{f:'prawn pickle coastal andhra recipe',k:'prawn pickle,shrimp pickle recipe,seafood pickle',cat:'Non Veg Pickles'},
{f:'how to store homemade pickles preserve',k:'pickle storage tips,preserve pickles,pickle shelf life',cat:'*'},
{f:'biryani masala powder recipe homemade',k:'biryani masala,hyderabadi biryani spice,biryani seasoning',cat:'Masalas & Karam Podis'},
{f:'dry fruit laddu healthy Indian sweets',k:'dry fruit laddu,healthy laddu,sugar free sweets',cat:'Sweets & Snacks'},
{f:'andhra food culture cuisine traditions',k:'andhra pradesh cuisine,telugu food,south indian food culture',cat:'*'},
{f:'pickle making process traditional methods',k:'how pickles are made,pickle fermentation,traditional pickle making',cat:'*'},
{f:'best pickle combinations with Indian food',k:'pickle with rice,pickle pairing,best condiments',cat:'*'},
{f:'amla pickle gooseberry health benefits',k:'amla pickle,gooseberry pickle,vitamin c pickle',cat:'Vegetarian Pickles'},
{f:'homemade vs commercial pickles comparison',k:'homemade vs store pickles,preservative free pickles',cat:'*'},
{f:'karam podi idli podi recipe uses',k:'karam podi,idli podi recipe,gun powder chutney',cat:'Masalas & Karam Podis'},
{f:'food gift ideas Indian festivals diwali',k:'food gift hamper india,pickle gift box,diwali food gifts',cat:'Combos'},
{f:'mutton pickle recipe traditional andhra',k:'mutton pickle,non veg pickle,kheema pickle',cat:'Non Veg Pickles'},
{f:'curry leaf benefits karivepaku uses',k:'curry leaf benefits,karivepaku karam,curry leaf podi',cat:'Masalas & Karam Podis'},
{f:'mint pudina health benefits recipes',k:'mint benefits,pudina uses,pudina karam,mint pickle',cat:'Vegetarian Pickles'},
{f:'ginger pickle benefits ayurvedic remedy',k:'ginger pickle,ginger health benefits,ayurvedic pickle',cat:'Vegetarian Pickles'},
{f:'lemon pickle recipe indian preservation',k:'lemon pickle,nimbu achar,lemon preservation',cat:'Vegetarian Pickles'}
];

// ═══ SMART TOPIC ROTATION ═══
async function pickTopic(){
  var allBlogs=await dG('blog_posts','select=slug,keywords&order=created_at.desc&limit=500');
  var usedSlugs=(allBlogs||[]).map(function(b){return(b.slug||'').toLowerCase()});
  var scored=TOPICS.map(function(t){
    var words=t.f.split(' ');var matchCount=0;
    for(var i=0;i<usedSlugs.length;i++){var kwMatch=0;for(var w=0;w<words.length;w++){if(usedSlugs[i].indexOf(words[w])>=0)kwMatch++}if(kwMatch>=Math.ceil(words.length/2))matchCount++}
    return{topic:t,overlap:matchCount};
  });
  scored.sort(function(a,b){return a.overlap-b.overlap});
  var top=scored.slice(0,Math.min(3,scored.length));
  return top[Math.floor(Math.random()*top.length)].topic;
}

async function pickProductForTopic(topic,catalog){
  if(!catalog.length)return null;
  var pool=topic.cat==='*'?catalog:catalog.filter(function(p){return p.c===topic.cat});
  if(!pool.length)pool=catalog;
  var recentBlogs=await dG('blog_posts','select=product_name&order=created_at.desc&limit=50');
  var recentNames=(recentBlogs||[]).map(function(b){return(b.product_name||'').toLowerCase()});
  var fresh=pool.filter(function(p){return recentNames.indexOf(p.n.toLowerCase())<0});
  if(fresh.length)pool=fresh;
  return pool[Math.floor(Math.random()*pool.length)];
}

// ═══ GEMINI ═══
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
  return{caption:c.substring(0,500),hashtags:'#SeaSaltPickles #AndhraPickles #HomemadePickles #HyderabadFood',cta:'Order at seasaltpickles.com',content_type:ct,product_featured:pn};
}

// ═══ HANDLER ═══
export var handler=async function(event){
  var H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'};
  if(event.httpMethod==='OPTIONS')return{statusCode:200,headers:H,body:''};

  var action='generate';
  try{if(event.body)action=JSON.parse(event.body).action||'generate'}catch(e){}
  if((event.queryStringParameters||{}).action)action=event.queryStringParameters.action;

  try{
    if(action==='generate')return{statusCode:200,headers:H,body:JSON.stringify(await genPost())};
    if(action==='blog')return{statusCode:200,headers:H,body:JSON.stringify(await genBlog())};
    if(action==='daily'){var post=await genPost();var blog=await genBlog();return{statusCode:200,headers:H,body:JSON.stringify({post:post,blog:blog,message:'Daily post + blog generated!'})}}
    return{statusCode:400,headers:H,body:JSON.stringify({error:'Unknown action'})};
  }catch(e){return{statusCode:500,headers:H,body:JSON.stringify({error:e.message})};}
};

// ═══ GENERATE SOCIAL POST ═══
async function genPost(){
  if(!GK)throw new Error('GEMINI_API_KEY not set');
  var catalog=await fetchCatalog();
  if(!catalog.length)throw new Error('No active products in catalog');
  var prod=await pickNextProduct(catalog);
  if(!prod)prod=catalog[0];

  var types=['product_highlight','behind_the_scenes','customer_love','recipe_tip','fun_fact','health_benefit','origin_story','seasonal'];
  var ct=types[Math.floor(Math.random()*types.length)];
  var imageUrl=prod.i;
  var now=new Date();var ds=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];var ms=['January','February','March','April','May','June','July','August','September','October','November','December'];

  var prompt='You are social media manager for Sea Salt Pickles (@seasaltpickles) - premium homemade Andhra pickles, masalas & snacks from Hyderabad. Website: seasaltpickles.com\n\n';
  prompt+='TODAY: '+ds[now.getDay()]+', '+ms[now.getMonth()]+' '+now.getDate()+'\n';
  prompt+='PRODUCT: '+prod.n+' (Rs.'+prod.p+') - '+prod.d+'\nCATEGORY: '+prod.c+'\nSTYLE: '+ct+'\n\n';
  prompt+='Create an Instagram/Facebook post. Caption 100-200 words, natural emojis, 15-20 hashtags including #SeaSaltPickles, CTA with link to seasaltpickles.com. Authentic, NOT AI-sounding.\n\n';
  prompt+='RESPOND ONLY WITH JSON, no markdown:\n{"caption":"...","hashtags":"#SeaSaltPickles ...","cta":"Order at seasaltpickles.com","content_type":"'+ct+'","product_featured":"'+prod.n+'"}';

  var ai=await callGemini(prompt);var parsed=parseAI(ai,ct,prod.n);
  var fullMsg=(parsed.caption||'')+'\n\n'+(parsed.hashtags||'');
  if(parsed.cta)fullMsg+='\n\n'+parsed.cta;
  var results=[],fbId='',igId='',postUrl='';

  if(PT&&PI){try{var fp=new URLSearchParams();fp.append('access_token',PT);fp.append('message',fullMsg);if(imageUrl){fp.append('url',imageUrl);var fr=await fetch(G+'/'+PI+'/photos',{method:'POST',body:fp})}else{var fr=await fetch(G+'/'+PI+'/feed',{method:'POST',body:fp})}var fd=await fr.json();if(fd.id||fd.post_id){fbId=fd.id||fd.post_id;postUrl='https://facebook.com/'+fbId;results.push('Facebook: ✅')}else{results.push('Facebook: ❌ '+(fd.error&&fd.error.message?fd.error.message:''))}}catch(e){results.push('Facebook: ❌ '+e.message)}}
  if(PT&&IG&&imageUrl){try{var ip=new URLSearchParams();ip.append('access_token',PT);ip.append('image_url',imageUrl);ip.append('caption',fullMsg);var ir=await fetch(G+'/'+IG+'/media',{method:'POST',body:ip});var ic=await ir.json();if(ic.id){for(var w=0;w<15;w++){await new Promise(function(r){setTimeout(r,2000)});var sr=await fetch(G+'/'+ic.id+'?fields=status_code&access_token='+PT);var sd=await sr.json();if(sd.status_code==='FINISHED'||sd.status_code==='ERROR')break}var pp=new URLSearchParams();pp.append('access_token',PT);pp.append('creation_id',ic.id);var pr=await fetch(G+'/'+IG+'/media_publish',{method:'POST',body:pp});var pd=await pr.json();if(pd.id){igId=pd.id;results.push('Instagram: ✅')}else{results.push('Instagram: ❌')}}else{results.push('Instagram: ❌')}}catch(e){results.push('Instagram: ❌ '+e.message)}}

  try{await dA('social_posts',{caption:parsed.caption,hashtags:parsed.hashtags,platforms:[fbId?'facebook':'',igId?'instagram':''].filter(Boolean),status:'published',published_at:new Date().toISOString(),ai_generated:true,tone:ct,cta:parsed.cta,image_url:imageUrl,fb_post_id:fbId,ig_media_id:igId,post_url:postUrl,product_featured:prod.n,product_id:prod.id})}catch(e){}
  return{success:!!(fbId||igId),post:parsed,image_url:imageUrl,product:prod.n,product_id:prod.id,results:results};
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
  bp+='\nREQUIREMENTS:\n- Title: SEO-optimized, 50-60 chars\n- Meta description: 150-160 chars\n- Length: 1000-1500 words with H2/H3 in HTML\n- Keywords 5-8 times naturally\n- Internal link to seasaltpickles.com\n- FAQ section: 4 questions\n- CTA to shop\n- Tone: Informative, warm\n\n';
  bp+='RESPOND ONLY WITH JSON:\n{"title":"SEO title","meta_description":"150 char meta","slug":"url-slug-here","content":"<h2>...</h2><p>...</p>","excerpt":"2-3 sentence summary","keywords":"kw1,kw2","word_count":1200}';

  var ai=await callGemini(bp);var blog=parseAI(ai,'seo_blog',topic.f);
  if(!blog.slug)blog.slug=topic.f.replace(/[^a-z0-9]+/gi,'-').toLowerCase().substring(0,60);
  var finalSlug=blog.slug;
  try{var ex=await dG('blog_posts','slug=eq.'+encodeURIComponent(finalSlug)+'&select=id');if(ex&&ex.length>0)finalSlug=blog.slug+'-'+new Date().toISOString().split('T')[0]}catch(e){}
  var imgUrl=prod?prod.i:'';

  try{await dA('blog_posts',{title:blog.title||topic.f,slug:finalSlug,content:blog.content||'',excerpt:blog.excerpt||blog.meta_description||'',meta_description:blog.meta_description||'',keywords:blog.keywords||topic.k,image_url:imgUrl,product_name:prod?prod.n:'',product_slug:prod?prod.s:'',product_id:prod?prod.id:null,status:'published',created_at:new Date().toISOString(),published_at:new Date().toISOString()})}catch(e){}
  try{await dA('social_posts',{caption:'📝 Blog: '+(blog.title||topic.f),hashtags:(blog.keywords||topic.k).split(',').map(function(k){return'#'+k.trim().replace(/\s+/g,'')}).join(' '),platforms:['blog'],status:'published',published_at:new Date().toISOString(),ai_generated:true,tone:'seo_blog',cta:SITE+'/blog/'+finalSlug,image_url:imgUrl,product_featured:prod?prod.n:'',product_id:prod?prod.id:null})}catch(e){}

  return{success:true,blog:{title:blog.title||topic.f,slug:finalSlug,meta_description:blog.meta_description||'',content:blog.content||'',excerpt:blog.excerpt||'',keywords:blog.keywords||topic.k,url:SITE+'/blog/'+finalSlug,related_product:prod?{name:prod.n,price:prod.p,image:prod.i}:null},message:'SEO Blog published!'};
}
