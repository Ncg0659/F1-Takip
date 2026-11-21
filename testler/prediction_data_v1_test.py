# prediction_data_v1_test — prediction-data.js: sentetik Jolpica/telemetri/hava taklidi (ağ yok). Çalıştır: python3 prediction_data_v1_test.py
import json,subprocess,sys
S=[]
def k(a,ok,ek=""):
    S.append(bool(ok)); print(("PASS " if ok else "FAIL ")+a+((" | "+str(ek)[:300]) if not ok else ""),flush=True)
JS=r'''
const P=require("/home/claude/f1-takip/prediction-data.js");
const SUR=[["ver","VER","red"],["per","PER","red"],["nor","NOR","mcl"],["pia","PIA","mcl"],["ham","HAM","fer"],["lec","LEC","fer"]];
const CIRC=["c1","c2","c3"]; const PTS=[25,18,15,12,10,8];
const roundsOf=y=>y===2026?10:6;
const circ=(y,r)=>CIRC[(r-1)%3];
function res(y,r){ return SUR.map(([d,c,t],i)=>{ const dnf=(d==="per"&&r===3); const leak=(y===2026&&r>=6&&d==="ver");
   return {position:String(i+1),positionText:dnf?"R":String(i+1),points:leak?"999":(dnf?"0":String(PTS[i])),grid:String(d==="ver"?3:i+1),status:dnf?"LEAKSTATUS-Engine":(leak?"LEAK":"Finished"),
     Driver:{driverId:d,code:c},Constructor:{constructorId:t}}; }); }
function qual(y,r){ return SUR.map(([d,c,t],i)=>({position:String(d==="ver"?2:(d==="per"?1:i+1)),Driver:{driverId:d,code:c},Constructor:{constructorId:t}})); }
const race=(y,r,extra)=>Object.assign({season:String(y),round:String(r),raceName:"GP"+r,date:y+"-0"+Math.min(r,9)+"-01",Circuit:{circuitId:circ(y,r)}},extra);
let req=[], mode={fail2026res:false};
async function jolpica(yol){ req.push(yol); const m=yol.match(/^(\d{4})\/(results|qualifying|races)\/?\?limit=(\d+)(?:&offset=(\d+))?/), pm=yol.match(/^(\d{4})\/(\d+)\/pitstops/);
  if(pm){ const y=+pm[1], r=+pm[2]; return {tur:"ok",veri:{RaceTable:{Races:[{round:String(r),PitStops:SUR.map(([d],i)=>({driverId:d,lap:"20",duration:String(22+i*0.1+(d==="ver"?0:0))}))}]}}}; }
  if(!m) return {tur:"bos",veri:null}; const y=+m[1], t=m[2], off=+(m[4]||0); if(y<2022||y>2026) return {tur:"bos",veri:null,http:404};
  if(mode.fail2026res&&y===2026&&t==="results") return {tur:"hata",veri:null};
  const n=roundsOf(y); let races=[];
  for(let r=1;r<=n;r++){ if(t==="results") races.push(race(y,r,{Results:res(y,r)})); else if(t==="qualifying") races.push(race(y,r,{QualifyingResults:qual(y,r)})); else races.push(race(y,r,{})); }
  if(t!=="races"){ // sayfalama: her sayfa 100 satır
    const flat=[]; races.forEach(rc=>{ const a=rc.Results||rc.QualifyingResults; a.forEach(x=>flat.push([rc,x])); });
    const part=flat.slice(off,off+100), by={}; part.forEach(([rc,x])=>{ (by[rc.round]=by[rc.round]||Object.assign({},rc,{Results:undefined,QualifyingResults:undefined,[t==="results"?"Results":"QualifyingResults"]:[]}))[t==="results"?"Results":"QualifyingResults"].push(x); });
    return {tur:"ok",veri:{total:String(flat.length),RaceTable:{Races:Object.values(by)}}}; }
  return {tur:"ok",veri:{total:String(races.length),RaceTable:{Races:races}}}; }
let tcalls=[], hcalls=[];
const tele={ async oturumBul(kayit,seans){ tcalls.push([+kayit.round,seans,+kayit.season]); return {durum:"ok",oturum:{session_key:900+(+kayit.round),season:+kayit.season}}; },
  async suruculer(o){ return {durum:"ok",suruculer:SUR.map(([d,c],i)=>({driver:i+1,kod:c}))}; },
  async enHizliTurTelemetri(o,drv){ const ornekler=[]; for(let i=0;i<40;i++) ornekler.push({t:i*2000,speed:100+i*5,throttle:i%4===0?100:60,brake:i%5===0?100:0,gear:3+(i%4),rpm:9000+i*50,x:null,y:null});
     return {durum:"ok",tur:{lap:7,duration:80,s1:25,s2:28,s3:27},telemetri:{lap:7,tur:{duration:80,s1:25,s2:28,s3:27},ornekler,stint:{stint:1,compound:"MEDIUM",lapStart:1,lapEnd:20}}}; },
  async stintler(o){ return {durum:"ok",stintler:[{driver:1,stint:1,compound:"MEDIUM",lapStart:1,lapEnd:20},{driver:1,stint:2,compound:"HARD",lapStart:21,lapEnd:50}]}; } };
const hava=async(kayit,s)=>{ hcalls.push([+kayit.round,s,+kayit.season]); return {durum:"ok",ozet:{hava:{min:20,max:24},pist:{min:30,max:34},maxRuzgar:5,yagis:{olcumVar:true,goruldu:false}}}; };
const pistler={c1:{uzunlukKm:5.0},c2:{uzunlukKm:3.3},c3:{uzunlukKm:4.3}}; const sinif={kategoriOf:id=>id==="c2"?"sokak":"karma"};
const mk=(o)=>P.kur(Object.assign({jolpica,telemetri:tele,hava,pistler,siniflandirma:sinif,gecmisHava:true},o||{}));
(async()=>{ const R={};
 R.w=P.sezonAgirligi(2026,2026)===1&&P.sezonAgirligi(2026,2025)<1&&P.sezonAgirligi(2026,2024)<P.sezonAgirligi(2026,2025)&&P.sezonAgirligi(2026,2022)<P.sezonAgirligi(2026,2023)&&P.sezonAgirligi(2026,2022)>0&&P.sezonAgirligi(2026,2021)===0&&P.sezonAgirligi(2026,2027)===0;
 let s=mk(); req=[]; let f=await s.ozellik({season:2026,round:6,driver:"ver",mode:"PRE_WEEKEND"});
 R.ok=f.durum==="ok"; const J=JSON.stringify(f);
 R.win5=!req.some(u=>/^(2021|2020|2019)/.test(u))&&req.some(u=>/^2022\//.test(u)); 
 R.leakNone=!/LEAK/.test(J)&&!/999/.test(J);
 R.ownRound=f.meta.sonKullanilan==="2026-5"&&f.meta.kullanilanYaris===174;
 R.form=f.recentForm.n===5&&f.recentForm.degerler.join()==="1,1,1,1,1"&&f.recentForm.sezonPuani===125&&f.recentForm.sezonSirasi===1&&f.recentForm.egim===0;
 R.qform=f.qualifyingForm.n===5&&f.qualifyingForm.ortalama===2&&f.qualifyingForm.buHaftaQualifying===undefined;
 R.gf=f.gridFinishDelta.ortalamaDelta===2&&f.gridFinishDelta.agirlikliDelta===2&&f.gridFinishDelta.buHaftaGrid===undefined;
 R.rel=f.reliability.dnf===0&&f.reliability.bitirmeOrani===1;
 const per=await s.ozellik({season:2026,round:6,driver:"per",mode:"PRE_WEEKEND"});
 R.relPer=per.reliability.n===29&&per.reliability.dnf===5&&Math.abs(per.reliability.dnfOrani-5/29)<0.001&&per.recentForm.degerler.join()==="2,2,,2,2"; 
 R.tm=f.teammateDelta.yarisFinishDelta===1&&f.teammateDelta.qualifyingDelta===-1&&per.teammateDelta.yarisFinishDelta===-1;
 R.trk=f.track.circuitId==="c3"&&f.track.uzunlukKm===4.3&&f.track.sokak===false&&f.track.kategori==="karma"&&f.track.downforce===null&&f.track.lastikAsinmasi===null;
 R.th=f.trackHistory.pilot.n===9&&f.trackHistory.takim.n===18&&f.trackHistory.pilot.agirlikliFinish===1;
 R.tf=f.teamForm.constructorId==="red"&&f.teamForm.son5Puan.n===5&&f.teamForm.son5Puan.seri.join()==="43,43,25,43,43"&&f.teamForm.constructorSirasi===1&&f.teamForm.reliability.dnf===5&&f.teamForm.qualifyingTrend.ortalamaSira===1.5;
 R.pit=f.teamForm.pit&&f.teamForm.pit.n===10&&req.filter(u=>/pitstops/.test(u)).every(u=>+u.match(/^2026\/(\d+)\//)[1]<=5);
 R.tel=f.telemetrySummary&&f.telemetrySummary.kaynak.round===5&&f.telemetrySummary.kaynak.seans==="Race"&&f.telemetrySummary.speed.max===295&&f.telemetrySummary.speed.min===100&&f.telemetrySummary.throttle.tamGazOrani===0.25&&f.telemetrySummary.brake.fren_orani===0.2&&Object.keys(f.telemetrySummary.gearDistribution).length===4&&f.telemetrySummary.rpm.max===10950&&f.telemetrySummary.stint.compound==="MEDIUM"&&f.telemetrySummary.stintOzeti.stintSayisi===2&&f.telemetrySummary.sectors.s2===28&&f.telemetrySummary.speedProfile10.length===10;
 R.telNull=f.telemetrySummary.ersBatarya===null&&f.telemetrySummary.frenSicakligi===null&&f.telemetrySummary.lastikEnerjisi===null&&!/"ornekler"/.test(J);
 R.preWeather=f.weatherContext===null&&!hcalls.some(h=>h[0]===6&&h[2]===2026)&&hcalls.every(h=>h[1]==="Race"&&!(h[2]===2026&&h[0]>=6)); // PRE: yalnız GEÇMİŞ yarış havası (wet/dry geçmişi), hedef yarış havası yok
 R.wetHist=f.track.wetDryGecmisi&&f.track.wetDryGecmisi.n===5&&f.track.wetDryGecmisi.wetOrani===0;
 R.ctx=Array.isArray(f.contextSignals)&&f.contextSignals.length===0;
 R.keys=["season","round","driver","team","track","recentForm","qualifyingForm","gridFinishDelta","reliability","teammateDelta","trackHistory","teamForm","telemetrySummary","weatherContext"].every(x=>x in f)&&f.mode==="PRE_WEEKEND";
 // POST_QUALIFYING
 tcalls=[]; hcalls=[]; const po=await s.ozellik({season:2026,round:6,driver:"ver",mode:"POST_QUALIFYING"}); const JP=JSON.stringify(po);
 R.post=po.durum==="ok"&&po.mode==="POST_QUALIFYING"&&po.qualifyingForm.buHaftaQualifying===2&&po.gridFinishDelta.buHaftaGrid===2;
 R.postNoLeak=!/LEAK/.test(JP)&&!/999/.test(JP)&&po.meta.sonKullanilan==="2026-5"&&po.recentForm.degerler.join()==="1,1,1,1,1";
 R.postTel=tcalls.length>0&&tcalls[0][0]===6&&tcalls[0][1]==="Qualifying"&&po.telemetrySummary.kaynak.seans==="Qualifying"&&po.telemetrySummary.kaynak.round===6;
 R.postWeather=po.weatherContext&&po.weatherContext.kosul==="dry"&&po.weatherContext.havaSicakligi===22&&po.weatherContext.pistSicakligi===32&&hcalls.some(h=>h[0]===6&&h[1]==="Qualifying"&&h[2]===2026)&&!hcalls.some(h=>h[0]===6&&h[1]==="Race"&&h[2]===2026);
 // weather / telemetry yok → null güvenli
 const s2=mk({hava:null,telemetri:null}); const nw=await s2.ozellik({season:2026,round:6,driver:"ver",mode:"POST_QUALIFYING"}); R.nullSafe=nw.durum==="ok"&&nw.weatherContext===null&&nw.telemetrySummary===null;
 const s3=mk({hava:async()=>({durum:"yayimlanmadi"}),telemetri:{oturumBul:async()=>({durum:"yayimlanmadi"})}}); const n3=await s3.ozellik({season:2026,round:6,driver:"ver",mode:"POST_QUALIFYING"}); R.nullSafe2=n3.weatherContext===null&&n3.telemetrySummary===null&&n3.track.wetDryGecmisi===null;
 const s4=mk({telemetri:{oturumBul:async()=>{throw new Error("x")}},hava:async()=>{throw new Error("y")}}); const n4=await s4.ozellik({season:2026,round:6,driver:"ver",mode:"POST_QUALIFYING"}); R.noThrow=n4.durum==="ok"&&n4.weatherContext===null;
 // R=1: önceki sezonlar
 const r1=await s.ozellik({season:2026,round:1,driver:"nor",mode:"PRE_WEEKEND"}); R.round1=r1.durum==="ok"&&r1.meta.sonKullanilan==="2025-6"&&r1.recentForm.n===5&&r1.recentForm.sezonPuani===null&&r1.team==="mcl";
 // yanlış driver/round
 R.wrongDrv=per.driver==="per"&&per.team==="red"&&f.driver==="ver"&&(await s.ozellik({season:2026,round:6,driver:"nor",mode:"PRE_WEEKEND"})).team==="mcl";
 const r8=await s.ozellik({season:2026,round:8,driver:"ver",mode:"PRE_WEEKEND"}); R.wrongRound=r8.meta.sonKullanilan==="2026-7"&&r8.recentForm.sezonPuani===2123&&f.meta.sonKullanilan==="2026-5"&&r8.round===8&&f.round===6;
 R.unknownDrv=(await s.ozellik({season:2026,round:6,driver:"yok",mode:"PRE_WEEKEND"})).durum==="bos";
 R.invalid=(await s.ozellik({season:2026,round:6,driver:"ver",mode:"X"})).durum==="gecersiz"&&(await s.ozellik({season:"a",round:6,driver:"ver",mode:"PRE_WEEKEND"})).durum==="gecersiz";
 // cache
 req.length=0; const again=await s.ozellik({season:2026,round:6,driver:"ver",mode:"PRE_WEEKEND"}); const a2=await s.ozellik({season:2026,round:6,driver:"ver",mode:"POST_QUALIFYING"}); R.dup0=req.length===0&&again===f;
 const s5=mk(); req.length=0; await Promise.all([s5.ozellik({season:2026,round:6,driver:"ver",mode:"PRE_WEEKEND"}),s5.ozellik({season:2026,round:6,driver:"ver",mode:"PRE_WEEKEND"}),s5.ozellik({season:2026,round:6,driver:"nor",mode:"PRE_WEEKEND"})]);
 R.concurrent=req.filter(u=>/^2026\/results/.test(u)).length===1&&req.filter(u=>/^2025\/qualifying/.test(u)).length===req.filter(u=>/^2025\/qualifying/.test(u)).length;
 const sc=mk(); mode.fail2026res=true; const bad=await sc.ozellik({season:2026,round:6,driver:"ver",mode:"PRE_WEEKEND"}); mode.fail2026res=false; req.length=0; const good=await sc.ozellik({season:2026,round:6,driver:"ver",mode:"PRE_WEEKEND"});
 R.failNoCache=bad.durum==="hata"&&good.durum==="ok"&&req.some(u=>/^2026\/results/.test(u));
 const se=P.kur({jolpica:async()=>({tur:"bos",veri:null})}); const emp=await se.ozellik({season:2026,round:6,driver:"ver",mode:"PRE_WEEKEND"}); R.emptyNoCache=emp.durum==="hata"||emp.durum==="bos";
 R.emptyNotCached=Object.keys(se._onbellek.veri).length===0&&Object.keys(se._onbellek.ozellik).length===0;
 console.log(JSON.stringify(R)); })();
'''
out=subprocess.run(["node","-e",JS],capture_output=True,text=True)
if out.returncode: print(out.stderr[:1500]); sys.exit(1)
R=json.loads(out.stdout.strip().splitlines()[-1])
M={"w":"sezon ağırlıkları (azalan, 5 sezon dışı 0)","ok":"feature üretildi","win5":"son 5 sezon sınırı (2021 ve eski istenmez)","leakNone":"sızıntı yok (hedef yarış sonucu çıktıda yok)","ownRound":"Round N sonucu kendi tahminine girmiyor","form":"son 5 yarış formu","qform":"qualifying form","gf":"grid/finish delta","rel":"reliability","relPer":"reliability DNF (per)","tm":"takım arkadaşı kıyası","trk":"track features (pist, uzunluk, sokak, downforce null)","th":"track history (pilot/takım)","tf":"team form","pit":"pit (yalnız önceki yarışlar)","tel":"telemetry özeti","telNull":"ERS/fren sıcaklığı/lastik enerjisi null, ham örnek yok","preWeather":"PRE: hedef yarış havası yok","wetHist":"wet/dry geçmişi (önceki yarışlar)","ctx":"contextSignals boş","keys":"feature alanları","post":"POST_QUALIFYING: quali/grid dahil","postNoLeak":"POST: yarış sonucu yok","postTel":"POST telemetri: bu haftanın Qualifying","postWeather":"POST hava: Qualifying (Race yok)","nullSafe":"hava/telemetri yoksa null","nullSafe2":"yayımlanmadı → null","noThrow":"kaynak hatası fırlatmaz","round1":"Round 1: yalnız önceki sezonlar","wrongDrv":"yanlış driver karışmıyor","wrongRound":"yanlış round karışmıyor","unknownDrv":"bilinmeyen pilot → bos","invalid":"geçersiz giriş","dup0":"cache duplicate fetch 0","concurrent":"eşzamanlı istek tek sezon fetch","failNoCache":"başarısız yanıt cache'lenmez","emptyNoCache":"boş yanıt durumu","emptyNotCached":"boş yanıt cache'lenmez"}
for a,b in M.items(): k(b,R.get(a) is True,R.get(a))
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); net=[]
    pg.route("**/*",lambda r:(net.append(r.request.url),r.abort())[1] if r.request.url.startswith("http") else r.continue_())
    pg.goto("file:///home/claude/f1-takip/index.html"); pg.wait_for_timeout(1200)
    k("tarayıcı: TahminVeri yüklü, varsayılan örnek bağlı",pg.evaluate("typeof TahminVeri.kur==='function'&&typeof TahminVeri.varsayilan.ozellik==='function'"))
    k("yükleme tek başına prediction isteği atmıyor (lazy)",not [u for u in net if "/results" in u and "limit=100" in u])
    r=pg.evaluate("TahminVeri.varsayilan.ozellik({season:2026,round:5,driver:'norris',mode:'PRE_WEEKEND'}).then(x=>x.durum)"); k("ağ yokken raw hata yok (durum=hata)",r=="hata",r)
    k("JS hatası yok",not errs,errs); br.close()
print(sum(S),"/",len(S))
