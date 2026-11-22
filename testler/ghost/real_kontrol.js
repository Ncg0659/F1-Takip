"use strict";
const L=require("./real_lib.js"),G=require("/home/claude/f1-takip/ghost-hesap.js"),PS=require("/home/claude/f1-takip/pist-siluetleri.js"),fs=require("fs");
const K=[],ok=(a,v,d)=>K.push({ad:a,ok:!!v,d:d===undefined?"":String(d)}),js=JSON.stringify,yak=(x,y,t)=>Math.abs(x-y)<=(t||1e-9);
(async()=>{
 const {tv,log}=L.kur(), O=L.OT;
 const tl63=await tv.turlar(O,63),tl81=await tv.turlar(O,81);
 const e63=tv.enHizliTur(tl63.turlar),e81=tv.enHizliTur(tl81.turlar);
 ok("1 enHizliTur gerçek JSON'dan: 63 → tur 16, 81 → tur 2 (hardcode yok)",e63.lap===16&&e81.lap===2,e63.lap+"/"+e81.lap);
 ok("2 gerçek JSON'daki 63 lap_duration 91.056 / 81 lap_duration 92.902",e63.duration===91.056&&e81.duration===92.902);
 const a=await tv.enHizliTurTelemetri(O,63),b=await tv.enHizliTurTelemetri(O,81);
 ok("3 telemetri ok; tur numaraları 16 ve 2",a.durum==="ok"&&b.durum==="ok"&&a.telemetri.lap===16&&b.telemetri.lap===2);
 // sektörler: ham laps JSON ile birebir
 const ham=(d,n)=>L.F.laps[d].find(r=>r.lap_number===n);
 const h63=ham(63,16),h81=ham(81,2),R=G.karsilastir(a,b);
 ok("4 sektör değerleri ham laps JSON ile birebir (63: 26.785/38.406/25.865, 81: 27.334/39.326/26.242)",a.tur.s1===h63.duration_sector_1&&a.tur.s2===h63.duration_sector_2&&a.tur.s3===h63.duration_sector_3&&b.tur.s1===h81.duration_sector_1&&b.tur.s2===h81.duration_sector_2&&b.tur.s3===h81.duration_sector_3&&a.tur.s1===26.785&&b.tur.s3===26.242);
 ok("5 tur farkı B−A = +1.846 sn",yak(R.turFarki,1.846,1e-6)&&G.bic(R.turFarki)==="+1.846",R.turFarki);
 ok("6 sektör farkları S1 +0.549 / S2 +0.920 / S3 +0.377",R.sektorler.map(s=>G.bic(s.fark)).join()==="+0.549,+0.920,+0.377"&&G.bic(R.sektorler[0].fark+R.sektorler[1].fark+R.sektorler[2].fark)==="+1.846");
 // telemetri: gerçek örnekler
 const kaynak=(d,s,e)=>{const m=new Map();L.F.car[d].forEach(r=>m.set(Date.parse(r.date),r));return m;};
 let eslesme=true,aralik=true,alan=true;
 [[a,63,h63],[b,81,h81]].forEach(([x,d,h])=>{const m=kaynak(d),bas=Date.parse(h.date_start),bit=bas+Math.round(x.tur.duration*1000);
  x.telemetri.ornekler.forEach(o=>{const r=m.get(o.timestamp);if(!r){eslesme=false;return;} if(o.timestamp<bas||o.timestamp>bit)aralik=false; if(o.speed!==r.speed||o.throttle!==r.throttle||o.brake!==r.brake||o.gear!==r.n_gear||o.rpm!==r.rpm||o.t!==o.timestamp-bas)alan=false;});});
 ok("7 her telemetri örneği gerçek car_data satırı (üretilmiş örnek yok)",eslesme);
 ok("8 örnekler seçilen turun zaman aralığında; t = timestamp − date_start",aralik);
 ok("9 speed/throttle/brake/gear(n_gear)/rpm değerleri ham veriyle birebir",alan);
 const beklenen=(d,h,x)=>{const bas=Date.parse(h.date_start),bit=bas+Math.round(x.tur.duration*1000);return L.F.car[d].filter(r=>{const t=Date.parse(r.date);return t>=bas&&t<=bit;}).length;};
 ok("10 örnek sayısı = aralıktaki ham car_data satırı sayısı (63: 340, 81: 337)",a.telemetri.ornekler.length===beklenen(63,h63,a)&&b.telemetri.ornekler.length===beklenen(81,h81,b)&&a.telemetri.ornekler.length===340&&b.telemetri.ornekler.length===337,a.telemetri.ornekler.length+"/"+b.telemetri.ornekler.length);
 ok("11 gaz/fren/hız alanları dolu (ham veride null yok → null üretilmedi)",a.telemetri.ornekler.every(o=>o.speed!=null&&o.throttle!=null&&o.brake!=null&&o.gear!=null&&o.rpm!=null));
 // delta
 const d=R.delta.noktalar,gecerli=d.filter(p=>p.delta!=null);
 ok("12 delta tur başında 0",d[0].delta===0&&d[0].s===0);
 ok("13 telemetri kapsamı ≥ eşik (≥0.90): A %"+(R.a.prog.kapsam*100).toFixed(1)+" B %"+(R.b.prog.kapsam*100).toFixed(1),R.a.prog.kapsam>=G.KAPSAM_MIN&&R.b.prog.kapsam>=G.KAPSAM_MIN&&R.delta.neden===null);
 const gap=R.b.prog.noktalar.filter(p=>p.kopukOnce),gi=R.b.prog.noktalar.indexOf(gap[0]),gdt=gap.length?gap[0].t-R.b.prog.noktalar[gi-1].t:0;
 ok("14 B'de gerçek 1240 ms veri boşluğu var (t≈15.8–17.1 sn); B 2 segment, A 1 segment",gap.length===1&&gdt===1240&&R.b.prog.segmentSayisi===2&&R.a.prog.segmentSayisi===1,gap.length+"/"+gdt);
 const nul=d.filter(p=>p.delta==null);
 ok("15 boşluk İÇİNDE delta null: yalnız boşluğa denk gelen A örnekleri (≤ 6 örnek, hepsi t≈15.8–17.1 sn)",nul.length>=1&&nul.length<=6&&nul.every(p=>p.t>=15000&&p.t<=17500),nul.length+" "+nul.map(p=>p.t).join());
 ok("16 boşluktan SONRA delta yeniden başladı (tüm sonraki A örnekleri dolu, tur sonuna kadar)",d.filter(p=>p.t>17500).every(p=>p.delta!=null)&&gecerli.length===d.length-nul.length&&d[d.length-1].delta!=null,gecerli.length+"/"+d.length);
 ok("17 boşluk köprülenmedi: B'nin boşluk içinde örneği yok, B segmentleri ayrı, delta bu aralıkta üretilmedi",R.b.prog.noktalar.every(p=>!(p.t>15829&&p.t<17069))&&gdt===1240&&nul.every(p=>p.delta===null)&&L.F.car[81].filter(r=>{const t=Date.parse(r.date)-Date.parse(ham(81,2).date_start);return t>15829&&t<17069;}).length===0);
 const bolgeAdim=(arr)=>{let mx=0;for(let i=1;i<arr.length;i++)mx=Math.max(mx,Math.abs(arr[i]-arr[i-1]));return mx;};
 const seg1=d.slice(0,d.indexOf(nul[0])).map(p=>p.delta),seg2=d.slice(d.indexOf(nul[nul.length-1])+1).map(p=>p.delta);
 const mx=Math.max(bolgeAdim(seg1),bolgeAdim(seg2));
 ok("18 her segmentin İÇİNDE delta sıçraması yok (ardışık adım ≤ 0.10 sn)",mx<=0.10&&seg1.length>20&&seg2.length>200,"maks "+mx.toFixed(3));
 ok("19 final delta ground truth +1.846 ile tutarlı (|fark| ≤ 0.05 sn; ölçülmeyen tur sonu örnek aralığı payı)",Math.abs(R.delta.son-1.846)<=0.05,R.delta.son);
 console.log("//BILGI "+js({gecerli:gecerli.length,toplam:d.length,nul:nul.length,final:R.delta.son,beklenen:1.846,fark:R.delta.son-1.846,segIciMaksAdim:mx,boslukAtlamasi:seg2[0]-seg1[seg1.length-1]}));
 // konum
 const qa=G.konumSeri(a.telemetri.ornekler),qb=G.konumSeri(b.telemetri.ornekler);
 ok("16 location: gerçek non-zero x/y (63: "+qa.length+", 81: "+qb.length+" eşleşmiş örnek)",qa.length>250&&qb.length>250&&qa.every(p=>p.x!==0||p.y!==0)&&qb.every(p=>p.x!==0||p.y!==0));
 const km=(d,x)=>{const m=new Map();L.F.loc[d].forEach(r=>m.set(Date.parse(r.date),r));return x.telemetri.ornekler.filter(o=>o.x!=null).every(o=>{const best=[...[-150,150]].length; for(const r of L.F.loc[d]){if(Math.abs(Date.parse(r.date)-o.timestamp)<=150&&r.x===o.x&&r.y===o.y)return true;}return false;});};
 ok("17 her x/y gerçek location satırından (±150 ms eşleşme); interpolasyon/üretim yok",km(63,a)&&km(81,b));
 const ra=(s)=>[Math.min(...s.map(p=>p.x)),Math.max(...s.map(p=>p.x)),Math.min(...s.map(p=>p.y)),Math.max(...s.map(p=>p.y))],A=ra(qa),B=ra(qb);
 ok("18 iki pilot aynı koordinat uzayında (x/y aralıkları ≤%2 farkla örtüşür)",Math.abs(A[0]-B[0])<300&&Math.abs(A[1]-B[1])<300&&Math.abs(A[2]-B[2])<300&&Math.abs(A[3]-B[3])<300,js([A,B]));
 const bas=(d,n)=>Date.parse(ham(d,n).date_start);
 ok("19 iki turun başlangıç konumu aynı bölgede (start çizgisi, ≤ 60 m)",Math.hypot(qa[0].x-qb[0].x,qa[0].y-qb[0].y)<600,Math.hypot(qa[0].x-qb[0].x,qa[0].y-qb[0].y).toFixed(0));
 // transform
 const TA=G.pistDonusumu(PS.YOL.marina_bay,qa),TB=G.pistDonusumu(PS.YOL.marina_bay,qb);
 ok("20 pist dönüşümü (marina_bay; oturum 9161 = Singapur): mevcut eşik 0.03, hata < 0.03 her iki pilot için",G.HATA_MAKS===0.03&&TA.durum==="ok"&&TB.durum==="ok"&&TA.hata<0.03&&TB.hata<0.03,js([TA.hata,TB.hata]));
 ok("20b dönüşüm yalnız öteleme+ölçek+döndürme+ayna: tek ölçek (zr,zi), ayna bayrağı; kayma/affine alanı yok; iki pilot aynı dönüşüme ±%2",Object.keys(TA).sort().join()==="aci,ayna,hata,olcek,tx,ty,zi,zr,durum".split(",").sort().join()&&Math.abs(TA.olcek-TB.olcek)/TA.olcek<0.02&&TA.ayna===TB.ayna&&Math.abs(TA.aci-TB.aci)<3,js([TA.olcek,TB.olcek,TA.aci,TB.aci]));
 // snap yok: dönüştürülmüş izin pist çizgisine uzaklığı sıfır değil (gerçek örnekler çizgiye yapıştırılmadı)
 const P=G.yolNoktalari(PS.YOL.marina_bay);const uz=qa.map(q=>{const w=G.uygula(TA,q.x,q.y);let e=1e9;for(let i=0;i<P.length;i++){const A=P[i],B=P[(i+1)%P.length],dx=B.x-A.x,dy=B.y-A.y,L=dx*dx+dy*dy,f=L?Math.max(0,Math.min(1,((w.x-A.x)*dx+(w.y-A.y)*dy)/L)):0;e=Math.min(e,Math.hypot(w.x-(A.x+dx*f),w.y-(A.y+dy*f)));}return e;});
 ok("20c snap yok: dönüştürülmüş gerçek noktaların çizgiye uzaklığı ortalama >0 (yapıştırılmadı), maks < 8 birim",uz.reduce((x,y)=>x+y,0)/uz.length>0.05&&Math.max(...uz)<8,(uz.reduce((x,y)=>x+y,0)/uz.length).toFixed(2)+"/"+Math.max(...uz).toFixed(2));
 console.log("//TRANSFORM "+js({A:TA.hata,B:TB.hata,esik:G.HATA_MAKS}));
 // replay (veri düzeyi): gerçek zaman damgası, farklı süreler, biten pilot son gerçek konumda
 const son63=qa[qa.length-1],son81=qb[qb.length-1],toplam=Math.max(a.tur.duration,b.tur.duration)*1000;
 const k1=G.konumZaman(qa,toplam),k2=G.konumZaman(qb,toplam);
 ok("21 replay süresi uzun tur (92.902 sn); kısa tur 91.056 sn ve son örneğinden sonra pilot SON GERÇEK konumda kalır",toplam===92902&&k1.durum==="bitti"&&k1.x===son63.x&&k1.y===son63.y&&qa[qa.length-1].t<91056+1&&G.konumZaman(qa,91500).durum==="bitti"&&G.konumZaman(qb,91500).durum==="canli");
 const orta=G.konumZaman(qa,45000);
 ok("22 replay ortası: gerçek iki örnek arası doğrusal; örnek anında tam gerçek konum",orta.durum==="canli"&&(()=>{const p=G.konumZaman(qa,qa[100].t);return p.x===qa[100].x&&p.y===qa[100].y;})());
 ok("23 fixture yüklenirken gerçek API çağrısı yok; yalnız taklit (laps/car_data/location) çağrıldı",log.every(x=>/^(laps|car_data|location|stints|pit)\?/.test(x)),log.length);
 const n0=log.length;await tv.enHizliTurTelemetri(O,63);await tv.enHizliTurTelemetri(O,81);await tv.turTelemetri(O,63,16);await tv.turlar(O,63);
 ok("24 cache: aynı driver/lap tekrarında fetch 0",log.length===n0,log.length-n0);
 const cd=log.filter(x=>/^(car_data|location)\?/.test(x));ok("25 hiçbir car_data/location URL'si iki kez çekilmedi",cd.length===new Set(cd).size,cd.length);
 console.log(js(K));
})();
