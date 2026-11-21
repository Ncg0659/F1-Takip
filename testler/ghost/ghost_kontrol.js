"use strict";
const G=require("/home/claude/f1-takip/ghost-hesap.js"),PS=require("/home/claude/f1-takip/pist-siluetleri.js"),TVm=require("/home/claude/f1-takip/telemetry-data.js"),S=require("./ghost_sentetik.js");
const K=[],ok=(a,v,d)=>K.push({ad:a,ok:!!v,d:d===undefined?"":String(d)}),js=JSON.stringify;
const B0=Date.parse("2026-10-04T05:00:00Z");
function ornekler(o,drv,lap){ const u=S.turUret(o), norm=TVm.orneklerNormalle(u.car.map(r=>Object.assign({session_key:100,driver_number:drv},r)),{session:100,driver:drv,lap,start:o.startMs,konum:TVm.konumlariNormalle(u.loc.map(r=>Object.assign({session_key:100,driver_number:drv},r)),100,drv),stint:null,pit:false}); return {u,norm}; }
const oA={id:"suzuka",T:89.871,c:0.020,k:3,p0:0.37,ayna:true,aci:33,startMs:B0,gazEksik:40}, oB={id:"suzuka",T:90.100,c:0.015,k:3,p0:0.37,ayna:true,aci:33,startMs:B0+500};
const a=ornekler(oA,1,3), b=ornekler(oB,44,2);
const mk=(norm,T,lap)=>({tur:{lap,duration:T,s1:30,s2:30,s3:T-60,pitOut:false},telemetri:{session:100,driver:norm[0].driver,ornekler:norm,konumVar:true}});
const sA=mk(a.norm,oA.T,3),sB=mk(b.norm,oB.T,2), R=G.karsilastir(sA,sB);
ok("H1 karşılaştırma ok; A/B tur süreleri ve fark gerçek lap_duration'dan (B−A)",R.durum==="ok"&&R.a.sure===89.871&&R.b.sure===90.1&&Math.abs(R.turFarki-0.229)<1e-9);
ok("H2 delta tur başında tam 0",R.delta.noktalar[0].delta===0&&R.delta.noktalar[0].s===0);
// analitik gerçek: delta(s) = tB(s) − tA(s) (referans: ilk örnek ≈ 0)
let enKotu=0,n=0;const prA=S.profil(oA.T,oA.c,oA.k),prB=S.profil(oB.T,oB.c,oB.k);R.delta.noktalar.forEach(p=>{ if(p.delta==null||p.s==null)return; const ts=p.t/1000, tr=S.tOf(prB,prA.p(ts))-ts; enKotu=Math.max(enKotu,Math.abs(p.delta-tr)); n++; });
ok("H3 delta analitik gerçeğe uyar (maks sapma ≤ 0.04 s)",n>250&&enKotu<0.04,"n="+n+" sapma="+enKotu.toFixed(4));
ok("H4 tur sonu delta ≈ lap süresi farkı (±0.05 s)",Math.abs(R.delta.son-0.229)<0.05,R.delta.son);
ok("H5 bic biçimi: +0.123 / −0.084 / ±0.000",G.bic(0.123)==="+0.123"&&G.bic(-0.084)==="−0.084"&&G.bic(0)==="±0.000");
ok("H6 deterministik: aynı girdi → aynı çıktı",js(G.karsilastir(sA,sB))===js(R));
// eksik alan null (uydurma yok)
const eksik=R.a.prog.noktalar.filter(p=>p.throttle===null&&p.brake===null);
ok("M1 eksik gaz/fren örnekleri null kalır (0 yazılmaz)",eksik.length>5&&eksik.every(p=>p.speed!=null),eksik.length);
ok("M2 eksik alanlı örnekte hız/mesafe yine hesaplanır; delta sürer",R.delta.noktalar.every(p=>p.delta!=null));
// kopuk bölge: B'de ortadan 3 sn veri sil → boşluk içi null, boşluk sonrası delta YENİDEN başlar (tur sonuna bağlı), boşluk köprülenmez
const kesB=b.norm.filter(r=>!(r.t>40000&&r.t<43000)), sKB=mk(kesB,oB.T,2), RK=G.karsilastir(sA,sKB), dk=RK.delta.noktalar, nulls=dk.filter(p=>p.delta===null);
ok("K1 B'de 3 sn boşluk: yalnız boşluğa denk gelen A örnekleri null (≈3 sn), geri kalan delta dolu",nulls.length>=8&&nulls.length<=16&&nulls.every(p=>p.t>39000&&p.t<44500),nulls.length);
ok("K2 boşluktan ÖNCE delta, boşluksuz hesapla birebir aynı (baş bölge değişmez)",dk.filter(p=>p.t<39000).every(p=>p.delta===R.delta.noktalar[dk.indexOf(p)].delta));
const sonra=dk.filter(p=>p.t>=44500);
ok("K2b boşluktan SONRA delta yeniden başlar (tüm örnekler dolu) ve tur sonunda gerçek tur farkıyla tutarlı (±0.06 sn)",sonra.length>50&&sonra.every(p=>p.delta!==null)&&Math.abs(RK.delta.son-0.229)<0.06,RK.delta.son);
ok("K2c boşluk köprülenmedi: B'nin boşluk içinde örneği yok; B segment sayısı 2, A 1; hiçbir delta B'nin olmayan bölgesinde üretilmedi",RK.b.prog.segmentSayisi===2&&RK.a.prog.segmentSayisi===1&&RK.b.prog.noktalar.every(p=>!(p.t>40000&&p.t<43000)));
ok("K2d segment içi sıçrama yok (ardışık adım ≤ 0.10 sn; boşluk üstündeki fark sayılmaz)",(()=>{let mx=0;for(let i=1;i<dk.length;i++)if(dk[i].delta!=null&&dk[i-1].delta!=null)mx=Math.max(mx,Math.abs(dk[i].delta-dk[i-1].delta));return mx<=0.10;})());
// A'da boşluk (simetri)
const kesA=a.norm.filter(r=>!(r.t>40000&&r.t<43000)), RA2=G.karsilastir(mk(kesA,oA.T,3),sB), na=RA2.delta.noktalar;
ok("K1b A'da boşluk: A'nın örnekleri boşlukta yok; sonrası delta dolu (yeniden başlar)",RA2.a.prog.segmentSayisi===2&&na.filter(p=>p.t>=43000).every(p=>p.delta!==null)&&na.filter(p=>p.t<40000).every(p=>p.delta!==null)&&Math.abs(RA2.delta.son-0.229)<0.06,RA2.delta.son);
// kapsam düşük (tur süresinin %60'ı) → delta yok
const yarim=a.norm.filter(r=>r.t<oA.T*1000*0.6), RY=G.karsilastir(mk(yarim,oA.T,3),sB);
ok("K3 telemetri kapsamı <%90 → delta üretilmez (neden telemetri-eksik)",RY.delta.noktalar.length===0&&RY.delta.neden==="telemetri-eksik"&&RY.delta.son===null);
// tek hız örneği null → o örnek null; sonrası yeniden başlar
const hizsiz=a.norm.map((r,i)=>i===100?Object.assign({},r,{speed:null}):r), RH=G.karsilastir(mk(hizsiz,oA.T,3),sB);
ok("K4 hız örneği eksik: o örnekte delta null (mesafe uydurulmaz); öncesi ve sonrası delta dolu",RH.delta.noktalar[100].delta===null&&RH.delta.noktalar[50].delta!=null&&RH.delta.noktalar.slice(106).every(p=>p.delta!=null));
// boşluk sonrası yeterli gerçek veri yoksa (<5 ardışık örnek) delta yeniden başlamaz
const az=a.norm.filter((r,i)=>i<150||i>a.norm.length-4), RZ=G.karsilastir(mk(az,oA.T,3),sB);
ok("K5 boşluk sonrası <5 gerçek örnek → delta yeniden BAŞLAMAZ (yetersiz veri)",RZ.durum==="ok"&&RZ.delta.noktalar.slice(-3).every(p=>p.delta===null));
// interpolasyon yalnız gerçek örnekler arasında
const pr=G.ilerleme(a.norm,oA.T), son=pr.noktalar[pr.noktalar.length-1];
ok("I1 zamanS: aralık dışı → null (ekstrapolasyon yok)",G.zamanS(pr.noktalar,1.2)===null&&G.zamanS(pr.noktalar,-0.1)===null);
const i0=pr.noktalar[10],i1=pr.noktalar[11],mid=G.zamanS(pr.noktalar,(i0.s+i1.s)/2);
ok("I2 zamanS iki gerçek örnek arasında doğrusal",Math.abs(mid-(i0.t+i1.t)/2)<1e-6&&mid>i0.t&&mid<i1.t);
ok("I3 örnek noktasında interpolasyon yok (tam gerçek değer)",G.zamanS(pr.noktalar,pr.noktalar[30].s)===pr.noktalar[30].t);
// farklı session / aynı tur
ok("S1 farklı oturum karşılaştırması engellenir",G.karsilastir(sA,Object.assign({},sB,{telemetri:Object.assign({},sB.telemetri,{session:200})})).durum==="gecersiz"&&G.karsilastir(sA,Object.assign({},sB,{telemetri:Object.assign({},sB.telemetri,{session:200})})).neden==="farkli-oturum");
ok("S2 aynı pilot+aynı tur engellenir; aynı pilot farklı tur serbest",G.karsilastir(sA,sA).durum==="gecersiz"&&G.karsilastir(sA,mk(a.norm,oA.T,4)).durum==="ok");
ok("S3 eksik girdi güvenli",G.karsilastir(null,sB).durum==="gecersiz"&&G.karsilastir(sA,{}).durum==="gecersiz");
// sektörler null
const sN=mk(b.norm,oB.T,2);sN.tur.s2=null;const RS=G.karsilastir(sA,sN);
ok("S4 eksik sektör süresi null; fark null",RS.sektorler[1].b===null&&RS.sektorler[1].fark===null&&RS.sektorler[0].fark===0);
// konum replay
const seri=G.konumSeri(a.norm);
ok("L1 konumSeri yalnız gerçek x/y olan örnekleri alır",seri.length>200&&seri.length<=a.norm.length&&seri.every(p=>typeof p.x==="number"&&typeof p.y==="number"));
const noloc=a.norm.map(r=>Object.assign({},r,{x:null,y:null}));
ok("L2 x/y yoksa seri boş → konumZaman 'yok' (fallback konum üretilmez)",G.konumSeri(noloc).length===0&&G.konumZaman(G.konumSeri(noloc),5000).durum==="yok"&&G.konumZaman(G.konumSeri(noloc),5000).x===null);
ok("L3 ilk örnekten önce 'yok'; son örnekten sonra 'bitti' ve SON GERÇEK konumda",G.konumZaman(seri,seri[0].t-1).durum==="yok"&&(()=>{const p=G.konumZaman(seri,1e9);return p.durum==="bitti"&&p.x===seri[seri.length-1].x&&p.y===seri[seri.length-1].y;})());
const m=G.konumZaman(seri,(seri[5].t+seri[6].t)/2);
ok("L4 iki gerçek örnek arası doğrusal (yalnız görsel yumuşatma)",m.durum==="canli"&&Math.abs(m.x-(seri[5].x+seri[6].x)/2)<1e-6);
const delikli=seri.filter(p=>!(p.t>20000&&p.t<23000)),g=G.konumZaman(delikli,21500);
ok("L5 >1.5 sn konum boşluğunda işaretçi gizlenir (tahmin yok)",g.durum==="bosluk"&&g.x===null);
ok("L6 örnek anında tam gerçek konum",(()=>{const p=G.konumZaman(seri,seri[40].t);return p.x===seri[40].x&&p.y===seri[40].y;})());
// pist dönüşümü
let bad=0,cnt=0,worst=0,dir=0;
Object.keys(PS.YOL).forEach(id=>{[false,true].forEach(ay=>[19,141,282].forEach(ac=>{ const u=S.turUret({id,T:90,c:.02,k:3,p0:.21,ayna:ay,aci:ac,startMs:0}); const Q=u.loc.map(r=>({x:r.x,y:r.y})); const T=G.pistDonusumu(PS.YOL[id],Q); cnt++; if(T.durum!=="ok"){bad++;return;} worst=Math.max(worst,T.hata); if(T.ayna===ay)dir++; })); });
ok("T1 pist dönüşümü her pist × ayna/döndürme için bulunur (hata ≤ eşik)",bad===0&&cnt>=100,"bad="+bad+"/"+cnt+" en kötü hata "+worst.toFixed(4));
ok("T2 dönüşüm yalnız benzerlik: ölçek>0, aci hesaplı; ayna doğru çıkarılır",dir===cnt,dir+"/"+cnt);
const Tz=G.pistDonusumu(PS.YOL.suzuka,S.turUret({id:"suzuka",T:90,c:.02,k:3,p0:.4,ayna:true,aci:33,startMs:0}).loc);
ok("T3 aynı girdi aynı dönüşüm (deterministik)",js(Tz)===js(G.pistDonusumu(PS.YOL.suzuka,S.turUret({id:"suzuka",T:90,c:.02,k:3,p0:.4,ayna:true,aci:33,startMs:0}).loc)));
// yapıştırma yok: dönüştürülmüş nokta ham noktanın doğrusal görüntüsü; gürültülü nokta çizgiden uzak kalabilir
const u2=S.turUret({id:"suzuka",T:90,c:.02,k:3,p0:.4,ayna:true,aci:33,startMs:0}); const gur=u2.loc.map((r,i)=>i===50?{x:r.x+400,y:r.y}:{x:r.x,y:r.y}); const Tg=G.pistDonusumu(PS.YOL.suzuka,gur);
const a50=G.uygula(Tg,gur[50].x,gur[50].y),a49=G.uygula(Tg,gur[49].x,gur[49].y),b49=G.uygula(Tz,gur[49].x,gur[49].y);
ok("T4 snap yok: sapmış nokta çizgiye çekilmez (dönüşüm bütün noktalara aynı doğrusal)",Math.hypot(a50.x-a49.x,a50.y-a49.y)>5&&Math.hypot(a49.x-b49.x,a49.y-b49.y)<1.5);
ok("T5 yetersiz/uygunsuz veri: konum yok → veri-yok; çizimle ilgisiz bulutlar → uygun-degil",G.pistDonusumu(PS.YOL.suzuka,[]).durum==="veri-yok"&&G.pistDonusumu(PS.YOL.suzuka,Array.from({length:300},(_,i)=>({x:i*10,y:(i*i)%97}))).durum==="uygun-degil"&&G.pistDonusumu(PS.YOL.suzuka,Array.from({length:300},(_,i)=>({x:1000*Math.cos(i/47.7),y:1000*Math.sin(i/47.7)}))).durum==="uygun-degil"&&G.pistDonusumu(PS.YOL.suzuka,Array.from({length:300},(_,i)=>({x:5+i*1e-6,y:7}))).durum!=="ok");
// UI kaynak taraması
const fs=require("fs"),ui=fs.readFileSync("/home/claude/f1-takip/ghost-lap.js","utf8")+fs.readFileSync("/home/claude/f1-takip/ghost-hesap.js","utf8");
const kod=ui.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"");
ok("G1 kodda (yorum satırları hariç) yasak konu yok: fren sıcaklığı/lastik enerjisi/ERS/batarya/traction/yarış çizgisi/yorum",!/brake\s*temp|fren s[ıi]cakl|tyre energy|lastik enerji|\bERS\b|batarya|traction|çekiş|racing line|yarış çizgisi kalite|daha iyi fren/i.test(kod),kod.match(/brake\s*temp|fren s[ıi]cakl|tyre energy|lastik enerji|\bERS\b|batarya|traction|çekiş|racing line|yarış çizgisi kalite|daha iyi fren/i));
ok("G2 kaynakta polling/timer/WebSocket yok (yalnız oynatırken requestAnimationFrame)",!/setInterval|setTimeout|WebSocket|EventSource|sendBeacon/.test(ui)&&/requestAnimationFrame/.test(ui));
ok("G3 kaynakta doğrudan fetch/XMLHttpRequest yok (veri yalnız TelemetriVeri üzerinden)",!/\bfetch\s*\(|XMLHttpRequest/.test(ui));
console.log(js(K));
