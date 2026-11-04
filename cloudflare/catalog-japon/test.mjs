import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker,{normalize,plan,grams} from './worker.mjs';
const db=new DatabaseSync(':memory:');
const source=`CREATE TABLE productos_japon(id_lote TEXT PRIMARY KEY,lote_num INTEGER NOT NULL DEFAULT 0,etiqueta TEXT,anime TEXT,tipo TEXT,busqueda TEXT,precio_producto TEXT,precio_num REAL,imagen_url TEXT,rank TEXT,plataforma TEXT,origen TEXT,fuente TEXT,activo INTEGER NOT NULL DEFAULT 1,payload_hash TEXT,creado_en TEXT DEFAULT CURRENT_TIMESTAMP,actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP,visto_ultima_vez TEXT,visible TEXT,ultima_revision TEXT,source_seq INTEGER DEFAULT 0)`;
db.exec(source);
const ins=db.prepare('INSERT INTO productos_japon(id_lote,lote_num,etiqueta,anime,tipo,busqueda,precio_producto,precio_num,imagen_url,rank,activo,visible) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
for(let i=1;i<=4000;i++)ins.run(String(i),i,i%5===0?'PREVENTA':'DISPONIBLE',i%3===0?'One Piece':i%3===1?'Uma Musume':'ドラゴンボール','Figura',i%7===0?'MAFEX Spider-Man 2.0':i%11===0?'amazon Miku 100%_x':'Bandai '+i,'S/ '+i,i%19===0?null:i%500,'https://example.com/'+i+'.jpg',i%17===0?'A':'',i%9===0?0:1,i%9===0?'NO':i%23===0?null:'SI');
db.exec(readFileSync(new URL('migration.sql',import.meta.url),'utf8'));
const template=readFileSync(new URL('backfill.sql.template',import.meta.url),'utf8');
db.prepare(template).run(0,2000);
// Exercise updates to a backfilled row, an unbackfilled row, deletes and live inserts.
db.exec("UPDATE productos_japon SET activo=0,visible='NO' WHERE id_lote='7'; UPDATE productos_japon SET busqueda='MAFEX Rem ねんどろいど' WHERE id_lote='3999'; DELETE FROM productos_japon WHERE id_lote='3998';");
ins.run('4001',4001,'DISPONIBLE','Uma Musume','Figura','MAFEX New','S/ 10',10,'https://example.com/new.jpg','',1,'SI');
db.prepare(template).run(0,5000); // Idempotent resume also encounters already-live entries.
db.exec('UPDATE catalog_build_v2 SET ready=1 WHERE id=1');
function checkState(){
 const original=db.prepare("SELECT COUNT(*) n FROM productos_japon WHERE activo=1 AND UPPER(COALESCE(visible,'SI'))='SI'").get().n;
 assert.equal(db.prepare('SELECT COUNT(*) n FROM catalog_public_v2').get().n,original);
 assert.equal(db.prepare('SELECT SUM(total) n FROM catalog_counts_v2').get().n,original);
 db.exec("INSERT INTO catalog_search_v2(catalog_search_v2,rank) VALUES('integrity-check',1)");
 assert.equal(db.prepare('SELECT COUNT(*) n FROM catalog_public_v2 c LEFT JOIN productos_japon p ON p.rowid=c.source_rowid WHERE p.rowid IS NULL OR p.activo<>1').get().n,0);
}
checkState();
let sqlCalls=0;
const DB={prepare(sql){return{bind(...args){return {all:async()=>{sqlCalls++;return {results:db.prepare(sql).all(...args),meta:{rows_read:0,duration:0}}}}},all:async()=>{sqlCalls++;return {results:db.prepare(sql).all(),meta:{}}}}}};
let tested=0;
async function request(params){const r=await worker.fetch(new Request('https://test.example/?'+new URLSearchParams({accion:'catalogoPreventasJaponPage',...params})),{DB},{waitUntil(){}});return {status:r.status,data:await r.json()};}
function legacy(params){
 const q=normalize(new URL('https://example.com/?'+new URLSearchParams(params)));let where=["activo=1","UPPER(COALESCE(visible,'SI'))='SI'"],args=[];
 for(const term of q.terms){where.push('('+['id_lote','etiqueta','anime','tipo','busqueda'].map(f=>`instr(LOWER(COALESCE(${f},'')),?)>0`).join(' OR ')+')');args.push(...Array(5).fill(term));}
 if(q.anime){where.push('anime=? COLLATE NOCASE');args.push(q.anime);}
 if(q.availability==='preventa')where.push("(LOWER(COALESCE(etiqueta,''))='preventa' OR LOWER(COALESCE(busqueda,'')) LIKE '%amazon%')");
 if(q.availability==='disponible')where.push("NOT (LOWER(COALESCE(etiqueta,''))='preventa' OR LOWER(COALESCE(busqueda,'')) LIKE '%amazon%')");
 if(q.availability==='rank')where.push("TRIM(COALESCE(rank,''))<>''");
 if(q.min!==null){where.push('precio_num>=?');args.push(q.min);} if(q.max!==null){where.push('precio_num<=?');args.push(q.max);}
 const w=where.join(' AND '),total=db.prepare('SELECT COUNT(*) n FROM productos_japon WHERE '+w).get(...args).n;
 const page=Math.min(q.page,Math.max(1,Math.ceil(total/q.page_size))),order=q.sort==='newest'?'lote_num DESC':`(precio_num IS NULL),precio_num ${q.sort==='price_asc'?'ASC':'DESC'},lote_num DESC`;
 const rows=db.prepare(`SELECT id_lote FROM productos_japon WHERE ${w} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args,q.page_size,(page-1)*q.page_size);
 return{total,page,ids:rows.map(x=>x.id_lote)};
}
for(const search of ['', 'MAFEX','maf','Spider-Man','miku','one piece','uma musume','ドラゴン','ねんどろいど','100%_x','"OR"','zzzzzz','Mafex 2.0']){
 for(const filter of [{},{anime:'Uma Musume'},{availability:'preventa'},{availability:'disponible',min_price:'20',max_price:'200'},{availability:'rank'},{sort:'price_asc',page:'2'},{sort:'price_desc',page:'999999'}]){
  const p={search,...filter},expected=legacy(p),r=await request(p);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.total,expected.total,JSON.stringify(p));assert.equal(r.data.page,expected.page);assert.deepEqual(r.data.productos.map(x=>x.id_lote),expected.ids,JSON.stringify(p));tested++;
 }
}
const meta=await request({include_meta:'1'});assert(meta.data.animes.includes('One Piece'));assert(meta.data.animes.includes('ドラゴンボール'));
assert.equal((await request({search:'ab'})).data.error,'search_too_short');
assert.equal((await request({search:'x'.repeat(161)})).status,400);
assert.equal((await worker.fetch(new Request('https://example.com/',{method:'POST'}),{DB},{})).status,405);
assert.equal((await worker.fetch(new Request('https://example.com/',{method:'OPTIONS'}),{DB},{})).status,200);
assert.equal((await request({min_price:'300',max_price:'1'})).data.total,0);
db.exec("UPDATE productos_japon SET activo=1,visible='SI',busqueda='unusual-restored-figure' WHERE id_lote='7'; UPDATE productos_japon SET busqueda='changed-name-figure' WHERE id_lote='3999'; DELETE FROM productos_japon WHERE id_lote='4001';");
checkState();
assert.equal((await request({search:'unusual-restored'})).data.total,1);
assert.equal((await request({search:'changed-name'})).data.total,1);
// Bookkeeping-only sync updates must not rebuild postings or bump counters.
const before=db.prepare('SELECT total_changes() n').get().n;db.exec("UPDATE productos_japon SET source_seq=source_seq+1,actualizado_en=CURRENT_TIMESTAMP WHERE id_lote='7'");assert.equal(db.prepare('SELECT total_changes() n').get().n-before,1);
const countPlan=plan(normalize(new URL('https://test/?search=MAFEX')));const explain=db.prepare('EXPLAIN QUERY PLAN '+countPlan.countSQL).all(...countPlan.countParams);assert(explain.some(x=>x.detail.includes('VIRTUAL TABLE INDEX')));assert(!explain.some(x=>x.detail==='SCAN c'));
const callsBefore=sqlCalls;
const concurrent=await Promise.all(Array.from({length:20},()=>request({search:'Bandai 123'})));
assert(concurrent.every(r=>r.status===200));assert.equal(sqlCalls-callsBefore,2,'20 identical requests must share a count and a page query');
writeFileSync(new URL('test-results.json',import.meta.url),JSON.stringify({comparisons:tested,integrity:'ok',updates:'ok',idempotentBackfill:'ok',explain},null,2));
writeFileSync(new URL('source-fixture.sql',import.meta.url),source+';');
console.log(JSON.stringify({comparisons:tested,integrity:'ok',updateDeleteRestore:'ok',idempotentBackfill:'ok',coalescedRequests:20,ftsPlan:explain}));
