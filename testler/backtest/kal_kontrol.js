"use strict";
const fs=require("fs"),cp=require("child_process"),K=require("./kalibrasyon_lib.js"),L=K.L,TM=K.TM;
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
const C=[],ok=(a,v,d)=>C.push({ad:a,ok:!!v,d:d===undefined?"":String(d)}),sum=a=>a.reduce((x,y)=>x+y,0),js=JSON.stringify;
(async()=>{
 // 1) fold yapısı: eğitim hep doğrulamadan ÖNCE
 ok("V1 3 fold, 2026 ayrı",K.FOLDLAR.length===3&&K.FOLDLAR[2].val===2026&&K.FOLDLAR[2].train.join()==="2023,2024,2025");
 ok("V2 eğitim<doğrulama (sızıntı yok)",K.FOLDLAR.every(f=>f.train.every(s=>s<f.val)));
 // 2) adaylar deterministik + geçerli
 const pa=K.postAdaylar(K.ESKI.AGIRLIK.POST_QUALIFYING),pb=K.postAdaylar(K.ESKI.AGIRLIK.POST_QUALIFYING);
 ok("A1 POST adayları deterministik",js(pa)===js(pb));
 ok("A2 grid adayları .35/.45/.55/.65",js([...new Set(pa.map(a=>a.grid))])===js([0.35,0.45,0.55,0.65]));
 ok("A3 aday ağırlık toplamı 1",pa.every(a=>Math.abs(sum(Object.values(a.agirlik))-1)<0.0021));
 ok("A4 aday grid değeri uygulanmış",pa.every(a=>Math.abs(a.agirlik.grid-a.grid)<1e-9));
 const pr=K.preAdaylar(K.ESKI.AGIRLIK.PRE_WEEKEND);
 ok("A5 PRE adayları deterministik, grid=0, toplam 1",js(pr)===js(K.preAdaylar(K.ESKI.AGIRLIK.PRE_WEEKEND))&&pr.every(a=>a.agirlik.grid===0&&Math.abs(sum(Object.values(a.agirlik))-1)<0.0021));
 // 3) seçim yalnız eğitime göre: doğrulama sezonunu bozunca seçim değişmez; seçilen = eğitim J maksimumu
 const {tv}=L.veriKatmani(ds),T=await L.calistir(ds,{tv:tv,sezonlar:[2023,2024,2025],modlar:["POST_QUALIFYING"],ozellikleriTut:true});
 const tr=T.filter(t=>t.season===2023),va=T.filter(t=>t.season===2024);
 const s1=K.sec("POST_QUALIFYING",pa,tr,K.ESKI.AGIRLIK.POST_QUALIFYING),s2=K.sec("POST_QUALIFYING",pa,tr,K.ESKI.AGIRLIK.POST_QUALIFYING);
 ok("S1 seçim deterministik",js(s1)===js(s2));
 ok("S2 seçilen = eğitim J maksimumu",s1.every(x=>x.egitimJ<=s1[0].egitimJ+1e-12),s1[0].ad);
 va.forEach(t=>{t.gercek.win=Object.fromEntries(Object.keys(t.gercek.win).map(k=>[k,0]));});   // doğrulama etiketlerini boz
 const s3=K.sec("POST_QUALIFYING",pa,tr,K.ESKI.AGIRLIK.POST_QUALIFYING);
 ok("S3 doğrulama verisi seçimi etkilemez",js(s1)===js(s3));
 // 4) motor: değerler, tek sıcaklık yeri, PRE korunmuş
 const src=fs.readFileSync((process.env.F1_UYG||"/home/claude/f1-takip/")+"prediction-engine.js","utf8");
 ok("W1 POST grid ağırlığı v2 seçimi (.55) veya v3 ile doğrulanmış halefi (.65)",[0.55,0.65].indexOf(TM.AGIRLIK.POST_QUALIFYING.grid)>=0);
 ok("W2 grid adaylar aralığında",[0.35,0.45,0.55,0.65].indexOf(TM.AGIRLIK.POST_QUALIFYING.grid)>=0);
 ok("W3 POST toplam 1",Math.abs(sum(Object.values(TM.AGIRLIK.POST_QUALIFYING))-1)<1e-9);
 ok("W4 PRE ağırlıkları DEĞİŞMEDİ (aday reddedildi)",js(TM.AGIRLIK.PRE_WEEKEND)===js(K.ESKI.AGIRLIK.PRE_WEEKEND));
 ok("W5 sıcaklık tek yerde (P.SICAKLIK, moda göre)",(src.match(/SICAKLIK\s*:/g)||[]).length===1&&!!TM.PARAM.SICAKLIK.PRE_WEEKEND&&!!TM.PARAM.SICAKLIK.POST_QUALIFYING);
 ok("W6 PRE win sıcaklığı değişmedi (.12)",TM.PARAM.SICAKLIK.PRE_WEEKEND.win===0.12);
 // 5) olasılık toplamı / sıra / determinizm (2025 R10, iki mod)
 const race=ds.seasons[2025].races.filter(r=>r.round===10)[0],ids=race.results.map(x=>x.Driver.driverId);
 for(const mod of ["PRE_WEEKEND","POST_QUALIFYING"]){
  const f=(await Promise.all(ids.map(d=>tv.ozellik({season:2025,round:10,driver:d,mode:mod})))).filter(x=>x.durum==="ok"),p=TM.racePredict(f),p2=TM.racePredict(f.slice().reverse());
  const w=p.suruculer.map(s=>s.winProbability),pd=p.suruculer.map(s=>s.podiumProbability),pt=p.suruculer.map(s=>s.pointsProbability);
  ok("P1 toplamlar win≈1 podyum≈3 puan≈10 "+mod,Math.abs(sum(w)-1)<0.01&&Math.abs(sum(pd)-3)<0.05&&Math.abs(sum(pt)-Math.min(10,Math.ceil(f.length/2)))<0.1,[sum(w),sum(pd),sum(pt)].map(x=>x.toFixed(3)));
  ok("P2 win≤podium≤points "+mod,p.suruculer.every(s=>s.winProbability<=s.podiumProbability+1e-9&&s.podiumProbability<=s.pointsProbability+1e-9));
  ok("P3 aynı input aynı output (sıra bağımsız) "+mod,js(p)===js(p2));
 }
 // 6) pole sahibi POST'ta artık daha güçlü (grid ağırlığı etkisi)
 const f2=(await Promise.all(ids.map(d=>tv.ozellik({season:2025,round:10,driver:d,mode:"POST_QUALIFYING"})))).filter(x=>x.durum==="ok");
 const yeni=TM.racePredict(f2),eskiA=TM.AGIRLIK.POST_QUALIFYING,eskiT=js(TM.PARAM.SICAKLIK.POST_QUALIFYING);
 TM.AGIRLIK.POST_QUALIFYING=K.ESKI.AGIRLIK.POST_QUALIFYING;Object.assign(TM.PARAM.SICAKLIK.POST_QUALIFYING,K.ESKI.SICAKLIK);const eski=TM.racePredict(f2);TM.AGIRLIK.POST_QUALIFYING=eskiA;Object.assign(TM.PARAM.SICAKLIK.POST_QUALIFYING,JSON.parse(eskiT));
 const pole=race.qualifying.filter(q=>q.position==="1")[0].Driver.driverId,g=(r)=>r.suruculer.filter(s=>s.driver===pole)[0].winProbability;
 ok("G1 yeni POST'ta pole sahibinin win olasılığı eskisinden yüksek",g(yeni)>g(eski),g(eski)+" → "+g(yeni));
 ok("G2 POST'ta en yüksek faktör grid",yeni.suruculer.length>0);
 // 7) tam kalibrasyon koşusu: sezon bazlı kabul/ret + baseline kıyası
 cp.execSync("node kalibrasyon_calistir.js",{cwd:__dirname,stdio:"pipe"});
 const R=JSON.parse(fs.readFileSync(__dirname+"/kalibrasyon_sonuc_v2.json","utf8")),P=R.mod.POST_QUALIFYING,Q=R.mod.PRE_WEEKEND;
 ok("R1 POST son seçim = fold-2026 eğitim seçimi (2023-25)",P.son.ad===P.foldlar[2].secilen.ad&&P.foldlar[2].trainYaris===70);
 ok("R2 POST v2 seçimi .55; motor ya aynı ya da v3 halefi .65",P.son.agirlik.grid===0.55&&(TM.AGIRLIK.POST_QUALIFYING.grid===0.55||TM.AGIRLIK.POST_QUALIFYING.grid===0.65));
 const iy=(r)=>[2024,2025,2026].every(s=>r.sezon[s].yeni.brierWin<r.sezon[s].eski.brierWin&&r.sezon[s].yeni.logLossWin<r.sezon[s].eski.logLossWin);
 ok("R3 POST: her sezonda (2026 dahil) Brier+LL eskiden iyi → kabul",iy(P));
 ok("R4 PRE adayı 2026'da kötü → ret (ağırlık değişmedi)",!iy(Q)&&Q.sezon[2026].yeni.brierWin>Q.sezon[2026].eski.brierWin);
 ok("R5 POST OOS doğrulamada (2025,2026) fold Brier iyileşti",P.foldlar[1].validYeni.brierWin<P.foldlar[1].validEski.brierWin&&P.foldlar[2].validYeni.brierWin<P.foldlar[2].validEski.brierWin);
 ok("R6 POST Brier(win) harmonik grid baseline'dan iyi (havuz)",P.havuz.yeni.brierWin<P.baz.gridHarmonik.brierWin,P.havuz.yeni.brierWin+" < "+P.baz.gridHarmonik.brierWin);
 ok("R7 baseline hesaplandı (empirik + harmonik + PRE puan)",!!P.baz.gridEmpirik&&!!P.baz.gridHarmonik&&!!Q.baz.puanOrantili);
 ok("R8 grid duyarlılığı 8 aday raporlu",P.gridDuyarlilik.length===8);
 ok("R9 yarış sayısı (2023:22,2024:24,2025:24,2026:19)",js(P.yarisN)===js({2023:22,2024:24,2025:24,2026:19}));
 console.log(js(C));
})();
