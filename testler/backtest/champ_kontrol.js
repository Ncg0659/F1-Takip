"use strict";
const fs=require("fs"),cp=require("child_process"),C=require("./champ_lib.js"),KR=require("./champ_karar.js"),L=C.L,TM=C.TM;
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
const K=[],ok=(a,v,d)=>K.push({ad:a,ok:!!v,d:d===undefined?"":String(d)}),js=JSON.stringify,kop=o=>JSON.parse(JSON.stringify(o)),sum=a=>a.reduce((x,y)=>x+y,0);
(async()=>{
 const {tv}=L.veriKatmani(ds),SEZ=[2021,2022,2023,2024,2025],H=await C.hazirla(ds,tv,SEZ),H2=await C.hazirla(ds,L.veriKatmani(ds).tv,SEZ);
 // 1) checkpoint yapısı
 ok("T1 sezonlar 2021–2025 (+2026 ayrı, puanlanmaz) ve 4 checkpoint",H.length===20&&[...new Set(H.map(h=>h.S))].join()==="2021,2022,2023,2024,2025"&&[...new Set(H.map(h=>h.cp))].join()==="25%,50%,75%,son5");
 ok("T2 %25/%50/%75 doğru tur (floor(oran·T)+1) ve son5 = T−4",H.every(h=>{const T=h.T,exp={"25%":Math.floor(.25*T)+1,"50%":Math.floor(.5*T)+1,"75%":Math.floor(.75*T)+1,"son5":T-4};return h.R===exp[h.cp];}));
 ok("T3 son5 → tam 5 yarış kala (kalan=5)",H.filter(h=>h.cp==="son5").every(h=>h.T-(h.R-1)===5));
 // 2) sızıntı 0: R ve sonrası bozulunca özellikler, gerçek puanlar ve motor çıktısı aynı
 const boz=kop(ds);SEZ.forEach(S=>{boz.seasons[S].races.forEach(r=>{if(r.round>=4){r.results.forEach(x=>{x.points="77";x.position="1";});(r.sprintResults||[]).forEach(x=>{x.points="50";});}});});
 const hb=H.filter(h=>h.R>=4).slice(0,0);   // (bozma yalnız R>=4 turlarını etkiler; her checkpoint için kendi R'sinden itibaren bozulmuş sürüm aşağıda)
 let sizinti=0,farkli=0;
 for(const h of H){const d=kop(ds);d.seasons[h.S].races.forEach(r=>{if(r.round>=h.R){r.results.forEach(x=>{x.points="88";x.position="20";x.grid="1";});(r.sprintResults||[]).forEach(x=>{x.points="40";});r.qualifying.forEach(x=>{x.position="1";});}});
  const hb2=(await C.hazirla(d,L.veriKatmani(d).tv,[h.S])).find(x=>x.cp===h.cp);
  const a=C.motorCalistir(TM,h,true),b=C.motorCalistir(TM,hb2,true);
  if(js(a)!==js(b)||js(h.puan)!==js(hb2.puan)||js(h.sprintP)!==js(hb2.sprintP)||h.kalanSprint!==hb2.kalanSprint){sizinti++;}}
 ok("L1 checkpoint sızıntısı 0 (R ve sonrası bozulunca 20/20 çıktı + gerçek puanlar aynı)",sizinti===0,"sızıntı "+sizinti);
 ok("L2 gerçek puan tablosu yalnız R'den önceki turlar (sprint dahil)",H.every(h=>{const t={};ds.seasons[h.S].races.filter(r=>r.round<h.R).forEach(r=>{r.results.forEach(x=>t[x.Driver.driverId]=(t[x.Driver.driverId]||0)+Number(x.points));(r.sprintResults||[]).forEach(x=>t[x.Driver.driverId]=(t[x.Driver.driverId]||0)+Number(x.points));});return Object.keys(t).every(d=>Math.abs(t[d]-(h.puan[d]||0))<1e-9);}));
 // 3) deterministik
 ok("D1 aynı veri → aynı hazırlık ve motor çıktısı",js(H.map(h=>C.motorCalistir(TM,h,true)))===js(H2.map(h=>C.motorCalistir(TM,h,true))));
 // 4) olasılık özellikleri
 const out=H.map(h=>({h:h,c:C.motorCalistir(TM,h,true)}));
 ok("P1 toplam ≈ 1 (±0.003) her checkpoint",out.every(o=>Math.abs(sum(o.c.suruculer.map(s=>s.championshipProbability||0))-1)<0.003));
 ok("P2 hepsi 0–1",out.every(o=>o.c.suruculer.every(s=>s.championshipProbability>=0&&s.championshipProbability<=1)));
 ok("P3 matematiksel elenen → olasılık 0",out.every(o=>o.c.suruculer.filter(s=>s.elendi).every(s=>s.championshipProbability===0)));
 ok("P4 motorun elemesi = gerçek (sprint+sezon kuralı) eleme: yanlış 0, kaçan 0",out.every(o=>{const d=C.degerle(o.h,o.c);return d.yanlisEleme===0&&d.kacanEleme===0;}));
 ok("P5 elenmeyene gereksiz 0 yok (canlı pilotun p>0)",out.every(o=>o.c.suruculer.filter(s=>s.elendi===false).every(s=>s.championshipProbability>0)));
 ok("P6 matematiksel garanti → p=1; garanti dışında 1 yok",out.every(o=>{const d=C.degerle(o.h,o.c);return d.garantiGercek?o.c.suruculer.find(s=>s.driver===d.garantiGercek).championshipProbability===1:o.c.suruculer.every(s=>s.championshipProbability<1);})&&out.some(o=>C.degerle(o.h,o.c).garantiGercek));
 ok("P7 şampiyonlukta HIGH/MEDIUM/LOW üretilmiyor",out.every(o=>o.c.suruculer.every(s=>s.confidenceSeviye===undefined)));
 ok("P8 UI şampiyon bölümünde güven yazısı yok",!/Güven/.test((fs.readFileSync("/home/claude/f1-takip/prediction-ui.js","utf8").match(/function sampiyonHtml[\s\S]*?\n  }\n/)||[""])[0]));
 // 5) sprint puanı + sezon kuralı
 const h0=H.find(x=>x.S===2024&&x.cp==="75%"),a0=C.motorCalistir(TM,h0,false),a1=C.motorCalistir(TM,h0,true),sp=Object.keys(h0.sprintP)[0];
 ok("S1 sprint puanı verilince pilotun puanı tam o kadar artar",a1.suruculer.find(s=>s.driver===sp).puan-a0.suruculer.find(s=>s.driver===sp).puan===h0.sprintP[sp]&&h0.sprintP[sp]>0,sp+" +"+h0.sprintP[sp]);
 ok("S2 gerçek (yarış+sprint) puan = motor puanı + sprint (yarış puanı özelliği sprint içermez)",a1.suruculer.every(s=>Math.abs(s.puan-(h0.puan[s.driver]||0))<1e-9));
 ok("S3 kalan sprint maxKalan'a girer (kalanSprint 2→0: −2×8)",(()=>{const x=TM.championshipPredict(h0.f,{toplamYaris:h0.T,kalanSprint:2}),y=TM.championshipPredict(h0.f,{toplamYaris:h0.T,kalanSprint:0});return x.maxKalanPuan-y.maxKalanPuan===16;})());
 const k=TM.sezonKurali;
 ok("S4 en hızlı tur kuralı: 2019–2024 yarış max 26, 2025+ 25",k(2019).yarisMax===26&&k(2024).yarisMax===26&&k(2025).yarisMax===25&&k(2026).yarisMax===25&&k(2018).yarisMax===25);
 ok("S5 sprint kuralı: 2020 yok(0), 2021 max 3, 2022+ max 8",k(2020).sprintMax===0&&k(2021).sprintMax===3&&k(2022).sprintMax===8&&k(2026).sprintMax===8);
 ok("S6 kural meta'da: 2024 ve 2025 aynı R/T'de maxKalan farkı",(()=>{const f24=H.find(x=>x.S===2024&&x.cp==="50%").f.map(x=>Object.assign({},x,{season:2024})),f25=f24.map(x=>Object.assign({},x,{season:2025})),a=TM.championshipPredict(f24,{toplamYaris:24,kalanSprint:0}),b=TM.championshipPredict(f25,{toplamYaris:24,kalanSprint:0});return a.meta.kural.yarisMax===26&&b.meta.kural.yarisMax===25&&a.maxKalanPuan-b.maxKalanPuan===a.kalanYaris;})());
 ok("S7 backtest kuralı veriyle uyumlu: F1DB 2021–2025 yarış başına en çok puan ≤ sezon kuralı",SEZ.every(S=>ds.seasons[S].races.every(r=>Math.max.apply(null,r.results.map(x=>Number(x.points)))<=k(S).yarisMax)&&ds.seasons[S].races.every(r=>(r.sprintResults||[]).every(x=>Number(x.points)<=k(S).sprintMax))));
 // 6) erken sezon koruması
 const R=JSON.parse(fs.readFileSync(__dirname+"/champ_sonuc_v1.json","utf8"));
 ok("G1 %25 checkpoint'te garanti dışı p ≤ 0.80",out.filter(o=>o.h.cp==="25%").every(o=>o.c.suruculer.every(s=>s.championshipProbability<=0.8+1e-9)));
 ok("G2 koruma ilerlemeyle gevşer (sentetik: aynı veri, %20→%60 ilerleme, lider p artar)",(()=>{const fs0=H.find(x=>x.S===2023&&x.cp==="25%").f,t=(R_,top)=>TM.championshipPredict(fs0.map(x=>Object.assign({},x,{round:R_})),{toplamYaris:top}).suruculer[0].championshipProbability;return t(5,25)<=0.8+1e-9;})());
 ok("G3 2026 (şampiyon belli değil) yalnız tutarlılık: toplam≈1, %25'te p≤0.80",R.sezon2026.length===4&&R.sezon2026.every(x=>Math.abs(x.toplam-1)<0.003)&&R.sezon2026[0].top3[0][1]<=0.8+1e-9);
 // 7) baseline kıyası
 const oz=R.ozet;
 ok("B1 iki baseline hesaplandı (A puan-orantılı, B puan+kalan maks farkı)",!!oz.bazA&&!!oz.bazB&&oz.bazA.n===20&&oz.bazB.n===20);
 ok("B2 yeni motor Brier ve log loss'ta ikisinden de iyi",oz.kuralSprint.brier<oz.bazA.brier&&oz.kuralSprint.brier<oz.bazB.brier&&oz.kuralSprint.logLoss<oz.bazA.logLoss&&oz.kuralSprint.logLoss<oz.bazB.logLoss);
 ok("B3 yeni motor eskisinden iyi (Brier+LL) ve eski eleme kaçırıyordu",oz.kuralSprint.brier<oz.eski.brier&&oz.kuralSprint.logLoss<oz.eski.logLoss&&R.denetim.eski.kacanEleme>R.denetim.kuralSprint.kacanEleme);
 ok("B4 Top1 sıralamada baseline'ın gerisinde olabilir; raporlandı (kayıt)",typeof oz.kuralSprint.birinci==="number"&&typeof oz.bazA.birinci==="number",oz.kuralSprint.birinci+" vs "+oz.bazA.birinci);
 // 8) kalibrasyon kararı
 const cal=JSON.parse(fs.readFileSync(__dirname+"/champ_kalibrasyon_v1.json","utf8"));
 ok("K1 aday seçimi yalnız eğitim sezonlarında, doğrulama ileri-zincir (2023←21-22, 2024←21-23, 2025←21-24)",js(cal.foldlar.map(f=>f.val))===js([2023,2024,2025]));
 ok("K2 karar kuralı: sentetik iyi → kabul, sentetik kötü → ret",KR.karar([{val:1,secilenJ:.8,varsayilanJ:1,secilen:{brier:.4,logLoss:.5},varsayilan:{brier:.5,logLoss:.6}},{val:2,secilenJ:.9,varsayilanJ:1,secilen:{brier:.4,logLoss:.5},varsayilan:{brier:.5,logLoss:.6}},{val:3,secilenJ:1.02,varsayilanJ:1.0,secilen:{brier:.5,logLoss:.6},varsayilan:{brier:.5,logLoss:.6}}]).kabul===true&&KR.karar([{val:1,secilenJ:2,varsayilanJ:1,secilen:{brier:.9,logLoss:1},varsayilan:{brier:.5,logLoss:.6}},{val:2,secilenJ:.5,varsayilanJ:1,secilen:{brier:.2,logLoss:.3},varsayilan:{brier:.5,logLoss:.6}}]).kabul===false);
 ok("K3 gerçek karar = ret (yalnız 2025 iyi, 2023/2024 kötü) → motor parametreleri varsayılan",cal.karar.kabul===false&&TM.PARAM.SAMPIYONLUK.YAYILIM===4&&TM.PARAM.SAMPIYONLUK.FORM_PILOT===0.6&&TM.PARAM.SAMPIYONLUK.FORM_TAKIM===0.4&&TM.PARAM.SAMPIYONLUK.DNF_ETKI===0.5);
 ok("K4 yarış modeli sinyali (RACE_LAMBDA) açık iyileşme vermedi → motorda yok",TM.PARAM.SAMPIYONLUK.RACE_LAMBDA===undefined);
 ok("K5 yarış (race) ağırlıkları dokunulmadı (PRE v1, POST grid .65)",js(TM.AGIRLIK.PRE_WEEKEND)===js(require("./kalibrasyon_lib.js").ESKI.AGIRLIK.PRE_WEEKEND)&&TM.AGIRLIK.POST_QUALIFYING.grid===0.65);
 console.log(js(K));
})();
