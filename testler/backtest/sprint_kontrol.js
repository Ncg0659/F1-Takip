"use strict";
const fs=require("fs"),L=require("./backtest-lib.js"),TM=L.TM,TV=L.TV,C=require("./champ_lib.js");
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
const K=[],ok=(a,v,d)=>K.push({ad:a,ok:!!v,d:d===undefined?"":String(d)}),js=JSON.stringify,kop=o=>JSON.parse(JSON.stringify(o)),sum=a=>a.reduce((x,y)=>x+y,0);
const sprR=S=>ds.seasons[S].races.filter(r=>r.sprint).map(r=>r.round);
function truth(S,R){const p={};ds.seasons[S].races.filter(r=>r.sprint&&r.round<R).forEach(r=>r.sprintResults.forEach(x=>p[x.Driver.driverId]=(p[x.Driver.driverId]||0)+Number(x.points)));return p;}
function arsivKur(){const m={};return {oku:k=>m[k]?JSON.parse(m[k]):null,yaz:(k,v)=>{m[k]=JSON.stringify(v);},_m:m};}
(async()=>{
 // ---- 1) kural ----
 ok("R1 sprint kuralı: 2020 yok, 2021 3-2-1, 2022+ 8…1",js(TV.sprintKurali(2020))==="[]"&&js(TV.sprintKurali(2021))==="[3,2,1]"&&js(TV.sprintKurali(2022))==="[8,7,6,5,4,3,2,1]"&&js(TV.sprintKurali(2026))==="[8,7,6,5,4,3,2,1]");
 ok("R2 veri/kural uyumu: F1DB 2021–2026 sprint puanları kuralla birebir (API puanı = kural)",[2021,2022,2023,2024,2025,2026].every(S=>ds.seasons[S].races.every(r=>(r.sprintResults||[]).every(x=>{const p=parseInt(x.position,10);const e=/^\d+$/.test(x.positionText)?(TV.sprintKurali(S)[p-1]||0):0;return Number(x.points)===e;}))));
 ok("R3 motor sprint kuralı = veri katmanı kuralı (2019–2030)",[2019,2020,2021,2022,2023,2024,2025,2026,2030].every(S=>(TV.sprintKurali(S)[0]||0)===TM.sezonKurali(S).sprintMax));
 // ---- 2) tüm sezon/tur: katman = gerçek ----
 let uyumsuz=0,say=0,tamDegil=0,kalanYanlis=0;
 for(const S of [2021,2022,2023,2024,2025,2026]){const {tv}=L.veriKatmani(ds);const T=ds.seasons[S].toplam;
  for(let R=1;R<=T;R++){const o=await tv.sprintOzeti({season:S,round:R}),t=truth(S,R),sr=sprR(S);say++;
   if(!o.sprintDataComplete)tamDegil++;
   if(js(Object.keys(t).sort())!==js(Object.keys(o.driverSprintPoints).sort())||Object.keys(t).some(d=>Math.abs(t[d]-o.driverSprintPoints[d])>1e-9)||o.completedSprintCount!==sr.filter(x=>x<R).length)uyumsuz++;
   if(o.remainingSprintCount!==sr.filter(x=>x>=R).length||o.remainingSprintMaxPoints!==sr.filter(x=>x>=R).length*(S===2021?3:8))kalanYanlis++;}}
 ok("D1 her sezon/tur (141 durum): sprint puanı/sayısı gerçekle birebir",uyumsuz===0,"uyumsuz "+uyumsuz+"/"+say);
 ok("D2 kalan sprint sayısı gerçek takvimden; max = sayı × (2021:3 | 2022+:8)",kalanYanlis===0,"yanlış "+kalanYanlis);
 ok("D3 veri tam olduğunda sprintDataComplete=true (tüm durumlar)",tamDegil===0,"tam değil "+tamDegil);
 // ---- 3) sprint olmayan tur / hiç sprint koşulmadı ----
 {const {tv,taklit}=L.veriKatmani(ds);const o=await tv.sprintOzeti({season:2024,round:3});
  ok("N1 henüz sprint koşulmadı: 0 puan, 0 sprint isteği, tam=true",o.completedSprintCount===0&&o.completedSprintPoints===0&&Object.keys(o.driverSprintPoints).length===0&&taklit.log.filter(x=>/sprint/.test(x)).length===0&&o.sprintDataComplete===true);
  const o2=await tv.sprintOzeti({season:2020,round:10});ok("N2 sprint hiç olmayan sezon (2020): kalan 0, max 0, istek yok",o2.remainingSprintCount===0&&o2.remainingSprintMaxPoints===0&&o2.sprintDataComplete===true&&taklit.log.filter(x=>/sprint/.test(x)).length===0);}
 // ---- 4) çift sayım / kalan sprint — motor ----
 const S=2023,R=12,{tv}=L.veriKatmani(ds),ids=C.suruculer(ds,S,R),f=(await Promise.all(ids.map(d=>tv.ozellik({season:S,round:R,driver:d,mode:"PRE_WEEKEND"})))).filter(x=>x.durum==="ok");
 const so=await tv.sprintOzeti({season:S,round:R}),T=ds.seasons[S].toplam,a0=TM.championshipPredict(f,{toplamYaris:T,kalanSprint:so.remainingSprintCount}),a1=TM.championshipPredict(f,{toplamYaris:T,sprint:so}),a2=TM.championshipPredict(f,{toplamYaris:T,sprint:so});
 const yarisP=Object.fromEntries(f.map(x=>[x.driver,x.recentForm&&x.recentForm.sezonPuani]));
 ok("C1 çift sayım yok: motor puanı = yarış puanı + sprint puanı (tam bir kez)",a1.suruculer.every(s=>Math.abs(s.puan-(yarisP[s.driver]+(so.driverSprintPoints[s.driver]||0)))<1e-9)&&Object.keys(so.driverSprintPoints).length>0);
 ok("C2 aynı girdiyle tekrar çağrı birikmez (puanlar aynı, deterministik)",js(a1)===js(a2));
 ok("C3 puan sprint'i zaten içeriyorsa (puanSprintDahil) eklenmez",(()=>{const b=TM.championshipPredict(f,{toplamYaris:T,sprint:Object.assign({},so,{puanSprintDahil:true})});return b.suruculer.every(s=>Math.abs(s.puan-yarisP[s.driver])<1e-9);})());
 ok("C4 sprintsiz çağrı (yalnız yarış puanı) ile fark = tam sprint toplamı",a1.suruculer.every(s=>Math.abs(s.puan-a0.suruculer.find(x=>x.driver===s.driver).puan-(so.driverSprintPoints[s.driver]||0))<1e-9));
 ok("C5 maxKalan = kalan yarış × 26 (2023) + kalan sprint max (4×8)",a1.maxKalanPuan===a1.kalanYaris*26+so.remainingSprintMaxPoints&&so.remainingSprintMaxPoints===32,a1.maxKalanPuan);
 ok("C6 sprint olmayan yarış sprint sayılmaz: kalan sprint = takvimdeki sprint sayısı",so.remainingSprintCount===sprR(S).filter(x=>x>=R).length&&so.remainingSprintCount<T-(R-1));
 ok("C7 olasılık toplamı 1, elenen 0",Math.abs(sum(a1.suruculer.map(s=>s.championshipProbability||0))-1)<0.003&&a1.suruculer.filter(s=>s.elendi).every(s=>s.championshipProbability===0));
 // ---- 5) eksik veri → eleme YOK, sahte 0 yok ----
 function katman(mod){const t=L.taklitKur(ds),j=t.jolpica;return {tv:TV.kur({jolpica:async(y)=>mod(y,j),takvim:t.takvim,pit:false}),log:t.log};}
 const hataK=katman(async(y,j)=>/sprint/.test(y)?{tur:"hata",veri:null}:j(y));
 const eh=await hataK.tv.sprintOzeti({season:2025,round:20});
 ok("E1 sprint fetch hatası → sprintDataComplete=false, sahte 0 yok (driverSprintPoints boş)",eh.sprintDataComplete===false&&eh.durum==="hata"&&Object.keys(eh.driverSprintPoints).length===0&&eh.completedSprintPoints===0);
 const bosK=katman(async(y,j)=>/sprint/.test(y)?{tur:"bos",veri:null}:j(y)),eb=await bosK.tv.sprintOzeti({season:2025,round:20});
 ok("E2 boş sprint yanıtı (sprint hafta sonu biliniyor) → tam değil",eb.sprintDataComplete===false&&eb.eksikSprintTurlari.length===eb.completedSprintCount);
 const kismi=katman(async(y,j)=>{const r=await j(y);if(/sprint/.test(y)&&r.tur==="ok"){const v=kop(r.veri);v.RaceTable.Races=v.RaceTable.Races.filter(x=>x.round!==String(sprR(2025)[1]));return {tur:"ok",veri:v};}return r;}),ek=await kismi.tv.sprintOzeti({season:2025,round:20});
 ok("E3 bir sprint turu eksik → tam değil, eksik tur listelenir, o turun puanı 0 uydurulmaz",ek.sprintDataComplete===false&&js(ek.eksikSprintTurlari)===js([sprR(2025)[1]])&&ek.neden==="sprint-sonucu-eksik");
 const takK=TV.kur({jolpica:async()=>({tur:"bos",veri:null}),pit:false,takvim:()=>null}),et=await takK.sprintOzeti({season:2025,round:20});
 ok("E4 takvim yoksa kalan sprint bilinmez → null + tam değil",et.sprintDataComplete===false&&et.remainingSprintCount===null&&et.neden==="takvim-yok");
 const kural=katman(async(y,j)=>{const r=await j(y);if(/sprint/.test(y)&&r.tur==="ok"){const v=kop(r.veri);v.RaceTable.Races[0].SprintResults[0].points="25";return {tur:"ok",veri:v};}return r;}),ekr=await kural.tv.sprintOzeti({season:2025,round:20});
 ok("E5 sprint puanı kuralın üstünde (25>8) → tam değil",ekr.sprintDataComplete===false&&ekr.neden==="puan-kural-disi");
 const apiK=katman(async(y,j)=>{const r=await j(y);if(/sprint/.test(y)&&r.tur==="ok"){const v=kop(r.veri);v.RaceTable.Races[0].SprintResults[0].points="5";return {tur:"ok",veri:v};}return r;}),eap=await apiK.tv.sprintOzeti({season:2025,round:20});
 ok("E6 API puanı tercih edilir (kuraldan sapma ≤ üst sınır → API değeri alınır, 'kuralUyumsuz' sayılır)",eap.sprintDataComplete===true&&eap.kuralUyumsuz===1&&eap.driverSprintPoints[ds.seasons[2025].races.find(r=>r.sprint).sprintResults[0].Driver.driverId]>=5-1e-9);
 // eksik veri → motor eleme yapmaz
 {const S5=2025,R5=20,{tv:tv5}=L.veriKatmani(ds),idl=C.suruculer(ds,S5,R5),f5=(await Promise.all(idl.map(d=>tv5.ozellik({season:S5,round:R5,driver:d,mode:"PRE_WEEKEND"})))).filter(x=>x.durum==="ok");
  const tam=await tv5.sprintOzeti({season:S5,round:R5}),c0=TM.championshipPredict(f5,{toplamYaris:24,sprint:tam}),c1=TM.championshipPredict(f5,{toplamYaris:24,sprint:eh});
  ok("E7 sprint verisi eksik → matematiksel eleme YOK (elendi=false, p>0 yalnız canlılarda değil herkeste), elemeYapildi=false",c1.meta.elemeYapildi===false&&c1.meta.sprintDataComplete===false&&c1.suruculer.every(s=>s.elendi===false)&&c1.meta.sampiyonlukBelli===false&&Math.abs(sum(c1.suruculer.map(s=>s.championshipProbability||0))-1)<0.003);
  ok("E8 sprint verisi tam → eleme yapılır (referans)",c0.meta.elemeYapildi===true&&c0.meta.sprintDataComplete===true);}
 // eksik sprint, sahte eleme riski: tüm checkpoint'lerde sprintsiz+hataK ile yanlış eleme 0
 {const H=await C.hazirla(ds,hataK.tv,[2021,2022,2023,2024,2025]);let yanlis=0;for(const h of H){const c=TM.championshipPredict(h.f,{toplamYaris:h.T,sprint:h.sprintO});if(c.suruculer.some(s=>s.elendi))yanlis++;}
  ok("E9 sprint verisi alınamazken 20 checkpoint'te hiç eleme yapılmaz",yanlis===0&&H.every(h=>h.sprintO.completedSprintCount===0||h.sprintO.sprintDataComplete===false));}
 // ---- 6) cache ----
 {const {tv,taklit}=L.veriKatmani(ds);const n=()=>taklit.log.filter(x=>/sprint/.test(x)).length;
  await Promise.all([1,2,3,4,5].map(()=>tv.sprintOzeti({season:2025,round:20})));const n1=n();
  ok("X1 eşzamanlı aynı istek tek fetch (5 çağrı → yalnız sayfa sayısı kadar istek: 2)",n1===2,n1);
  await tv.sprintOzeti({season:2025,round:20});await tv.sprintOzeti({season:2025,round:20});ok("X2 tekrar çağrı → 0 yeni istek",n()===n1);
  const ar=arsivKur(),k1=L.veriKatmani(ds,{arsiv:ar}),k2=L.veriKatmani(ds,{arsiv:ar});await k1.tv.sprintOzeti({season:2025,round:20});const ilk=k1.taklit.log.filter(x=>/sprint/.test(x)).length;await k2.tv.sprintOzeti({season:2025,round:20});
  ok("X3 kalıcı arşiv: yeni oturum 0 sprint isteği; arşiv tur başına yazıldı",ilk===2&&k2.taklit.log.filter(x=>/sprint/.test(x)).length===0&&Object.keys(ar._m).filter(x=>x.startsWith("spr/2025/")).length===4,Object.keys(ar._m).join());
  const ar2=arsivKur(),bk=L.veriKatmani(ds,{arsiv:ar2});let bozuk=true;const t2=L.taklitKur(ds);
  const ky=TV.kur({jolpica:async(y)=>/sprint/.test(y)&&bozuk?{tur:"hata",veri:null}:t2.jolpica(y),takvim:t2.takvim,pit:false,arsiv:ar2});
  await ky.sprintOzeti({season:2025,round:20});const arsivBos=Object.keys(ar2._m).filter(x=>x.startsWith("spr/")).length===0;bozuk=false;const ok2=await ky.sprintOzeti({season:2025,round:20});
  ok("X4 başarısız cevap kalıcı/bellek cache'ine girmez; sonra başarıyla alınır",arsivBos&&ok2.sprintDataComplete===true&&ok2.completedSprintCount===4);
  const pay=L.veriKatmani(ds,{sprintOnbellek:S=>({satir:ds.seasons[S].races.filter(r=>r.sprint).flatMap(r=>r.sprintResults.map(x=>[r.round,x.Driver.driverId,x.Constructor.constructorId,+x.grid,+x.position,x.positionText,+x.points,x.status]))})}),op=await pay.tv.sprintOzeti({season:2025,round:20});
  ok("X5 uygulamanın mevcut sprint önbelleği (A3 sezon analizi) varsa aynen kullanılır: 0 istek, aynı puanlar",op.kaynak==="paylasilan"&&pay.taklit.log.filter(x=>/sprint/.test(x)).length===0&&js(op.driverSprintPoints)===js((await L.veriKatmani(ds).tv.sprintOzeti({season:2025,round:20})).driverSprintPoints));}
 // ---- 7) sızıntı 0 ----
 {const S7=2024,R7=9,a=await L.veriKatmani(ds).tv.sprintOzeti({season:S7,round:R7}),d=kop(ds);d.seasons[S7].races.forEach(r=>{if(r.round>=R7){(r.sprintResults||[]).forEach(x=>{x.points="8";x.position="1";});}});
  const b=await L.veriKatmani(d).tv.sprintOzeti({season:S7,round:R7}),e=kop(ds);e.seasons[S7].races=e.seasons[S7].races.filter(r=>r.round<R7);
  ok("L1 sızıntı 0: R ve sonrası sprint sonuçları bozulunca/silinince tamamlanan sprint çıktısı aynı (puan/sayı)",js(a.driverSprintPoints)===js(b.driverSprintPoints)&&a.completedSprintCount===b.completedSprintCount&&a.completedSprintPoints===b.completedSprintPoints);}
 // ---- 8) UI bağlantısı (kaynak) ----
 const ui=fs.readFileSync("/home/claude/f1-takip/prediction-ui.js","utf8");
 ok("U1 UI sprint özetini motora veriyor; alınamazsa tam=false (eleme yok)",/sprintOzeti\(/.test(ui)&&/sprint: sprintO/.test(ui)&&/sprintDataComplete: false/.test(ui));
 ok("U2 UI uygulamanın mevcut sprint önbelleğini veriyor (aynı kaynak)",/sprintOnbellek: sprintPaylasilan/.test(ui)&&/a3-sprint/.test(ui));
 ok("U3 yeni polling/timer yok (setInterval/rAF/WebSocket yok)",!/setInterval|requestAnimationFrame|WebSocket/.test(ui+fs.readFileSync("/home/claude/f1-takip/prediction-data.js","utf8")));
 console.log(js(K));
})();
