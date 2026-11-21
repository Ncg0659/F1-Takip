"use strict";
// Sentetik OpenF1 veri seti (test): laps + car_data + location, oturum 100 (yarış) ve 200 (sıralama)
const S=require("./ghost_sentetik.js"), fs=require("fs");
const B0=Date.parse("2026-10-04T05:00:00Z"), Q0=Date.parse("2026-10-03T06:00:00Z");
const tanim=[ // [session, driver, lap, süre, c, k, ek]
 [100,1,1,105.2,.02,3,{pitOut:true,yok:true}],[100,1,2,90.412,.018,3,{}],[100,1,3,89.871,.020,3,{gazEksik:40}],[100,1,4,90.900,.012,3,{}],
 [100,44,1,108.0,.02,3,{pitOut:true,yok:true}],[100,44,2,90.100,.015,3,{}],[100,44,3,90.456,.016,3,{}],[100,44,4,89.950,.017,3,{}],
 [100,16,2,91.0,.014,3,{konumYok:true}],[100,16,3,90.8,.013,3,{konumYok:true}],
 [100,63,2,92.0,.016,3,{konumYok:true}],[100,63,3,91.7,.016,3,{konumYok:true}],
 [100,55,2,91.5,.02,3,{carYok:true}],
 [200,1,2,88.5,.02,3,{}],[200,44,2,88.9,.015,3,{}] ];
const laps={},car={},loc={};
tanim.forEach(([ses,drv,lap,T,c,k,ek])=>{
  const base=(ses===100?B0:Q0)+(lap-1)*120000+(drv%7)*1500, key=ses+"/"+drv;
  (laps[key]=laps[key]||[]).push({session_key:ses,driver_number:drv,lap_number:lap,date_start:new Date(base).toISOString(),lap_duration:ek.yok?null:T,duration_sector_1:ek.yok?null:Math.round(T*0.31*1000)/1000,duration_sector_2:ek.yok?null:Math.round(T*0.37*1000)/1000,duration_sector_3:ek.yok?null:Math.round(T*0.32*1000)/1000,is_pit_out_lap:!!ek.pitOut});
  if(ek.yok) return;
  const u=S.turUret({id:"suzuka",T,c,k,p0:.37,ayna:true,aci:33,startMs:base,gazEksik:ek.gazEksik,konumYok:ek.konumYok});
  const kk=ses+"/"+drv+"/"+new Date(base).toISOString();
  car[kk]=ek.carYok?[]:u.car.map(r=>Object.assign({session_key:ses,driver_number:drv},r));
  loc[kk]=ek.konumYok?null:u.loc.map(r=>Object.assign({session_key:ses,driver_number:drv},r));
});
const stints={},pit=[];[1,44,16,63,55].forEach(d=>{stints[d]={session_key:100,driver_number:d,stint_number:1,compound:"MEDIUM",lap_start:1,lap_end:20,tyre_age_at_start:0};});[1,44].forEach(d=>pit.push({session_key:100,driver_number:d,lap_number:1,pit_duration:22.4}));
fs.writeFileSync(__dirname+"/mock.json",JSON.stringify({laps,car,loc,stints,pit}));
console.log("mock yazıldı", Object.keys(car).length);
