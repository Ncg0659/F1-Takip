"use strict";
const fs=require("fs"),cp=require("child_process"),L=require("./backtest-lib.js"),K=require("./kalibrasyon_lib.js"),G=require("./guven_lib.js"),KR=require("./karar_lib.js"),TM=L.TM;
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
const C=[],ok=(a,v,d)=>C.push({ad:a,ok:!!v,d:d===undefined?"":String(d)}),sum=a=>a.reduce((x,y)=>x+y,0),js=JSON.stringify,kop=o=>JSON.parse(JSON.stringify(o));
(async()=>{
 // ---- 1) grid karşılaştırması (0.55 vs 0.65) ----
 cp.execSync("node grid_karsilastir.js",{cwd:__dirname,stdio:"pipe"});
 const g1=fs.readFileSync(__dirname+"/grid_karar_v3.json","utf8");cp.execSync("node grid_karsilastir.js",{cwd:__dirname,stdio:"pipe"});
 const R=JSON.parse(fs.readFileSync(__dirname+"/grid_karar_v3.json","utf8"));
 ok("D0 grid karşılaştırması deterministik (iki koşu aynı)",fs.readFileSync(__dirname+"/grid_karar_v3.json","utf8")===g1);
 ok("G1 yalnız iki aday: grid .55 ve .65",js(R.adaylar.map(a=>a.agirlik.grid))===js([0.55,0.65]));
 ok("G2 diğer ağırlıklar orantılı normalize (toplam≈1, oranlar korunur)",R.adaylar.every(a=>Math.abs(sum(Object.values(a.agirlik))-1)<0.0021)&&(()=>{const [A,B]=R.adaylar,k=(1-0.65)/(1-0.55);return Object.keys(A.agirlik).filter(x=>x!=="grid").every(x=>Math.abs(B.agirlik[x]-A.agirlik[x]*k)<0.0011);})());
 ok("G3 3 sezon + havuz raporlu",["2024","2025","2026"].every(y=>R.sezon[y]["A_0.55"]&&R.sezon[y]["B_0.65"])&&!!R.havuz["A_0.55"]&&!!R.havuz["B_0.65"]);
 ok("G4 metrikler tam (Brier, LL, Top1, Top3, kalibrasyon kovası)",["brierWin","logLossWin","top1","top3"].every(m=>R.havuz["B_0.65"][m]!=null)&&R.havuz["B_0.65_kal"].length===6);
 // ---- 2) karar kuralı (sentetik + gerçek) ----
 const m=(b,l,t1)=>({brierWin:b,logLossWin:l,top1:t1});
 const yalniz2026={2024:{A:m(.034,1.6,.5),B:m(.0345,1.62,.5)},2025:{A:m(.03,1.1,.5),B:m(.0302,1.1,.5)},2026:{A:m(.027,1.2,.5),B:m(.025,1.1,.6)}};
 ok("K1 yalnız 2026'da iyi → RET",KR.karar(yalniz2026,{A:m(.03,1.3,.5),B:m(.0295,1.28,.52)}).kabul===false&&KR.karar(yalniz2026,{A:m(.03,1.3,.5),B:m(.0295,1.28,.52)}).sadece2026===true);
 const ikisi={2024:{A:m(.034,1.6,.5),B:m(.034,1.6,.5)},2025:{A:m(.03,1.1,.5),B:m(.028,1.05,.6)},2026:{A:m(.027,1.2,.5),B:m(.025,1.1,.6)}};
 ok("K2 2/3 sezonda belirgin iyi, kötü sezon yok → KABUL",KR.karar(ikisi,{A:m(.03,1.3,.5),B:m(.029,1.27,.57)}).kabul===true);
 ok("K3 bir sezonda belirgin kötü → RET",KR.karar({...ikisi,2024:{A:m(.034,1.6,.5),B:m(.039,1.7,.4)}},{A:m(.03,1.3,.5),B:m(.029,1.27,.57)}).kabul===false);
 ok("K4 gerçek veri kararı = kabul (2025+2026 belirgin, 2024 eşit, havuz iyi)",R.karar.kabul===true&&js(R.karar.iyiSezonlar)===js(["2025","2026"])&&R.karar.kotuSezonlar.length===0);
 ok("K5 motor grid ağırlığı karara uygun (kabul→.65)",TM.AGIRLIK.POST_QUALIFYING.grid===(R.karar.kabul?0.65:0.55));
 ok("K6 motor ağırlıkları seçilen adayla uyumlu (±.002) ve toplam 1",(()=>{const a=R.adaylar[R.karar.kabul?1:0].agirlik,w=TM.AGIRLIK.POST_QUALIFYING;return Object.keys(a).every(k=>Math.abs(a[k]-w[k])<=0.0021)&&Math.abs(sum(Object.values(w))-1)<1e-9;})());
 ok("K7 PRE ağırlıkları dokunulmadı",js(TM.AGIRLIK.PRE_WEEKEND)===js(K.ESKI.AGIRLIK.PRE_WEEKEND));
 // ---- 3) baseline kıyası ----
 ok("B1 iki baseline hesaplandı (harmonik + öğrenilmiş)",!!R.baz.harmonik&&!!R.baz.ogrenilmis&&R.baz["s2026"].ogrenilmis.brierWin>0);
 const B=R.havuz[R.karar.kabul?"B_0.65":"A_0.55"];
 ok("B2 seçilen model harmonik baseline'dan iyi (Brier+LL)",B.brierWin<R.baz.harmonik.brierWin&&B.logLossWin<R.baz.harmonik.logLossWin);
 ok("B3 öğrenilmiş baseline kıyası yapıldı; fark raporlanabilir",typeof (B.brierWin-R.baz.ogrenilmis.brierWin)==="number",(B.brierWin-R.baz.ogrenilmis.brierWin).toFixed(4));
 // ---- 4) güven v3 ----
 const {tv}=L.veriKatmani(ds),T=await L.calistir(ds,{tv:tv,sezonlar:[2023,2024,2025,2026],modlar:["PRE_WEEKEND","POST_QUALIFYING"],ozellikleriTut:true});
 const rows=G.yarisSatirlari(T),rows2=G.yarisSatirlari(T);
 ok("C0 güven satırları deterministik",js(rows)===js(rows2));
 const V={};for(const md of ["PRE_WEEKEND","POST_QUALIFYING"]){V[md]=G.degerle(rows,md);}
 ok("C1 güven geçmiş yarış HATASIYLA ölçülüyor (kazanan+podyum hatası, 3 grup)",["PRE_WEEKEND","POST_QUALIFYING"].every(md=>["HIGH","MEDIUM","LOW"].every(s=>V[md].grup[s]&&V[md].grup[s].hata1!=null||V[md].grup[s].n===0)));
 ok("C2 kesimler yalnız skor dağılımından (etiket kullanılmaz): sonuçlar bozulunca kesim aynı",(()=>{const bz=rows.map(r=>Object.assign({},r,{hata1:1-r.hata1,hataPod:1-r.hataPod}));return js(G.degerle(bz,"PRE_WEEKEND").kesim)===js(V.PRE_WEEKEND.kesim);})());
 const mono=(h1,h2,h3,n=[20,20,20])=>G.monoton({HIGH:{n:n[0],hata1:h1[0],hataPod:h1[1]},MEDIUM:{n:n[1],hata1:h2[0],hataPod:h2[1]},LOW:{n:n[2],hata1:h3[0],hataPod:h3[1]}});
 ok("C3 monotonik veri → ilişki OK",mono([.3,.2],[.5,.35],[.7,.5]).ok===true);
 ok("C4 monotonik değil (MEDIUM>LOW) → ilişki YOK",mono([.3,.2],[.8,.6],[.7,.5]).ok===false);
 ok("C5 grup çok küçük → ilişki YOK",mono([.3,.2],[.5,.35],[.7,.5],[4,20,20]).ok===false);
 ok("C6 fark çok küçük → ilişki YOK",mono([.30,.20],[.32,.22],[.34,.24]).ok===false);
 for(const md of ["PRE_WEEKEND","POST_QUALIFYING"]){ok("C7 motor durumu = backtest kararı ("+md+")",TM.PARAM.GUVEN_V3[md].durum===V[md].durum,TM.PARAM.GUVEN_V3[md].durum+" vs "+V[md].durum);}
 ok("C8 monotonik değilse UNRELIABLE (en az bir mod fiilen ölçüldü)",["PRE_WEEKEND","POST_QUALIFYING"].some(md=>!V[md].monoton.ok&&V[md].durum==="UNRELIABLE"));
 // motor çıktısı: durum UNRELIABLE → seviye UNRELIABLE (tüm sürücülerde); OK + kesim → HIGH/MEDIUM/LOW
 const t0=T.find(t=>t.mode==="POST_QUALIFYING"&&t.season===2025&&t.round===10),G3=TM.PARAM.GUVEN_V3;
 const orijinal=kop(G3.POST_QUALIFYING),p0=TM.racePredict(t0.ozellikler);
 ok("E1 UNRELIABLE → genelGuven + tüm sürücü seviyeleri UNRELIABLE",(orijinal.durum!=="UNRELIABLE")||(p0.genelGuven.seviye==="UNRELIABLE"&&p0.suruculer.every(s=>s.confidenceSeviye==="UNRELIABLE")));
 try{Object.assign(G3.POST_QUALIFYING,{durum:"UNRELIABLE",HIGH:0.5,MEDIUM:0.2});const pu=TM.racePredict(t0.ozellikler);
  ok("E2 durum UNRELIABLE iken kesim olsa bile seviye UNRELIABLE",pu.genelGuven.seviye==="UNRELIABLE"&&pu.suruculer.every(s=>s.confidenceSeviye==="UNRELIABLE"));
  Object.assign(G3.POST_QUALIFYING,{durum:"OK",HIGH:2,MEDIUM:1.5});const pl=TM.racePredict(t0.ozellikler);
  Object.assign(G3.POST_QUALIFYING,{durum:"OK",HIGH:0,MEDIUM:0});const ph=TM.racePredict(t0.ozellikler);
  Object.assign(G3.POST_QUALIFYING,{durum:"OK",HIGH:5,MEDIUM:0});const pm=TM.racePredict(t0.ozellikler);
  ok("E3 durum OK: eşiklere göre LOW / HIGH / MEDIUM",pl.genelGuven.seviye==="LOW"&&ph.genelGuven.seviye==="HIGH"&&pm.genelGuven.seviye==="MEDIUM");
 }finally{Object.assign(G3.POST_QUALIFYING,orijinal);}
 ok("E4 eski kapsam seviyesi ayrı alanda (kapsamSeviyesi) korunur",p0.suruculer.every(s=>["HIGH","MEDIUM","LOW"].indexOf(s.kapsamSeviyesi)>=0));
 ok("E5 güven skoru kapsama + ayrışmaya bakar (tek tahmin yüksek diye HIGH yok): kapsam aynı, p1/fark düşünce skor düşer",(()=>{const a=TM.genelGuvenSkor([{winProbability:.7,confidence:.9},{winProbability:.1,confidence:.9}]).skor,b=TM.genelGuvenSkor([{winProbability:.2,confidence:.9},{winProbability:.19,confidence:.9}]).skor,c=TM.genelGuvenSkor([{winProbability:.7,confidence:.3},{winProbability:.1,confidence:.3}]).skor;return a>b&&a>c;})());
 ok("E6 aynı input aynı çıktı (genelGuven dahil)",js(TM.racePredict(t0.ozellikler))===js(TM.racePredict(t0.ozellikler)));
 // ---- 5) sızıntı 0: gelecek bozulsa güven/tahmin aynı ----
 const S=2025,Rn=10,race=ds.seasons[S].races.filter(r=>r.round===Rn)[0],ids=race.results.map(x=>x.Driver.driverId);
 const boz=kop(ds);boz.seasons[S].races.forEach(r=>{if(r.round>Rn){r.results.forEach(x=>{x.position=String(21-(parseInt(x.position,10)||1));x.points="99";});}if(r.round===Rn){r.results.forEach(x=>{x.position="20";x.points="0";});}});
 for(const md of ["PRE_WEEKEND","POST_QUALIFYING"]){const f1=(await Promise.all(ids.map(d=>tv.ozellik({season:S,round:Rn,driver:d,mode:md})))).filter(x=>x.durum==="ok"),tv2=L.veriKatmani(boz).tv,f2=(await Promise.all(ids.map(d=>tv2.ozellik({season:S,round:Rn,driver:d,mode:md})))).filter(x=>x.durum==="ok");
  ok("L1 sızıntı 0: gelecek+hedef sonuç bozulunca tahmin ve güven aynı ("+md+")",js(TM.racePredict(f1))===js(TM.racePredict(f2)));}
 console.log(js(C));
})();
