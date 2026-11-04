const VERSION = 'catalog-v2-20261103';
const TTL = 30;
const CORS = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Expose-Headers':'X-Catalog-Version,X-Catalog-Cache,X-Catalog-SQL-Ms,X-Catalog-Rows-Read'
};
const inFlight = new Map();
const localCache = new Map();
function json(data,status=200,extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json; charset=utf-8','X-Catalog-Version':VERSION,...extra}});
}
function integer(v,f,min,max) { const n=Number.parseInt(v,10); return Number.isFinite(n)?Math.min(max,Math.max(min,n)):f; }
function number(v) { if(v===null||v==='')return null; const n=Number(v);return Number.isFinite(n)?n:null; }
export function normalize(url) {
  const sp=url.searchParams;
  const search=String(sp.get('search')||'').trim().toLowerCase().replace(/\s+/gu,' ');
  if([...search].length>160) throw Object.assign(new Error('La búsqueda es demasiado larga.'),{status:400,code:'invalid_search'});
  if(/[\x00-\x1f]/u.test(search)) throw Object.assign(new Error('La búsqueda contiene caracteres no válidos.'),{status:400,code:'invalid_search'});
  const terms=[...new Set(search.split(' ').filter(Boolean))];
  if(terms.length>12)throw Object.assign(new Error('Usa hasta 12 palabras en la búsqueda.'),{status:400,code:'invalid_search'});
  if(terms.length&&!terms.some(t=>[...t].length>=3))throw Object.assign(new Error('Escribe al menos una palabra de 3 caracteres para buscar.'),{status:400,code:'search_too_short'});
  return {page:integer(sp.get('page'),1,1,1000000),page_size:integer(sp.get('page_size'),20,1,100),search,terms,
    anime:String(sp.get('anime')||'').trim(), availability:['preventa','disponible','rank'].includes(sp.get('availability'))?sp.get('availability'):'',
    sort:['price_asc','price_desc'].includes(sp.get('sort'))?sp.get('sort'):'newest',min:number(sp.get('min_price')),max:number(sp.get('max_price')),
    include_meta:sp.get('include_meta')==='1'};
}
// Each quoted term is exactly three code points: detail=none FTS remains compact.
// Exact substring checks remove false positives and preserve per-word AND matching.
export function grams(terms) {
  const g=new Set();
  for(const term of terms){const a=[...term]; for(let i=0;i<=a.length-3;i++)g.add(a.slice(i,i+3).join(''));}
  return [...g].map(g=>'"'+g.replaceAll('"','""')+'"').join(' AND ');
}
export function plan(q) {
  let from='catalog_public_v2 c';const where=[];const params=[];const counters=[];const cp=[];
  if(q.terms.length){from='catalog_search_v2 f CROSS JOIN catalog_public_v2 c ON c.source_rowid=f.rowid';where.push('catalog_search_v2 MATCH ?');params.push(grams(q.terms));
    for(const t of q.terms){where.push('instr(c.search_text,?)>0');params.push(t);}}
  if(q.anime){where.push('c.anime=? COLLATE NOCASE');params.push(q.anime);counters.push('anime=? COLLATE NOCASE');cp.push(q.anime);}
  if(q.availability==='preventa'||q.availability==='disponible'){const flag=q.availability==='preventa'?1:0;where.push('c.is_preventa=?');params.push(flag);counters.push('is_preventa=?');cp.push(flag);}
  if(q.availability==='rank'){where.push('c.has_rank=1');counters.push('has_rank=1');}
  if(q.min!==null){where.push('c.precio_num>=?');params.push(q.min);}
  if(q.max!==null){where.push('c.precio_num<=?');params.push(q.max);}
  const suffix=where.length?' WHERE '+where.join(' AND '):'';
  const countFast=!q.terms.length&&q.min===null&&q.max===null;
  const countSQL=countFast?'SELECT COALESCE(SUM(total),0) AS total FROM catalog_counts_v2'+(counters.length?' WHERE '+counters.join(' AND '):''):'SELECT COUNT(*) AS total FROM '+from+suffix;
  const order=q.sort==='price_asc'?'(c.precio_num IS NULL),c.precio_num ASC,c.lote_num DESC':q.sort==='price_desc'?'(c.precio_num IS NULL),c.precio_num DESC,c.lote_num DESC':'c.lote_num DESC';
  return {from,suffix,params,countSQL,countParams:countFast?cp:params,order};
}
async function memo(key,fn,ttl=TTL) {
  const now=Date.now(), cached=localCache.get(key); if(cached&&cached.expiry>now)return cached.value;
  if(inFlight.has(key))return inFlight.get(key);
  const pending=fn().then(value=>{localCache.set(key,{value,expiry:Date.now()+ttl*1000});if(localCache.size>200)localCache.delete(localCache.keys().next().value);return value;}).finally(()=>inFlight.delete(key));
  inFlight.set(key,pending);return pending;
}
async function queryCatalog(q,env) {
  const started=Date.now();let rowsRead=0,sqlMs=0;
  function meta(r){rowsRead+=Number(r.meta?.rows_read||0);sqlMs+=Number(r.meta?.timings?.sql_duration_ms||r.meta?.duration||0);return r;}
  const ready=await memo('ready',async()=>{const r=meta(await env.DB.prepare('SELECT ready FROM catalog_build_v2 WHERE id=1').all());return r.results[0]?.ready===1;},15);
  if(!ready)throw Object.assign(new Error('El catálogo se está preparando. Intenta nuevamente en unos momentos.'),{status:503,code:'catalog_index_building'});
  const p=plan(q);
  const countKey='count:'+JSON.stringify({...q,page:0,page_size:0,include_meta:false,sort:''});
  const total=await memo(countKey,async()=>{const r=meta(await env.DB.prepare(p.countSQL).bind(...p.countParams).all());return Number(r.results[0]?.total||0);});
  const totalPages=Math.max(1,Math.ceil(total/q.page_size)),page=Math.min(q.page,totalPages);
  // Select indexed ids first; fetch only the page's source rows for photos and display.
  const fields=['id_lote','imagen_url','etiqueta','precio_producto','precio_num','visible','ultima_revision','anime','tipo','busqueda','rank'];
  const sql=`SELECT ${fields.map(f=>'p.'+f).join(',')} FROM (${`SELECT c.source_rowid FROM ${p.from}${p.suffix} ORDER BY ${p.order} LIMIT ? OFFSET ?`}) page_ids CROSS JOIN productos_japon p ON p.rowid=page_ids.source_rowid WHERE p.activo=1 AND UPPER(COALESCE(p.visible,'SI'))='SI'`;
  const products=meta(await env.DB.prepare(sql).bind(...p.params,q.page_size,(page-1)*q.page_size).all());
  const result={ok:true,productos:products.results,page,page_size:q.page_size,total,total_pages:totalPages,execution_ms:Date.now()-started};
  if(q.include_meta)result.animes=await memo('animes',async()=>{const r=meta(await env.DB.prepare("SELECT DISTINCT anime FROM catalog_counts_v2 WHERE total>0 AND TRIM(anime)<>'' ORDER BY anime COLLATE NOCASE").all());return r.results.map(x=>x.anime);},300);
  return {result,rowsRead,sqlMs};
}
export default {async fetch(request,env,ctx){
  if(request.method==='OPTIONS')return new Response(null,{headers:CORS});
  if(request.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);
  const url=new URL(request.url),action=url.searchParams.get('accion')||'';
  if(!action)return json({ok:true,servicio:'Mardant Catálogo Japón D1',version:VERSION});
  if(action!=='catalogoPreventasJaponPage')return json({ok:false,error:'accion_no_soportada',accion:action},404);
  try{
    const q=normalize(url),canonical=new URL(url.origin+'/__catalog/'+VERSION);
    // Only supported normalized parameters enter the cache key; tracking/cache-busters do not fan out DB queries.
    canonical.search= new URLSearchParams({q:JSON.stringify(q)}).toString();
    const key=new Request(canonical.toString()),cache=typeof caches!=='undefined'?caches.default:null;
    const hit=cache?await cache.match(key):null;
    if(hit){const h=new Headers(hit.headers);h.set('X-Catalog-Cache','HIT');return new Response(hit.body,{status:hit.status,headers:h});}
    const {result,rowsRead,sqlMs}=await memo('page:'+canonical.search,()=>queryCatalog(q,env),TTL);
    const response=json(result,200,{'Cache-Control':`public, max-age=0, s-maxage=${TTL}`,'X-Catalog-Cache':'MISS','X-Catalog-SQL-Ms':String(sqlMs.toFixed(3)),'X-Catalog-Rows-Read':String(rowsRead)});
    if(cache)ctx.waitUntil(cache.put(key,response.clone()));
    return response;
  }catch(error){
    const status=error.status||503;
    console.error('catalog_query_failed',{code:error.code||'catalog_temporarily_unavailable',message:error.message});
    return json({ok:false,error:error.code||'catalog_temporarily_unavailable',message:error.status?error.message:'No se pudo consultar el catálogo. Intenta nuevamente en unos segundos.'},status,{'Cache-Control':'no-store','Retry-After':'3'});
  }
}};
