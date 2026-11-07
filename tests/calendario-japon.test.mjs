import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/calendario-japon.js',import.meta.url),'utf8');
function api(fetch=()=>{throw Error('unexpected fetch');}){
  const context=vm.createContext({Intl,Date,AbortController,setTimeout,clearTimeout,fetch});
  vm.runInContext(source+`;let renders=0;render=()=>{renders++;};globalThis.api={todayPeru,currentRange,rangeLabel,matchesPeriod,loadCatalog,getCatalog:()=>catalog,getRenders:()=>renders};`,context);
  return context.api;
}
test('uses the Peru date while Japan is already on the next day',()=>{
  const app=api();
  assert.equal(app.todayPeru(new Date('2026-11-07T21:00:00Z')),'2026-11-07');
  assert.equal(app.todayPeru(new Date('2026-11-08T04:59:59Z')),'2026-11-07');
  assert.equal(app.todayPeru(new Date('2026-11-08T05:00:00Z')),'2026-11-08');
  assert.equal(app.rangeLabel(['2026-11-07','2026-11-07'],'day'),'Hoy 7 de noviembre');
});
test('day, week and month ranges preserve the selected Peru calendar dates',()=>{
  const app=api(),plain=value=>Array.from(value);
  assert.deepEqual(plain(app.currentRange('day','2026-11-07')),['2026-11-07','2026-11-07']);
  assert.deepEqual(plain(app.currentRange('week','2026-11-01')),['2026-10-26','2026-11-01']);
  assert.deepEqual(plain(app.currentRange('month','2026-11-30')),['2026-11-01','2026-11-30']);
  assert.equal(app.matchesPeriod({date_type:'exact_date',start_date:'2026-11-07',end_date:'2026-11-07'},['2026-11-07','2026-11-07'],'day'),true);
  assert.equal(app.matchesPeriod({date_type:'week',start_date:'2026-11-01',end_date:'2026-11-07'},['2026-11-07','2026-11-07'],'day'),false);
});
test('refresh accepts new versions, preserves preorder order and retains data after network failure',async()=>{
  const make=code=>({code,section:'preventas',image:'images/'+code+'-1234567890abcdef.webp'});
  let version='first',failed=false,calls=0;
  const app=api(async(url,options)=>{
    calls++;assert.equal(options.cache,'no-cache');assert.equal(options.credentials,'omit');
    if(failed)throw Error('offline');
    return {ok:true,json:async()=>({schema:1,generated_at:version,products:[make('MD-ZZZZZ'),make('MD-AAAAA')]})};
  });
  await app.loadCatalog();assert.equal(app.getRenders(),1);
  assert.deepEqual(Array.from(app.getCatalog().products,p=>p.code),['MD-ZZZZZ','MD-AAAAA']);
  await app.loadCatalog();assert.equal(app.getRenders(),1);
  version='second';await app.loadCatalog();assert.equal(app.getRenders(),2);
  failed=true;await app.loadCatalog();assert.equal(app.getRenders(),2);assert.equal(app.getCatalog().generated_at,'second');assert.equal(calls,4);
});
