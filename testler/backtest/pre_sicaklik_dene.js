"use strict";
const fs=require("fs"),K=require("./kalibrasyon_lib.js"),L=K.L,TM=K.TM;
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
(async()=>{const {tv}=L.veriKatmani(ds);const T=await L.calistir(ds,{tv:tv,sezonlar:[2023,2024,2025,2026],modlar:["PRE_WEEKEND"],ozellikleriTut:true});
const base=K.kopya(TM.AGIRLIK.PRE_WEEKEND),s0=K.kopya(TM.PARAM.SICAKLIK);
for(const c of [1,0.8,0.65,0.5]){const row=[c];for(const s of [2023,2024,2025,2026]){const y=T.filter(t=>t.season===s),u=K.uniOlc(y);
 const x=K.skorlar(K.calistirCfg({mod:"PRE_WEEKEND",agirlik:base,sicaklik:{win:s0.win,podium:s0.podium*c,points:s0.points*c}},y),u);row.push(s+": bP "+x.m.brierPodium.toFixed(4)+" bQ "+x.m.brierPoints.toFixed(4)+" top3 "+x.m.top3.toFixed(2));}console.log(row.join(" | "));}})();
