"use strict";
const fs=require("fs"),C=require("./champ_lib.js"),L=C.L,TM=C.TM;
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
(async()=>{const {tv}=L.veriKatmani(ds),SEZ=[2021,2022,2023,2024,2025],H=await C.hazirla(ds,tv,SEZ),H26=await C.hazirla(ds,tv,[2026]);
 const modeller={eski:h=>C.degerle(h,C.motorCalistir(C.ESKI,h,false)),kuralSadece:h=>C.degerle(h,C.motorCalistir(TM,h,false)),kuralSprint:h=>C.degerle(h,C.motorCalistir(TM,h,true)),
  bazA:h=>C.olc(h.ids,C.bazA(h.puan,h.ids),h.sampiyon),bazB:h=>C.olc(h.ids,C.bazB(h.puan,h.ids,h.elTrue.elendi,h.elTrue.maxKalan),h.sampiyon)};
 const R={sezonlar:SEZ,satir:[],ozet:{},checkpoint:{},kalibrasyon:{},denetim:{},sezon2026:[]};
 H.forEach(h=>{const r={S:h.S,cp:h.cp,R:h.R,T:h.T,sampiyon:h.sampiyon};for(const k in modeller){r[k]=modeller[k](h);}R.satir.push(r);});
 for(const k in modeller){R.ozet[k]=C.ozet(R.satir.map(r=>r[k]));R.checkpoint[k]={};["25%","50%","75%","son5"].forEach(c=>{R.checkpoint[k][c]=C.ozet(R.satir.filter(r=>r.cp===c).map(r=>r[k]));});}
 R.sezon={};for(const k of ["eski","kuralSprint","bazB"]){R.sezon[k]={};SEZ.forEach(s=>{R.sezon[k][s]=C.ozet(R.satir.filter(r=>r.S===s).map(r=>r[k]));});}
 // kalibrasyon kovaları (checkpoint×pilot), kuralSprint
 const pr=[];H.forEach(h=>{const c=C.motorCalistir(TM,h,true);c.suruculer.forEach(s=>pr.push({p:s.championshipProbability||0,y:s.driver===h.sampiyon?1:0}));});
 R.kalibrasyon=C.kovalar(pr,[0,0.05,0.15,0.3,0.5,0.8,0.9801,1.0001]);
 // denetim (kuralSprint ve kuralSadece)
 for(const k of ["eski","kuralSadece","kuralSprint"]){const l=R.satir.map(r=>r[k]);R.denetim[k]={yanlisEleme:l.reduce((a,b)=>a+b.yanlisEleme,0),kacanEleme:l.reduce((a,b)=>a+b.kacanEleme,0),elenenSampiyon:l.filter(b=>b.elenenSampiyon).length,elenenPPozitif:l.reduce((a,b)=>a+b.elenenPPozitif,0),aralikIhlal:l.reduce((a,b)=>a+b.aralikIhlal,0),garantiN:l.filter(b=>b.garantiGercek).length,garantiOk:l.filter(b=>b.garantiOk===true).length,fazlaGuven:l.filter(b=>b.fazlaGuven).length,toplamMin:Math.min.apply(null,l.map(b=>b.toplam)),toplamMax:Math.max.apply(null,l.map(b=>b.toplam)),max25:Math.max.apply(null,R.satir.filter(r=>r.cp==="25%").map(r=>r[k].max))};}
 // 2026 (şampiyon belli değil → puanlanmaz; yalnız tutarlılık)
 H26.forEach(h=>{const c=C.motorCalistir(TM,h,true),l=c.suruculer.slice(0,3).map(s=>[s.driver,s.championshipProbability]);R.sezon2026.push({cp:h.cp,R:h.R,top3:l,toplam:c.suruculer.reduce((a,s)=>a+(s.championshipProbability||0),0),elenen:c.suruculer.filter(s=>s.elendi).length,kural:c.meta.kural});});
 fs.writeFileSync(__dirname+"/champ_sonuc_v1.json",JSON.stringify(R,null,1));
 const f=x=>(+x).toFixed(3);
 for(const k in R.ozet){const o=R.ozet[k];console.log(k.padEnd(11),"n",o.n,"pŞamp",f(o.pSampiyon),"brier",f(o.brier),"ll",f(o.logLoss),"top1",f(o.birinci),"top3",f(o.ilk3),"toplam",f(o.toplamMin),f(o.toplamMax));}
 for(const c of ["25%","50%","75%","son5"]){console.log(c,Object.keys(R.checkpoint).map(k=>k+" p"+f(R.checkpoint[k][c].pSampiyon)+"/b"+f(R.checkpoint[k][c].brier)).join("  "));}
 console.log(JSON.stringify(R.denetim));console.log(JSON.stringify(R.kalibrasyon.map(b=>[b.n,b.ortTahmin&&+b.ortTahmin.toFixed(3),b.gozlenen&&+b.gozlenen.toFixed(3)])));
 console.log(JSON.stringify(R.sezon2026.map(x=>[x.cp,x.R,x.top3.map(t=>t[0].slice(0,5)+" "+t[1]).join(","),f(x.toplam),x.elenen])));
})();
