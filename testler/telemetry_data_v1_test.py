# telemetry_data_v1_test — telemetry-data.js: OpenF1 taklidiyle (ağ yok). Çalıştır: python3 telemetry_data_v1_test.py
import json,subprocess,sys
S=[]
def k(a,ok,ek=""):
    S.append(bool(ok)); print(("PASS " if ok else "FAIL ")+a+((" | "+str(ek)[:300]) if not ok else ""),flush=True)
JS=r'''
const T=require("/home/claude/f1-takip/telemetry-data.js");
const B=Date.parse("2026-07-05T13:00:00Z");
const iso=ms=>new Date(ms).toISOString();
const O1={season:2026,session_key:100}, O2={season:2026,session_key:200};
const LAPS={ "100/1":[{session_key:100,driver_number:1,lap_number:1,date_start:iso(B),lap_duration:90.5,duration_sector_1:30,duration_sector_2:30.2,duration_sector_3:30.3,is_pit_out_lap:true,i1_speed:300},
                     {session_key:100,driver_number:1,lap_number:2,date_start:iso(B+90500),lap_duration:88.123,duration_sector_1:29,duration_sector_2:29.5,duration_sector_3:29.6,is_pit_out_lap:false},
                     {session_key:100,driver_number:1,lap_number:3,date_start:iso(B+178623),lap_duration:null}],
  "100/44":[{session_key:100,driver_number:44,lap_number:2,date_start:iso(B+500),lap_duration:87.9},{session_key:100,driver_number:44,lap_number:3,date_start:iso(B+88400),lap_duration:89.2}],
  "200/1":[{session_key:200,driver_number:1,lap_number:2,date_start:iso(B+9e6),lap_duration:70.0}] };
let log=[]; let mod={fail:false,empty:false,locEmpty:false,r429:false};
function mk(){ log=[]; return T.kur(async yol=>{ log.push(yol); const q=Object.fromEntries((yol.split("?")[1]||"").split("&").map(p=>p.split(/=(.*)/s).slice(0,2)));
  const ep=yol.split("?")[0], sk=q.session_key, dn=q.driver_number;
  if(mod.r429) return {tur:"hata",veri:null,http:429};
  if(mod.fail) return {tur:"hata",veri:null,http:500};
  if(ep==="laps"){ const v=LAPS[sk+"/"+dn]; return v?{tur:"ok",veri:v}:{tur:"bos",veri:null,http:404}; }
  if(ep==="car_data"){ if(mod.empty) return {tur:"ok",veri:[]};
     const lap=Object.values(LAPS).flat().find(l=>String(l.driver_number)===dn&&String(l.session_key)===sk&&q["date>"]===undefined);
     const a=Date.parse(yol.match(/date>=([^&]+)/)[1]); const rows=[];
     for(let i=0;i<5;i++) rows.push({session_key:+sk,driver_number:+dn,date:iso(a+i*270),speed:200+i,throttle:100-i,brake:i%2?100:0,n_gear:5+i,rpm:11000+i,drs:0});
     rows.push({session_key:+sk,driver_number:+dn,date:iso(a+1500),speed:210}); // eksik alanlar
     rows.push({session_key:999,driver_number:+dn,date:iso(a+10),speed:1}); rows.push({session_key:+sk,driver_number:77,date:iso(a+10),speed:2}); // yanlış oturum/sürücü
     return {tur:"ok",veri:rows}; }
  if(ep==="location"){ if(mod.locEmpty) return {tur:"bos",veri:null,http:404}; const a=Date.parse(yol.match(/date>=([^&]+)/)[1]);
     return {tur:"ok",veri:[{session_key:+sk,driver_number:+dn,date:iso(a+30),x:100,y:200,z:0},{session_key:+sk,driver_number:+dn,date:iso(a+300),x:110,y:210,z:1}]}; }
  if(ep==="stints"){ return {tur:"ok",veri:[{session_key:+sk,driver_number:1,stint_number:1,compound:"medium",lap_start:1,lap_end:2,tyre_age_at_start:0},{session_key:+sk,driver_number:1,stint_number:2,compound:"HARD",lap_start:3,lap_end:null},{session_key:+sk,driver_number:44,stint_number:1,compound:"SOFT",lap_start:1,lap_end:30}]}; }
  if(ep==="pit"){ return {tur:"ok",veri:[{session_key:+sk,driver_number:1,lap_number:1,pit_duration:22.1}]}; }
  if(ep==="drivers"){ return {tur:"ok",veri:[{driver_number:1,name_acronym:"VER",full_name:"Max Verstappen"},{driver_number:44,name_acronym:"HAM"}]}; }
  return {tur:"bos",veri:null,http:404}; }); }
(async()=>{ const R={};
 let s=mk(); const tl=await s.turlar(O1,1); R.lapNorm=tl.durum==="ok"&&tl.turlar.length===3&&tl.turlar[1].duration===88.123&&tl.turlar[1].s1===29&&tl.turlar[0].speedTrapI1===300&&tl.turlar[1].s3===29.6;
 R.lapMissingNull=tl.turlar[2].duration===null&&tl.turlar[2].s1===null&&tl.turlar[1].speedTrapI1===null&&tl.turlar[1].pitOut===false;
 R.fastest=T.enHizliTur(tl.turlar).lap===2 && s.enHizliTur([]) === null && T.enHizliTur([{lap:1,duration:null}])===null;
 R.getLap=T.turGetir(tl.turlar,2).lap===2&&T.turGetir(tl.turlar,99)===null;
 const t2=await s.turTelemetri(O1,1,2); const o=t2.ornekler;
 R.tel_ok=t2.durum==="ok"&&o.length===6; // 5 tam + 1 eksik; yanlış oturum/sürücü elendi
 R.speed=o[0].speed===200&&o[4].speed===204; R.throttle=o[0].throttle===100&&o[3].throttle===97; R.brake=o[1].brake===100&&o[0].brake===0; R.gear=o[0].gear===5&&o[4].gear===9; R.rpm=o[0].rpm===11000;
 R.fields=["session","driver","lap","timestamp","speed","throttle","brake","gear","rpm","x","y","compound","stint","pit"].every(f=>f in o[0]);
 R.missing=o[5].throttle===null&&o[5].brake===null&&o[5].gear===null&&o[5].rpm===null&&o[5].speed===210;
 R.wrong=o.every(r=>r.session===100&&r.driver===1&&r.lap===2);
 R.stint=o[0].compound==="MEDIUM"&&o[0].stint===1; const t3=await s.turTelemetri(O1,1,3); R.stint2=t3.durum==="bos"||t3.ornekler[0].compound==="HARD"; 
 R.pit=o[0].pit===false; const t1=await s.turTelemetri(O1,1,1); R.pit1=t1.ornekler[0].pit===true;
 R.loc=o[0].x===100&&o[0].y===200&&o[1].x===110&&t2.konumVar===true; // örnek1 (270ms) → konum 300ms (±150)
 R.locNoGuess=o[3].x===null&&o[3].y===null; // 810ms: ±150ms içinde konum yok → tahmin yok
 // location yok
 mod.locEmpty=true; s=mk(); const tn=await s.turTelemetri(O1,1,2); R.noLoc=tn.durum==="ok"&&tn.konumVar===false&&tn.ornekler.every(r=>r.x===null&&r.y===null); mod.locEmpty=false;
 // cache duplicate
 s=mk(); await s.turTelemetri(O1,1,2); const n1=log.length; await s.turTelemetri(O1,1,2); await s.turlar(O1,1); await Promise.all([s.turTelemetri(O1,1,2),s.turTelemetri(O1,1,2)]); R.dup0=log.length===n1;
 // eşzamanlı çift istek → tek fetch
 s=mk(); await Promise.all([s.turlar(O1,44),s.turlar(O1,44),s.turlar(O1,44)]); R.concurrent=log.filter(x=>x.startsWith("laps")).length===1;
 // başarısız cache yok
 mod.fail=true; s=mk(); const f1=await s.turlar(O1,1); const nf=log.length; mod.fail=false; const f2=await s.turlar(O1,1); R.failNoCache=f1.durum==="hata"&&f2.durum==="ok"&&log.length===nf+1;
 mod.empty=true; s=mk(); const e1=await s.turTelemetri(O1,1,2); mod.empty=false; const e2=await s.turTelemetri(O1,1,2); R.emptyNoCache=e1.durum==="bos"&&e2.durum==="ok";
 mod.r429=true; s=mk(); const r4=await s.turlar(O1,1); mod.r429=false; R.rate=r4.durum==="hata";
 s=mk(); const n4=await s.turlar(O1,555); R.http404=n4.durum==="bos"; R.invalid=(await s.turlar(null,1)).durum==="gecersiz"&&(await s.turTelemetri(O1,1,"x")).durum==="gecersiz";
 const th=await mk().turTelemetri(O1,1,99); R.noLapGraceful=th.durum==="bos";
 const brk=T.kur(async()=>{throw new Error("ağ koptu")}); const rb=await brk.turlar(O1,1); R.noThrow=rb.durum==="hata"&&!rb.stack;
 // iki pilot eşleştirme + hızlı tur
 s=mk(); const p=await s.eslestir(O1,1,44,2); R.pair=p.durum==="ok"&&p.session===100&&p.a.telemetri.driver===1&&p.b.telemetri.driver===44&&p.a.telemetri.lap===2&&p.b.telemetri.lap===2;
 const pf=await s.eslestir(O1,1,44,"fastest"); R.pairFastest=pf.durum==="ok"&&pf.a.tur.lap===2&&pf.b.tur.lap===2&&pf.a.tur.duration===88.123&&pf.b.tur.duration===87.9;
 R.pairSame=(await s.eslestir(O1,1,1,2)).durum==="gecersiz";
 // yanlış oturum/sürücü karışmıyor
 const x=await s.turlar(O2,1); R.sessionIso=x.turlar.length===1&&x.turlar[0].session===200&&x.turlar[0].duration===70.0;
 const raw=T.turlariNormalle([{session_key:100,driver_number:2,lap_number:1,lap_duration:1},{session_key:300,driver_number:1,lap_number:1,lap_duration:2},{session_key:100,driver_number:1,lap_number:1,lap_duration:3}],100,1); R.mixFilter=raw.length===1&&raw[0].duration===3;
 const sd=await s.suruculer(O1); R.drivers=sd.durum==="ok"&&sd.suruculer.length===2&&sd.suruculer[0].kod==="VER";
 // yasak alanlar uydurulmuyor
 R.noInvented=!("brakeTemp" in o[0])&&!("ers" in o[0])&&!("tyreEnergy" in o[0]);
 console.log(JSON.stringify(R)); })();
'''
out=subprocess.run(["node","-e",JS],capture_output=True,text=True)
if out.returncode: print(out.stderr[:800]); sys.exit(1)
R=json.loads(out.stdout.strip().splitlines()[-1])
M={"lapNorm":"lap normalize (süre/sektör/trap)","lapMissingNull":"eksik lap alanları null","fastest":"fastest lap helper (+boş/null güvenli)","getLap":"seçilen lap getir","tel_ok":"car_data normalize (yanlış oturum/sürücü elendi)","speed":"speed","throttle":"throttle","brake":"brake","gear":"gear","rpm":"rpm","fields":"ortak yapı alanları","missing":"eksik alan null","wrong":"örneklerde session/driver/lap doğru","stint":"stint/compound","stint2":"ikinci stint/compound","pit":"pit flag false","pit1":"pit flag true (pit turu)","loc":"location varsa x/y","locNoGuess":"toleransta konum yoksa x/y null (tahmin yok)","noLoc":"location yoksa tahmin yok","dup0":"cache duplicate fetch 0","concurrent":"eşzamanlı çift istek tek fetch","failNoCache":"başarısız yanıt cache'lenmez","emptyNoCache":"boş yanıt cache'lenmez","rate":"429/hata güvenli","http404":"404 → bos","invalid":"geçersiz giriş güvenli","noLapGraceful":"olmayan tur güvenli","noThrow":"ağ hatası fırlatmaz","pair":"iki pilot aynı tur eşleştirme","pairFastest":"iki pilot en hızlı tur eşleştirme","pairSame":"aynı pilot eşleştirme reddedilir","sessionIso":"yanlış session karışmıyor","mixFilter":"yanlış driver/session satırı süzülür","drivers":"sürücü listesi","noInvented":"özel takım verisi uydurulmuyor"}
for a,b in M.items(): k(b,R.get(a) is True,R.get(a))
# tarayıcı: modül yüklenir, mevcut OpenF1 akışı bozulmadı
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    net=[]; pg.route("**/*",lambda r:(net.append(r.request.url),r.abort())[1] if r.request.url.startswith("http") else r.continue_())
    pg.goto("file:///home/claude/f1-takip/index.html"); pg.wait_for_timeout(1500)
    k("tarayıcı: TelemetriVeri yüklü (oturumBul/turTelemetri/eslestir)",pg.evaluate("typeof TelemetriVeri.oturumBul==='function'&&typeof TelemetriVeri.turTelemetri==='function'&&typeof TelemetriVeri.eslestir==='function'&&typeof OpenF1Veri.sonucAl==='function'"))
    k("yükleme tek başına istek atmıyor (lazy)",not [u for u in net if "car_data" in u or "location" in u or "/laps" in u])
    r=pg.evaluate("TelemetriVeri.turTelemetri({season:2026,session_key:1},1,1).then(x=>x.durum)"); k("ağ yokken UI'ya raw hata gitmez (durum=hata)",r=="hata",r)
    k("JS hatası yok",not errs,errs); br.close()
print(sum(S),"/",len(S))
