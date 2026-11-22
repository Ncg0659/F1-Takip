"use strict";
const fs=require("fs"),C=require("./champ_lib.js"),L=C.L,TM=C.TM;
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
const SEZ=[2021,2022,2023,2024,2025],FOLD=[{val:2023,train:[2021,2022]},{val:2024,train:[2021,2022,2023]},{val:2025,train:[2021,2022,2023,2024]}];
const GRID={YAYILIM:[3,4,5,6],FORM_PILOT:[0.6,0.7,0.8],DNF_ETKI:[0,0.25,0.5]};   // varsayılan etrafında küçük adımlar
function adaylar(){const o=[];GRID.YAYILIM.forEach(a=>GRID.FORM_PILOT.forEach(b=>GRID.DNF_ETKI.forEach(c=>[0].forEach(d=>o.push({YAYILIM:a,FORM_PILOT:b,FORM_TAKIM:Math.round((1-b)*100)/100,DNF_ETKI:c})))));return o;}
function kos(H,par){const S=TM.PARAM.SAMPIYONLUK,eski=JSON.parse(JSON.stringify(S));try{Object.assign(S,par);return H.map(h=>C.degerle(h,C.motorCalistir(TM,h,true)));}finally{Object.assign(S,eski);}}
function bazA(H){return H.map(h=>C.olc(h.ids,C.bazA(h.puan,h.ids),h.sampiyon));}
function J(ms,ref){const o=C.ozet(ms),r=C.ozet(ref);return 0.5*o.brier/r.brier+0.5*o.logLoss/r.logLoss;}
(async()=>{const {tv}=L.veriKatmani(ds),H=await C.hazirla(ds,tv,SEZ),cand=adaylar(),taban=JSON.parse(JSON.stringify(TM.PARAM.SAMPIYONLUK));
 const varsayilan={YAYILIM:taban.YAYILIM,FORM_PILOT:taban.FORM_PILOT,FORM_TAKIM:taban.FORM_TAKIM,DNF_ETKI:taban.DNF_ETKI};
 const out={taban:varsayilan,adayN:cand.length,foldlar:[]};
 const sezonlu=s=>H.filter(h=>s.indexOf(h.S)>=0);
 for(const f of FOLD){const tr=sezonlu(f.train),va=sezonlu([f.val]),refTr=bazA(tr),refVa=bazA(va);
  const sira=cand.map(c=>({c:c,j:J(kos(tr,c),refTr)})).sort((a,b)=>a.j-b.j||JSON.stringify(a.c)<JSON.stringify(b.c)?-1:1);
  const sec=sira[0].c,mv=kos(va,sec),dv=kos(va,varsayilan),dtr=J(kos(tr,varsayilan),refTr);
  out.foldlar.push({secilenJ:J(mv,refVa),varsayilanJ:J(dv,refVa),secilenM:null,val:f.val,secilen:sec,egitimJ:sira[0].j,varsayilanEgitimJ:dtr,validSecilen:C.ozet(mv),validVarsayilan:C.ozet(dv),validBazA:C.ozet(refVa),ilk3:sira.slice(0,3).map(x=>[JSON.stringify(x.c),+x.j.toFixed(4)])});}
 // tüm 5 sezon: aday sıralaması (bilgi) ve LOSO tutarlılığı
 const refAll=bazA(H),tum=cand.map(c=>({c:c,j:J(kos(H,c),refAll)})).sort((a,b)=>a.j-b.j);
 out.tumSezonIlk5=tum.slice(0,5).map(x=>[JSON.stringify(x.c),+x.j.toFixed(4)]);out.varsayilanTumJ=J(kos(H,varsayilan),refAll);
 // tek-parametre duyarlılığı (diğerleri varsayılan)
 out.tekParam={};for(const k of Object.keys(GRID)){out.tekParam[k]=GRID[k].map(v=>{const c=Object.assign({},varsayilan,{[k]:v});if(k==="FORM_PILOT"){c.FORM_TAKIM=Math.round((1-v)*100)/100;}const per={};SEZ.forEach(s=>{per[s]=+J(kos(sezonlu([s]),c),bazA(sezonlu([s]))).toFixed(4);});return {v:v,J:+J(kos(H,c),refAll).toFixed(4),sezon:per};});}
 out.karar=require("./champ_karar.js").karar(out.foldlar.map(r=>({val:r.val,secilenJ:r.secilenJ,varsayilanJ:r.varsayilanJ,secilen:r.validSecilen,varsayilan:r.validVarsayilan}))); fs.writeFileSync(__dirname+"/champ_kalibrasyon_v1.json",JSON.stringify(out,null,1));
 const f=x=>(+x).toFixed(4);out.foldlar.forEach(r=>{console.log("fold",r.val,JSON.stringify(r.secilen),"trJ",f(r.egitimJ),"(varsayılan",f(r.varsayilanEgitimJ)+")");
  const o=(a)=>`brier ${f(a.brier)} ll ${f(a.logLoss)} p ${f(a.pSampiyon)} top1 ${f(a.birinci)}`;console.log("  seçilen ",o(r.validSecilen));console.log("  varsayıl",o(r.validVarsayilan));console.log("  bazA    ",o(r.validBazA));});
 console.log("KARAR",JSON.stringify(out.karar),out.foldlar.map(r=>r.val+": J sec "+r.secilenJ.toFixed(3)+" var "+r.varsayilanJ.toFixed(3)).join(" | "));
 console.log("tüm sezon ilk5",JSON.stringify(out.tumSezonIlk5),"varsayılan J",f(out.varsayilanTumJ));
 for(const k in out.tekParam)console.log(k,out.tekParam[k].map(x=>x.v+":"+x.J).join("  "));
})();
