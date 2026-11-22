"use strict";
const fs=require("fs"),L=require("./backtest-lib.js");
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
const C=[];const ok=(ad,v,d)=>C.push({ad:ad,ok:!!v,d:d||""});
const S=2025,R=10;
function kopya(){return JSON.parse(JSON.stringify(ds));}
function bozGelecek(d){ // R ve sonrasını (hedef turun quali'si hariç) ters/uçuk veriyle değiştir
  d.seasons[S].races.forEach(r=>{ if(r.round>R){ r.results.forEach(x=>{x.position=String(21-parseInt(x.position,10)||1);x.points="99";x.grid="1";}); r.qualifying.forEach(x=>{x.position="1";}); }
    if(r.round===R){ r.results.forEach(x=>{x.position="20";x.points="0";x.status="X";}); } });
  if(d.seasons[S+1]){ d.seasons[S+1].races.forEach(r=>r.results.forEach(x=>{x.points="77";})); } return d; }
function bosGelecek(d){ d.seasons[S].races=d.seasons[S].races.filter(r=>r.round<=R).map(r=>{ if(r.round===R){r=JSON.parse(JSON.stringify(r)); r.results=[];} return r;}); delete d.seasons[S+1]; return d; }
async function feat(d,mod,ids){const {tv,taklit}=L.veriKatmani(d);const f=await Promise.all(ids.map(x=>tv.ozellik({season:S,round:R,driver:x,mode:mod})));return {f:f,log:taklit.log,tv:tv};}
(async()=>{
 const race=ds.seasons[S].races.filter(r=>r.round===R)[0],ids=race.results.map(x=>x.Driver.driverId);
 for(const mod of ["PRE_WEEKEND","POST_QUALIFYING"]){
  // 1) sızıntı: gelecek bozulsa da / hiç olmasa da özellikler aynı
  const a=await feat(ds,mod,ids),b=await feat(bozGelecek(kopya()),mod,ids),c=await feat(bosGelecek(kopya()),mod,ids);
  ok("L1 sızıntı 0 (gelecek bozuk) "+mod,JSON.stringify(a.f)===JSON.stringify(b.f));
  ok("L2 sızıntı 0 (gelecek yok) "+mod,JSON.stringify(a.f)===JSON.stringify(c.f));
  // 2) deterministik
  const a2=await feat(ds,mod,ids);ok("D1 aynı yarış aynı özellik "+mod,JSON.stringify(a.f)===JSON.stringify(a2.f));
  const p1=L.TM.racePredict(a.f.filter(x=>x.durum==="ok")),p2=L.TM.racePredict(a2.f.filter(x=>x.durum==="ok"));
  ok("D2 aynı yarış aynı tahmin "+mod,JSON.stringify(p1)===JSON.stringify(p2));
  ok("D3 tahmin gelecek bozulsa aynı "+mod,JSON.stringify(p1)===JSON.stringify(L.TM.racePredict(b.f.filter(x=>x.durum==="ok"))));
  // 5) cache: aynı örnek ikinci geçişte 0 yeni istek
  const n0=a.log.length;await Promise.all(ids.map(x=>a.tv.ozellik({season:S,round:R,driver:x,mode:mod})));ok("C1 cache 0 yeni istek "+mod,a.log.length===n0,"istek "+n0);
 }
 // 3) PRE/POST ayrı: PRE hedef tur quali'sinden bağımsız; POST bağımlı
 const dq=kopya();dq.seasons[S].races.filter(r=>r.round===R)[0].qualifying.forEach(x=>{x.position=String(21-parseInt(x.position,10));});
 const pre1=await feat(ds,"PRE_WEEKEND",ids),pre2=await feat(dq,"PRE_WEEKEND",ids),po1=await feat(ds,"POST_QUALIFYING",ids),po2=await feat(dq,"POST_QUALIFYING",ids);
 ok("M1 PRE hedef quali'den bağımsız",JSON.stringify(pre1.f)===JSON.stringify(pre2.f));
 ok("M2 POST hedef quali'ye bağlı",JSON.stringify(po1.f)!==JSON.stringify(po2.f));
 const pp=L.TM.racePredict(pre1.f.filter(x=>x.durum==="ok")),pq=L.TM.racePredict(po1.f.filter(x=>x.durum==="ok"));
 ok("M3 PRE ≠ POST tahmin",JSON.stringify(pp.suruculer.map(s=>s.winProbability))!==JSON.stringify(pq.suruculer.map(s=>s.winProbability)));
 // 4) baseline
 const bp=L.bazPre(ds,S,R,ids),bq=L.bazPost(ds,S,R,ids),sum=a=>a.reduce((x,y)=>x+y,0);
 ok("B1 baseline PRE toplam win=1, podyum=3",Math.abs(sum(bp.win)-1)<1e-6&&Math.abs(sum(bp.pod)-3)<1e-6);
 ok("B2 baseline POST pole en yüksek",bq.ids[bq.win.indexOf(Math.max.apply(null,bq.win))]===race.qualifying.filter(q=>q.position==="1")[0].Driver.driverId);
 ok("B3 baseline olasılık ≤1",bp.pod.concat(bq.pts).every(x=>x<=1+1e-9));
 const pts=L.sezonPuanlari(ds,S,R);let mx=0;ds.seasons[S].races.filter(r=>r.round<R).forEach(()=>{});
 ok("B4 baseline puanı yalnız R'den önceki turlar",(()=>{const t={};ds.seasons[S].races.filter(r=>r.round<R).forEach(r=>r.results.forEach(x=>{t[x.Driver.driverId]=(t[x.Driver.driverId]||0)+Number(x.points||0);}));return Object.keys(t).every(k=>Math.abs(t[k]-(pts[k]||0))<1e-9);})());
 // 6) Brier / log loss elle
 const sat=[{ids:["a","b","c"],win:[0.6,0.3,0.1],pod:[0.9,0.8,0.3],pts:[1,0.5,0.5],gercek:{win:{a:1,b:0,c:0},pod:{a:1,b:1,c:0},pts:{a:1,b:1,c:0}}},
            {ids:["a","b","c"],win:[0.2,0.5,0.3],pod:[0.5,0.9,0.6],pts:[0.5,0.5,0.5],gercek:{win:{a:0,b:0,c:1},pod:{a:0,b:1,c:1},pts:{a:0,b:0,c:1}}}];
 const m=L.olc(sat),el=(0.16+0.09+0.01+0.04+0.25+0.49)/6;
 ok("S1 Brier(win) elle",Math.abs(m.brierWin-el)<1e-9,m.brierWin+" vs "+el);
 ok("S2 log loss elle",Math.abs(m.logLossWin-(-Math.log(0.6)-Math.log(0.3))/2)<1e-9);
 ok("S3 top1/top3 elle",m.top1===0.5&&m.top3===1);
 ok("S4 beceri skoru",Math.abs(L.beceriSkoru(0.03,0.04)-0.25)<1e-12);
 // 7) kova elle
 const k=L.kovalar(sat,"win",[0,0.1,0.2,0.3,0.4,1.0001],2);
 const say=k.map(x=>x.n);ok("K1 kova sayıları",JSON.stringify(say)===JSON.stringify([0,1,1,2,2]),JSON.stringify(say));
 ok("K2 kova gözlenen oran",Math.abs(k[3].gozlenen-0.5)<1e-9&&Math.abs(k[3].ortTahmin-0.3)<1e-9,JSON.stringify(k[3]));
 ok("K3 yetersiz örnek işaretli",k[1].yeterliOrnek===false&&L.kovalar(sat,"win",[0,1.0001],6)[0].yeterliOrnek===true);
 ok("K4 kova toplamı=satır",sum(say)===6);
 // 8) gerçek backtest kayıt sağlaması
 const T=await L.calistir(ds,{tv:L.veriKatmani(ds).tv,sezonlar:[2025],modlar:["PRE_WEEKEND"]});
 ok("G1 2025: 24 yarış kayıtlı",T.length===24,T.length);
 ok("G2 her yarışta tek kazanan gerçek",T.every(t=>Object.keys(t.gercek.win).filter(d=>t.gercek.win[d]===1).length===1));
 console.log(JSON.stringify(C));
})();
