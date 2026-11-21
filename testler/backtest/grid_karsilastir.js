"use strict";
const fs=require("fs"),K=require("./kalibrasyon_lib.js"),L=K.L,TM=K.TM;
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
(async()=>{
 const {tv}=L.veriKatmani(ds),T=await L.calistir(ds,{tv:tv,sezonlar:[2023,2024,2025,2026],modlar:["POST_QUALIFYING"],ozellikleriTut:true});
 const mod="POST_QUALIFYING",A0=K.kopya(K.ESKI.AGIRLIK[mod]);
 const mevcut={recentForm:0.073,qualifyingForm:0.055,grid:0.55,teamForm:0.149,reliability:0.042,trackHistory:0.048,teammateDelta:0.014,telemetrySummary:0.069};   // v2 motor ağırlıkları (sabit referans)
 function yenidenOlcekle(w,g){const k=(1-g)/(1-w.grid),o={};Object.keys(w).forEach(a=>{o[a]=a==="grid"?g:w[a]*k;});return K.yuv(o);}
 const adaylar=[{ad:"A_0.55",grid:0.55,agirlik:yenidenOlcekle(mevcut,0.55)},{ad:"B_0.65",grid:0.65,agirlik:yenidenOlcekle(mevcut,0.65)}];
 const out={adaylar:adaylar.map(a=>({ad:a.ad,agirlik:a.agirlik})),foldlar:[],sezon:{},havuz:{}};
 const ev=(cfg,y)=>{const u=K.uniOlc(y),x=K.skorlar(K.calistirCfg(cfg,y),u);return Object.assign({J:K.J(x)},x.m);};
 const cfgler={};
 for(const f of K.FOLDLAR){const tr=T.filter(t=>f.train.indexOf(t.season)>=0),va=T.filter(t=>t.season===f.val);
  const r={val:f.val};for(const a of adaylar){const s=K.sec(mod,[a],tr,null)[0],cfg={mod:mod,agirlik:s.agirlik,sicaklik:s.sicaklik};r[a.ad]={sicaklik:s.sicaklik,valid:ev(cfg,va)};}
  out.foldlar.push(r);}
 // sezon bazlı + havuz: sıcaklık, 2023-25 eğitimiyle seçilmiş (2026 gerçek OOS)
 const tr3=T.filter(t=>t.season<=2025);
 for(const a of adaylar){const s=K.sec(mod,[a],tr3,null)[0];cfgler[a.ad]={mod:mod,agirlik:s.agirlik,sicaklik:s.sicaklik};}
 [2024,2025,2026].forEach(y=>{out.sezon[y]={};adaylar.forEach(a=>{out.sezon[y][a.ad]=ev(cfgler[a.ad],T.filter(t=>t.season===y));});});
 const va3=T.filter(t=>t.season>=2024);adaylar.forEach(a=>{out.havuz[a.ad]=ev(cfgler[a.ad],va3);});
 out.sicaklik={A:cfgler["A_0.55"].sicaklik,B:cfgler["B_0.65"].sicaklik};
 // baseline
 const ids=t=>t.suruculer.map(s=>s.driver),grid=L.gridTablosu(ds,[2020,2021,2022,2023]),bz=fn=>L.olc(va3.map(t=>Object.assign(fn(t),{gercek:t.gercek})));
 out.baz={harmonik:bz(t=>L.bazPost(ds,t.season,t.round,ids(t))),ogrenilmis:bz(t=>L.bazGridEmp(ds,t.season,t.round,ids(t),grid))};
 [2024,2025,2026].forEach(y=>{const v=T.filter(t=>t.season===y),b2=fn=>L.olc(v.map(t=>Object.assign(fn(t),{gercek:t.gercek})));out.baz["s"+y]={harmonik:b2(t=>L.bazPost(ds,t.season,t.round,ids(t))),ogrenilmis:b2(t=>L.bazGridEmp(ds,t.season,t.round,ids(t),grid))};});
 // kalibrasyon kovaları (havuz)
 for(const a of adaylar){const sat=K.calistirCfg(cfgler[a.ad],va3);out.havuz[a.ad+"_kal"]=L.kovalar(sat,"win",[0,0.1,0.2,0.3,0.4,0.6,1.0001]).map(b=>[b.n,b.ortTahmin&&+b.ortTahmin.toFixed(3),b.gozlenen&&+b.gozlenen.toFixed(3)]);}
 out.karar=require("./karar_lib.js").karar(Object.fromEntries([2024,2025,2026].map(y=>[y,{A:out.sezon[y]["A_0.55"],B:out.sezon[y]["B_0.65"]}])),{A:out.havuz["A_0.55"],B:out.havuz["B_0.65"]});
 fs.writeFileSync(__dirname+"/grid_karar_v3.json",JSON.stringify(out,null,1));
 const f=x=>(+x).toFixed(4),row=o=>`J ${f(o.J)} bW ${f(o.brierWin)} ll ${f(o.logLossWin)} t1 ${f(o.top1)} t3 ${f(o.top3)} bP ${f(o.brierPodium)} bQ ${f(o.brierPoints)}`;
 out.foldlar.forEach(r=>{console.log("fold",r.val,"\n A",row(r["A_0.55"].valid),JSON.stringify(r["A_0.55"].sicaklik),"\n B",row(r["B_0.65"].valid),JSON.stringify(r["B_0.65"].sicaklik));});
 [2024,2025,2026].forEach(y=>{console.log(y,"\n A",row(out.sezon[y]["A_0.55"]),"\n B",row(out.sezon[y]["B_0.65"]));});
 console.log("havuz\n A",row(out.havuz["A_0.55"]),"\n B",row(out.havuz["B_0.65"]));
 console.log("baz",JSON.stringify(["harmonik","ogrenilmis"].map(k=>[k,f(out.baz[k].brierWin),f(out.baz[k].logLossWin),f(out.baz[k].top1),f(out.baz[k].top3)])));
 [2024,2025,2026].forEach(y=>console.log(" baz",y,JSON.stringify(["harmonik","ogrenilmis"].map(k=>[k,f(out.baz["s"+y][k].brierWin),f(out.baz["s"+y][k].top1)]))));
 console.log("KARAR",JSON.stringify(out.karar));
 console.log("kalA",JSON.stringify(out.havuz["A_0.55_kal"]),"\nkalB",JSON.stringify(out.havuz["B_0.65_kal"]));
})();
