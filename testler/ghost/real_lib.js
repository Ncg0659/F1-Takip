"use strict";
// Gerçek OpenF1 fixture (session 9161, sürücü 63 ve 81) → telemetry-data.js kur() sirali taklidi (ağ YOK)
const fs=require("fs"),zlib=require("zlib"),T=require("/home/claude/f1-takip/telemetry-data.js");
const yuk=n=>JSON.parse(zlib.gunzipSync(fs.readFileSync(__dirname+"/real/"+n+".json.gz")).toString());
const F={laps:{63:yuk("laps_63"),81:yuk("laps_81")},car:{63:yuk("car_63"),81:yuk("car_81")},loc:{63:yuk("loc_63"),81:yuk("loc_81")}};
const OT={season:2023,session_key:9161,meeting_key:1219};
function kur(){ const log=[];
  const tv=T.kur(async yol=>{ log.push(yol); const ep=yol.split("?")[0], q=Object.fromEntries((yol.split("?")[1]||"").split("&").map(p=>p.split(/=(.*)/s).slice(0,2)));
    const dn=Number(q.driver_number); if(q.session_key!=="9161") return {tur:"bos",veri:null,http:404};
    if(ep==="laps") return F.laps[dn]?{tur:"ok",veri:F.laps[dn]}:{tur:"bos",veri:null,http:404};
    if(ep==="car_data"||ep==="location"){ const src=(ep==="car_data"?F.car:F.loc)[dn]; if(!src) return {tur:"bos",veri:null,http:404};
      const a=Date.parse(yol.match(/date>=([^&]+)/)[1]), b=Date.parse(yol.match(/date<=([^&]+)/)[1]); return {tur:"ok",veri:src.filter(r=>{const t=Date.parse(r.date);return t>=a&&t<=b;})}; }
    return {tur:"bos",veri:null,http:404}; });
  return {tv,log}; }
module.exports={F,OT,kur,T};
