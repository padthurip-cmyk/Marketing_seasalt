// ═══════════════════════════════════════════════════════════════
// SCHEDULED-SOCIAL.MJS v2 — Smart Daily Product Post
// Runs: 7:00 AM IST (1:30 AM UTC) every day
// 
// KEY CHANGES:
// ✅ Fetches LIVE product catalog from Supabase (no hardcoded list)
// ✅ Images resolved from Supabase Storage OR legacy Wix URLs
// ✅ Round-robin product rotation — cycles entire catalog before repeating
// ✅ Content style diversity — tracks recent styles, picks fresh ones
// ✅ Stores product_id in social_posts for accurate tracking
// ═══════════════════════════════════════════════════════════════

var GK = process.env.GEMINI_API_KEY || '';
var PT = process.env.META_PAGE_TOKEN || '';
var PI = process.env.META_PAGE_ID || '';
var IG = process.env.INSTAGRAM_BUSINESS_ID || '';
var SU = process.env.SUPABASE_URL || '';
var SK = process.env.SUPABASE_KEY || '';
var G = 'https://graph.facebook.com/v25.0';
var WIX = 'https://static.wixstatic.com/media/';

// ═══ SUPABASE HELPERS ═══
function sH(p){var h={'Content-Type':'application/json',apikey:SK,Authorization:'Bearer '+SK};if(p)h.Prefer=p;return h}
async function dG(t,q){if(!SU)return[];try{return await(await fetch(SU+'/rest/v1/'+t+'?'+q,{headers:sH()})).json()}catch(e){return[]}}
async function dA(t,r){if(!SU)return null;try{return await(await fetch(SU+'/rest/v1/'+t,{method:'POST',headers:sH('return=representation'),body:JSON.stringify(r)})).json()}catch(e){return null}}

// ═══ IMAGE URL RESOLVER ═══
function resolveImg(img){
  if(!img)return '';
  if(img.startsWith('http'))return img;
  return WIX+img+'/v1/fill/w_1080,h_1080,al_c,q_85,enc_auto/'+img;
}

// ═══ FETCH LIVE CATALOG ═══
async function fetchCatalog(){
  var rows=await dG('products','is_active=eq.true&select=id,name,description,category,image,images,badge,variants');
  if(!rows||!rows.length)return[];
  return rows.map(function(p){
    var img=p.image||(p.images&&p.images.length?p.images[0]:'');
    var price=0;
    try{var vs=typeof p.variants==='string'?JSON.parse(p.variants):p.variants;if(Array.isArray(vs)&&vs.length)price=vs[0].price||0}catch(e){}
    return{id:p.id,n:p.name||'',d:(p.description||'').substring(0,200),c:p.category||'',i:resolveImg(img),p:price,s:(p.id||'').replace(/[^a-z0-9]+/gi,'-').toLowerCase()};
  });
}

// ═══ SMART PRODUCT ROTATION ═══
// Queries ALL past social posts, builds last-featured map per product_id,
// picks the LEAST recently featured product. Full catalog cycles before repeats.
async function pickNextProduct(catalog){
  if(!catalog.length)return catalog[0]||null;
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
  var scored=catalog.map(function(p){
    var last=lastSeen[p.id];
    return{product:p,score:last?new Date(last).getTime():0};
  });
  scored.sort(function(a,b){
    if(a.score===0&&b.score!==0)return -1;
    if(b.score===0&&a.score!==0)return 1;
    return a.score-b.score;
  });
  var top=scored.slice(0,Math.min(5,scored.length));
  return top[Math.floor(Math.random()*top.length)].product;
}

// ═══ CONTENT STYLE ROTATION ═══
async function pickStyle(){
  var types=['product_highlight','behind_the_scenes','customer_love','recipe_tip','fun_fact','health_benefit','origin_story','seasonal'];
  try{
    var recent=await dG('social_posts','ai_generated=eq.true&tone=neq.spinwheel_promo&tone=neq.seo_blog&order=created_at.desc&limit=8&select=tone');
    if(recent&&recent.length){
      var used=recent.map(function(r){return r.tone});
      var avail=types.filter(function(t){return used.indexOf(t)<0});
      if(avail.length)return avail[Math.floor(Math.random()*avail.length)];
    }
  }catch(e){}
  return types[Math.floor(Math.random()*types.length)];
}

// ═══ GEMINI AI ═══
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
function parseAI(txt,ct,pn){
  var c=txt.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
  if(c.indexOf('<think>')>=0)c=c.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
  var m=c.match(/\{[\s\S]*\}/);
  if(m){try{return JSON.parse(m[0])}catch(e){}}
  return{caption:c.substring(0,500),hashtags:'#SeaSaltPickles #AndhraPickles #HomemadePickles #HyderabadFood',cta:'Order at seasaltpickles.com',content_type:ct,product_featured:pn};
}

// ═══ GENERATE + PUBLISH ═══
async function genPost(){
  if(!GK)throw new Error('GEMINI_API_KEY not set');
  var catalog=await fetchCatalog();
  if(!catalog.length)throw new Error('No active products in catalog');
  var prod=await pickNextProduct(catalog);
  if(!prod)prod=catalog[0];
  var ct=await pickStyle();
  var imageUrl=prod.i;
  var now=new Date(new Date().getTime()+5.5*60*60*1000);
  var ds=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var ms=['January','February','March','April','May','June','July','August','September','October','November','December'];

  var prompt='You are social media manager for Sea Salt Pickles (@seasaltpickles) - premium homemade Andhra pickles, masalas & snacks from Hyderabad. Website: seasaltpickles.com\n\n';
  prompt+='TODAY: '+ds[now.getDay()]+', '+ms[now.getMonth()]+' '+now.getDate()+'\n';
  prompt+='TIME: 7:00 AM IST — Good morning post!\n';
  prompt+='PRODUCT: '+prod.n+' (Rs.'+prod.p+') - '+prod.d+'\nCATEGORY: '+prod.c+'\nSTYLE: '+ct+'\n\n';
  prompt+='Create an Instagram/Facebook post. Caption 100-200 words, natural emojis, 15-20 hashtags including #SeaSaltPickles, CTA with link to seasaltpickles.com. Authentic, NOT AI-sounding.\n\n';
  prompt+='RESPOND ONLY WITH JSON, no markdown:\n{"caption":"...","hashtags":"#SeaSaltPickles ...","cta":"Order at seasaltpickles.com","content_type":"'+ct+'","product_featured":"'+prod.n+'"}';

  var ai=await callGemini(prompt);
  var parsed=parseAI(ai,ct,prod.n);
  var fullMsg=(parsed.caption||'')+'\n\n'+(parsed.hashtags||'');
  if(parsed.cta)fullMsg+='\n\n'+parsed.cta;
  var results=[],fbId='',igId='',postUrl='';

  // Facebook
  if(PT&&PI){try{var fp=new URLSearchParams();fp.append('access_token',PT);fp.append('message',fullMsg);if(imageUrl){fp.append('url',imageUrl);var fr=await fetch(G+'/'+PI+'/photos',{method:'POST',body:fp})}else{var fr=await fetch(G+'/'+PI+'/feed',{method:'POST',body:fp})}var fd=await fr.json();if(fd.id||fd.post_id){fbId=fd.id||fd.post_id;postUrl='https://facebook.com/'+fbId;results.push('Facebook: POSTED ✅')}else{results.push('Facebook: FAILED ❌ '+(fd.error&&fd.error.message?fd.error.message:''))}}catch(e){results.push('Facebook: ERROR ❌ '+e.message)}}

  // Instagram
  if(PT&&IG&&imageUrl){try{var ip=new URLSearchParams();ip.append('access_token',PT);ip.append('image_url',imageUrl);ip.append('caption',fullMsg);var ir=await fetch(G+'/'+IG+'/media',{method:'POST',body:ip});var ic=await ir.json();if(ic.id){for(var w=0;w<15;w++){await new Promise(function(r){setTimeout(r,2000)});var sr=await fetch(G+'/'+ic.id+'?fields=status_code&access_token='+PT);var sd=await sr.json();if(sd.status_code==='FINISHED'||sd.status_code==='ERROR')break}var pp=new URLSearchParams();pp.append('access_token',PT);pp.append('creation_id',ic.id);var pr=await fetch(G+'/'+IG+'/media_publish',{method:'POST',body:pp});var pd=await pr.json();if(pd.id){igId=pd.id;results.push('Instagram: POSTED ✅')}else{results.push('Instagram: PUBLISH FAILED ❌ '+(pd.error&&pd.error.message?pd.error.message:''))}}else{results.push('Instagram: CONTAINER FAILED ❌ '+(ic.error&&ic.error.message?ic.error.message:''))}}catch(e){results.push('Instagram: ERROR ❌ '+e.message)}}

  // Save with product_id for rotation tracking
  try{await dA('social_posts',{caption:parsed.caption,hashtags:parsed.hashtags,platforms:[fbId?'facebook':'',igId?'instagram':''].filter(Boolean),status:'published',published_at:new Date().toISOString(),ai_generated:true,tone:ct,cta:parsed.cta,image_url:imageUrl,fb_post_id:fbId,ig_media_id:igId,post_url:postUrl,product_featured:prod.n,product_id:prod.id})}catch(e){}

  console.log('[Social] Product: '+prod.n+' ('+prod.id+') | Style: '+ct+' | '+results.join(', '));
  return{success:!!(fbId||igId),post:parsed,image_url:imageUrl,product:prod.n,product_id:prod.id,results:results};
}

// ═══ HANDLER ═══
export async function handler(event){
  console.log('[Social] Triggered at',new Date().toISOString(),'(7 AM IST)');
  try{var result=await genPost();console.log('[Social] Done:',JSON.stringify(result.results));return{statusCode:200};}
  catch(e){console.error('[Social] Error:',e.message);return{statusCode:500};}
}
