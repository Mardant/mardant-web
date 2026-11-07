import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../js/calendario-home.js',import.meta.url),'utf8');
const {chooseLaunches,peruToday}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
const today='2026-11-05';
const make=(suffix,extra={})=>({code:'MD-'+suffix,section:'lanzamientos',image:'images/MD-'+suffix+'-1234567890abcdef.webp',end_date:'2026-11-30',...extra});
const pool=['22222','22223','22224','22225','22226','22227','22228'].map(x=>make(x));

test('homepage follows the Peru day even when Japan has advanced',()=>{
  assert.equal(peruToday(new Date('2026-11-07T21:00:00Z')),'2026-11-07');
});

test('picks three distinct eligible releases without changing the source',()=>{
  const before=JSON.stringify(pool),picked=chooseLaunches(pool,3,[],()=>0.3,today);
  assert.equal(picked.length,3);assert.equal(new Set(picked.map(x=>x.code)).size,3);assert.equal(JSON.stringify(pool),before);
});
test('the next rotation excludes the currently shown products when enough exist',()=>{
  const previous=pool.slice(0,3).map(x=>x.code),picked=chooseLaunches(pool,3,previous,()=>0,today);
  assert.ok(picked.every(item=>!previous.includes(item.code)));assert.equal(picked.length,3);
});
test('excludes expired releases, unrelated stock, external images and duplicate codes',()=>{
  const items=[pool[0],pool[0],make('33333',{end_date:'2026-11-04'}),make('44444',{section:'pokemon'}),make('55555',{image:'https://example.test/photo.jpg'}),make('66666',{end_date:null})];
  assert.deepEqual(chooseLaunches(items,3,[],()=>0,today).map(x=>x.code),[pool[0].code]);
});
test('handles an empty or small catalog and can pick from either end of the pool',()=>{
  assert.deepEqual(chooseLaunches([],3,[],()=>0,today),[]);
  assert.equal(chooseLaunches(pool.slice(0,1),3,[],()=>0,today).length,1);
  assert.notEqual(chooseLaunches(pool,3,[],()=>0,today)[0].code,chooseLaunches(pool,3,[],()=>0.999,today)[0].code);
});
