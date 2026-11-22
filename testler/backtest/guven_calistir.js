"use strict";
const fs=require("fs"),G=require("./guven_lib.js"),L=require("./backtest-lib.js");
const ds=JSON.parse(fs.readFileSync(__dirname+"/veri-f1db-2020-2026.json","utf8"));
(async()=>{const {tv}=L.veriKatmani(ds),out={};
 const T=await L.calistir(ds,{tv:tv,sezonlar:[2023,2024,2025,2026],modlar:["PRE_WEEKEND","POST_QUALIFYING"],ozellikleriTut:true}),rows=G.yarisSatirlari(T);
 for(const m of ["PRE_WEEKEND","POST_QUALIFYING"]){out[m]=G.degerle(rows,m);const o=out[m];console.log(m,o.durum,o.monoton.neden,"tutarli",o.sezonTutarli,JSON.stringify(o.grup),JSON.stringify(o.kesim),JSON.stringify(o.sezon));}
 fs.writeFileSync(__dirname+"/guven_sonuc_v3.json",JSON.stringify(out,null,1));})();
