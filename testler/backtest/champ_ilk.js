"use strict";
const fs=require("fs"),C=require("./champ_lib.js"),L=C.L;
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
(async()=>{const {tv}=L.veriKatmani(ds),H=await C.hazirla(ds,tv,[2021,2022,2023,2024,2025]);
 const sat={eski:[],yeniKural:[],bazA:[],bazB:[]};
 const f=x=>(+x).toFixed(3);
 H.forEach(h=>{const e=C.degerle(h,C.motorCalistir(C.ESKI,h,false)),y=C.degerle(h,C.motorCalistir(C.TM,h,true));
  const ids=h.ids.filter(d=>h.puan[d]!==undefined||true),pa=C.bazA(h.puan,ids),pb=C.bazB(h.puan,ids,h.elTrue.elendi,h.elTrue.maxKalan);
  const a=C.olc(ids,pa,h.sampiyon),b=C.olc(ids,pb,h.sampiyon);sat.eski.push(e);sat.yeniKural.push(y);sat.bazA.push(a);sat.bazB.push(b);
  console.log(h.S,h.cp.padEnd(4),"R"+h.R,"şamp "+h.sampiyon.slice(0,6),"| eski p",f(e.pSampiyon),e.birinci?"1.":"  ","yanlışEl",e.yanlisEleme,"kaçan",e.kacanEleme,"| yeni p",f(y.pSampiyon),y.birinci?"1.":"  ","yEl",y.yanlisEleme,"kç",y.kacanEleme,"| A",f(a.pSampiyon),"B",f(b.pSampiyon));});
 for(const k in sat){const o=C.ozet(sat[k]);console.log(k.padEnd(9),JSON.stringify(Object.fromEntries(Object.entries(o).map(([a,b])=>[a,+(+b).toFixed(3)]))));}
})();
