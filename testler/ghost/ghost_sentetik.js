"use strict";
// Sentetik ama GERÇEK-BİÇİMLİ telemetri üretici (test verisi): bilinen zaman-ilerleme fonksiyonu → delta gerçeği analitik bilinir.
const PS=require("/home/claude/f1-takip/pist-siluetleri.js"), G=require("/home/claude/f1-takip/ghost-hesap.js");
const L=5800; // m
function pf(T,c,k,ph){ // ilerleme p(t) ve türevi; p(0)=0, p(T)=1
  return { p:t=>t/T+c*Math.sin(2*Math.PI*k*t/T+ph)/(1)-c*Math.sin(ph)*0 , dp:t=>(1/T)*(1+c*T*2*Math.PI*k/T*Math.cos(2*Math.PI*k*t/T+ph)) };
}
// p(0)=0 ve p(T)=1 için ph=0 kullan (sin(0)=0, sin(2πk)=0)
function profil(T,c,k){ return { T, p:t=>t/T+c*Math.sin(2*Math.PI*k*t/T), dp:t=>(1/T)*(1+c*2*Math.PI*k*Math.cos(2*Math.PI*k*t/T)) }; }
function tOf(pr,s){ let lo=0,hi=pr.T; for(let i=0;i<60;i++){const m=(lo+hi)/2; if(pr.p(m)<s)lo=m; else hi=m;} return (lo+hi)/2; }
function yolPoz(id,p0){ const P=G.yolNoktalari(PS.YOL[id]); const C=[0]; for(let i=1;i<=P.length;i++){const a=P[i-1],b=P[i%P.length];C.push(C[i-1]+Math.hypot(b.x-a.x,b.y-a.y));} const T=C[C.length-1];
  return p=>{ let s=((p+p0)%1+1)%1*T; let j=1; while(j<C.length-1&&C[j]<s)j++; const a=P[j-1],b=P[j%P.length],f=(s-C[j-1])/(C[j]-C[j-1]||1); return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f}; }; }
// OpenF1-benzeri koordinat: döndürme+ölçek+ayna+öteleme (decimetre benzeri büyük sayılar)
function openf1Koord(pt,ayna,aciDeg){ const th=aciDeg*Math.PI/180,c=Math.cos(th),s=Math.sin(th),sc=9.7; const x=(pt.x-150)*sc,y=(pt.y-100)*sc; const X=c*x-s*y+4200,Y=s*x+c*y-1700; return {x:Math.round(X),y:Math.round(ayna?-Y:Y)}; }
function turUret(o){ // o: {id, T, c, k, p0, ayna, aci, aralik(ms), konumAralik, eksikKonum, gaz_eksik, konumYok, startMs}
  const pr=profil(o.T,o.c,o.k), pz=yolPoz(o.id,o.p0), car=[], loc=[];
  for(let t=10;t<=o.T*1000;t+=o.aralik||270){ const ts=t/1000, v=3.6*L*pr.dp(ts), dv=3.6*L*(pr.dp(ts+0.1)-pr.dp(ts-0.1));
    const r={date:new Date(o.startMs+t).toISOString(),speed:Math.round(v),throttle:dv>=0?100:Math.max(0,Math.round(60+dv*3)),brake:dv<-8?100:0,n_gear:Math.max(1,Math.min(8,Math.round(v/40))),rpm:Math.round(7000+v*20),drs:0};
    if(o.gazEksik&&Math.round(t/(o.aralik||270))%o.gazEksik===0){delete r.throttle;delete r.brake;}
    car.push(r); }
  if(!o.konumYok) for(let t=0;t<=o.T*1000;t+=o.konumAralik||220){ const q=openf1Koord(pz(pr.p(t/1000)),o.ayna,o.aci); loc.push({date:new Date(o.startMs+t).toISOString(),x:q.x,y:q.y,z:0}); }
  return {car,loc,pr};
}
module.exports={L,profil,tOf,yolPoz,openf1Koord,turUret};
