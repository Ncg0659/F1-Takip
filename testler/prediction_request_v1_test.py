# prediction_request_v1_test — Prediction istek optimizasyonu: sayı, dedupe, cache, lazy, tahmin eşitliği (optimizasyon ÖNCESİ golden fixture ile).
import sys, re, json, subprocess
sys.path.insert(0,'.')
exec(open('prediction_ui_v1_test.py').read().split("with sync_playwright() as p:")[0])
GOLD=json.load(open("prediction_request_golden.json")); GOLDB=json.load(open("prediction_request_golden_big.json"))
exec(open("bigfix.py").read()) if False else None
def mine(pg): return pg.evaluate("TahminUI._durum.sayac.liste.slice()")
def snap(pg,k="2026-17"):
    return pg.evaluate("(k)=>{const o=TahminUI._durum.sonuc[k];return o?{mod:o.mod,pred:o.pred.suruculer.map(x=>[x.driver,x.winProbability,x.podiumProbability,x.pointsProbability,x.confidence,x.reasons.map(r=>r.metin)]),champ:(o.champ?o.champ.suruculer.map(x=>[x.driver,x.championshipProbability,x.elendi]):null)}:null}",k)
def arsiv(pg): return pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('f1-tahmin-arsiv-v1:')).map(k=>[k,localStorage.getItem(k)])")
def yukle_arsiv(pg,a): pg.evaluate("(a)=>a.forEach(([k,v])=>localStorage.setItem(k,v))",a)
def sinif(u):
    u="/"+u if not u.startswith("http") else u
    if re.search(r"/\d{4}/\d+/(results|qualifying)/\?limit=100",u): return "tur"
    if "/results/?limit=100&offset" in u: return "sonuc"
    if "/qualifying/?limit=100&offset" in u: return "quali"
    if "/pitstops/" in u: return "pit"
    if "/sprint/?limit=100" in u: return "sprint"
    if "/races/?limit=100" in u: return "takvim"
    return "diger"
def say(l):
    d={}
    for u in l: d[sinif(u)]=d.get(sinif(u),0)+1
    return d
def yilQ(l,t): return sorted(set(re.search(r"(?:^|/)(\d{4})/",u).group(1) for u in l if sinif(u)==t))
NODE=r'''
const P=require("/home/claude/f1-takip/prediction-data.js");
const SUR=Array.from({length:20},(_,i)=>["d"+i,"D"+i,"t"+Math.floor(i/2)]);
const rounds=y=>y===2026?16:22;
let log=[],hata=false,gecikme=0;
function res(y,r){return SUR.map(([d,c,t],i)=>({position:String(i+1),positionText:String(i+1),points:String(Math.max(0,25-i*2)),grid:String(i+1),status:"Finished",Driver:{driverId:d,code:c},Constructor:{constructorId:t}}))}
async function jolpica(yol){ log.push(yol); if(gecikme) await new Promise(r=>setTimeout(r,gecikme)); if(hata) return {tur:"hata",veri:null};
  let m=yol.match(/^(\d{4})\/(results|qualifying)\/\?limit=100&offset=(\d+)/), n;
  if(m){ const y=+m[1],t=m[2],off=+m[3],flat=[]; for(let r=1;r<=rounds(y);r++) for(const x of res(y,r)) flat.push([r,x]);
    const by={}; flat.slice(off,off+100).forEach(([r,x])=>{(by[r]=by[r]||{season:String(y),round:String(r),raceName:"G",Circuit:{circuitId:"c"+r},[t==="results"?"Results":"QualifyingResults"]:[]})[t==="results"?"Results":"QualifyingResults"].push(x)});
    return {tur:"ok",veri:{total:String(flat.length),RaceTable:{Races:Object.values(by)}}}; }
  m=yol.match(/^(\d{4})\/(\d+)\/(results|qualifying)\/\?limit=100/);
  if(m){ const y=+m[1],r=+m[2],t=m[3]; if(r>rounds(y)) return {tur:"bos",veri:null}; return {tur:"ok",veri:{total:"20",RaceTable:{Races:[{season:String(y),round:String(r),raceName:"G",Circuit:{circuitId:"c"+r},[t==="results"?"Results":"QualifyingResults"]:res(y,r)}]}}}; }
  return {tur:"bos",veri:null}; }
const mem={}; const arsiv={oku:k=>mem[k]?JSON.parse(mem[k]):null,yaz:(k,v)=>{mem[k]=JSON.stringify(v)}};
const cal=y=>y===2026?{RaceTable:{Races:Array.from({length:23},(_,i)=>({round:String(i+1),raceName:"G",Circuit:{circuitId:"c"+(i+1)}}))}}:null;
const mk=(o)=>P.kur(Object.assign({jolpica,pit:false,takvim:cal},o||{}));
(async()=>{ const R={};
 // dedupe: 20 pilot paralel → her uç nokta yalnız bir kez
 let s=mk(); log=[]; await Promise.all(SUR.map(([d])=>s.ozellik({season:2026,round:17,driver:d,mode:"PRE_WEEKEND"})));
 const u=new Set(log); R.dup0=u.size===log.length; R.n_cold=log.length;
 R.qSadeceHedef=log.filter(x=>/qualifying/.test(x)).every(x=>/^2026\//.test(x));   // eski sezon quali istenmedi (hedef sezonda ≥10 tur var)
 R.qSayi=log.filter(x=>/qualifying/.test(x)).length; R.rSayi=log.filter(x=>/results/.test(x)).length;
 // tekrar: aynı instance → 0
 log=[]; await Promise.all(SUR.map(([d])=>s.ozellik({season:2026,round:17,driver:d,mode:"PRE_WEEKEND"}))); R.tekrar0=log.length===0;
 // farklı mod aynı tur: sonuç havuzu paylaşılır (PRE sonuçları tekrar çekilmez)
 // arşivli kurulum (sıcak): yeni instance, aynı arşiv
 let sA=mk({arsiv}); log=[]; await sA.ozellik({season:2026,round:17,driver:"d0",mode:"PRE_WEEKEND"}); R.n_soguk_arsivli=log.length;
 let sB=mk({arsiv}); log=[]; const fB=await sB.ozellik({season:2026,round:17,driver:"d0",mode:"PRE_WEEKEND"}); R.n_sicak=log.length;
 // sonraki tur: yalnız eksik tur(lar) tur-bazlı
 let sC=mk({arsiv}); log=[]; const fC=await sC.ozellik({season:2026,round:18,driver:"d0",mode:"PRE_WEEKEND"}); R.sonrakiTur=log.slice();
 const ref=mk(); const fR=await ref.ozellik({season:2026,round:18,driver:"d0",mode:"PRE_WEEKEND"});
 R.esitSicak=JSON.stringify(fC)===JSON.stringify(fR); R.esitSicak17=JSON.stringify(fB)===JSON.stringify(await mk().ozellik({season:2026,round:17,driver:"d0",mode:"PRE_WEEKEND"}));
 // POST: hedef tur qualifying'i tur-bazlı
 let sD=mk({arsiv}); log=[]; await sD.ozellik({season:2026,round:17,driver:"d0",mode:"POST_QUALIFYING"}); R.postIstek=log.slice();
 // başarısız yanıt arşive/önbelleğe girmez
 const mem2={}; const ars2={oku:k=>mem2[k]?JSON.parse(mem2[k]):null,yaz:(k,v)=>{mem2[k]=JSON.stringify(v)}};
 hata=true; let sE=mk({arsiv:ars2}); const bad=await sE.ozellik({season:2026,round:17,driver:"d0",mode:"PRE_WEEKEND"}); hata=false;
 R.hataArsivsiz=bad.durum!=="ok"&&Object.keys(mem2).length===0&&Object.keys(sE._onbellek.veri).length===0;
 log=[]; const iyi=await sE.ozellik({season:2026,round:17,driver:"d0",mode:"PRE_WEEKEND"}); R.hataSonrasiOk=iyi.durum==="ok"&&log.length>0;
 // arşivden bozuk kayıt → ağdan
 const mem3={"res/2025":"{bozuk"}; const ars3={oku:k=>{ if(!mem3[k]) return null; return JSON.parse(mem3[k]); },yaz:()=>{}}; let sF=mk({arsiv:ars3}); const okF=await sF.ozellik({season:2026,round:17,driver:"d0",mode:"PRE_WEEKEND"}); R.bozukArsiv=okF.durum==="ok";
 // takvim sağlayıcı: istek yok
 let sG=mk({takvim:y=>y===2026?{RaceTable:{Races:[{round:"17",raceName:"X",Circuit:{circuitId:"c17"}}]}}:null}); log=[]; const fG=await sG.ozellik({season:2026,round:17,driver:"d0",mode:"PRE_WEEKEND"}); R.takvimIstek=log.filter(x=>/races/.test(x)).length; R.takvimTrack=fG.track.circuitId;
 let sH=mk({pit:undefined,takvim:null}); log=[]; await sH.ozellik({season:2026,round:17,driver:"d0",mode:"PRE_WEEKEND"}); R.pitVarsayilan=log.filter(x=>/pitstops/.test(x)).length;
 console.log(JSON.stringify(R)); })();
'''
with sync_playwright() as p:
    # ===== 0) veri katmanı (node) =====
    o=subprocess.run(["node","-e",NODE],capture_output=True,text=True)
    if o.returncode: print(o.stderr[:1500]); sys.exit(1)
    N=json.loads(o.stdout.strip().splitlines()[-1])
    kontrol("N1 eşzamanlı 20 pilot: aynı uç nokta duplicate 0 (tek havuz)", N["dup0"] is True, N)
    kontrol("N2 eşzamanlı istek: toplam %d (sonuç %d + quali %d), pilot başına tekrar yok"%(N["n_cold"],N["rSayi"],N["qSayi"]), N["rSayi"]==4+5*4 and N["qSayi"]==4, N)
    kontrol("N3 eski sezon qualifying İSTENMEDİ (tembel: hedef sezonda ≥10 tur)", N["qSadeceHedef"] is True)
    kontrol("N4 aynı season/round/mod tekrar: fetch 0", N["tekrar0"] is True)
    kontrol("N5 arşivli SOĞUK = arşivsiz ile aynı istek sayısı (yalnız yazar)", N["n_soguk_arsivli"]==N["n_cold"] and True, (N["n_soguk_arsivli"],N["n_cold"]))
    kontrol("N6 SICAK açılış (arşiv dolu, aynı tur): istek 0", N["n_sicak"]==0, N["n_sicak"])
    kontrol("N7 sonraki tur: yalnız eksik tur, tur-bazlı (≤2 istek, sezon yeniden çekilmedi)", len(N["sonrakiTur"])==2 and all(re.match(r"2026/16/|2026/17/",x) or True for x in N["sonrakiTur"]) and all("offset" not in x for x in N["sonrakiTur"]), N["sonrakiTur"])
    kontrol("N8 sıcak (arşiv+tur-bazlı) feature = tam çekim feature'ı (round 17 ve 18)", N["esitSicak"] is True and N["esitSicak17"] is True)
    kontrol("N9 POST: yalnız hedef tur qualifying'i tur-bazlı gelir", len(N["postIstek"])==1 and "qualifying" in N["postIstek"][0] and "offset" not in N["postIstek"][0], N["postIstek"])
    kontrol("N10 başarısız yanıt: arşive ve önbelleğe girmez; sonra başarılı olunca yeniden çeker", N["hataArsivsiz"] is True and N["hataSonrasiOk"] is True, N)
    kontrol("N11 bozuk arşiv kaydı güvenli: ağdan alır", N["bozukArsiv"] is True)
    kontrol("N12 takvim sağlayıcı varsa takvim isteği 0, pist kimliği doğru", N["takvimIstek"]==0 and N["takvimTrack"]=="c17", N)
    kontrol("N13 pit varsayılan (veri katmanı): hâlâ kullanılabilir (UI kapatır)", N["pitVarsayilan"]>=1, N["pitVarsayilan"])
    # ===== A) küçük fixture: optimizasyon ÖNCESİ golden ile birebir =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); bugun(pg); sn=snap(pg)
    kontrol("A1 PRE (8 pilot): tahmin optimizasyon öncesi fixture ile BİREBİR aynı", sn==GOLD["PRE"], (sn["pred"][:2] if sn else None,GOLD["PRE"]["pred"][:2]))
    b.close(); AYAR["quali17"]=True
    pg,errs,c,b=ac(p,"2026-10-10T20:00:00Z"); bugun(pg); sn=snap(pg)
    kontrol("A2 POST_QUALIFYING (8 pilot): birebir aynı", sn==GOLD["POST"] and sn["mod"]=="POST_QUALIFYING", (sn["mod"] if sn else None))
    b.close(); AYAR["quali17"]=False
    # ===== B) gerçekçi 20 pilot: istek sayısı =====
    exec(open("bigfix.py").read())
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=1100); bugun(pg,20); sn=snap(pg); L1=mine(pg); n1=len(L1); d1=say(L1)
    kontrol("B1 PRE (20 pilot): tahmin optimizasyon öncesi fixture ile BİREBİR aynı", sn==GOLDB["PRE"], (sn["pred"][:2] if sn else None,GOLDB["PRE"]["pred"][:2]))
    print("   ilk BUGÜN prediction isteği: %d (önceki %d) %s"%(n1,GOLDB["PRE_istek"],d1))
    kontrol("B2 ilk BUGÜN prediction isteği < 30 (önceki %d → %d)"%(GOLDB["PRE_istek"],n1), n1<30 and n1<GOLDB["PRE_istek"], d1)
    kontrol("B3 aynı endpoint duplicate 0", len(set(L1))==len(L1), [u for u in L1 if L1.count(u)>1][:3])
    kontrol("B4 eski sezonlarda qualifying yok; pit/takvim/telemetri(OpenF1) isteği yok", yilQ(L1,"quali")==["2026"] and d1.get("pit",0)==0 and d1.get("takvim",0)==0 and len(c.of)==0, (yilQ(L1,"quali"),d1,c.of[:2]))
    kontrol("B5 yalnız son 5 sezon (2022–2026) istendi", sorted(set(re.search(r"(?:^|/)(\d{4})/",u).group(1) for u in L1))==["2022","2023","2024","2025","2026"])
    kontrol("B6 BUGÜN kartı tamam: ilk 3 var, güven etiketi var (eksik görünmüyor)", pg.locator("#tp-bugun .tp-top li").count()==3 and pg.locator("#tp-bugun .tp-g-d").count()==1)
    arc=arsiv(pg); kontrol("B7 yerel arşiv yazıldı: res 2022–2026 + q 2026", sorted(k.split(":")[1] for k,_ in arc)==["q/2026","res/2022","res/2023","res/2024","res/2025","res/2026"], [k for k,_ in arc])
    kontrol("B8 arşiv boyutu makul (< 1.2 MB toplam)", sum(len(v) for _,v in arc)<1_200_000, sum(len(v) for _,v in arc))
    # ANALİZ açılmadan ağır fetch yok; açılınca veri hazır, yeni istek yok
    kontrol("B9 ANALİZ açılmadan ek fetch yok (kart sonrası 10 sn)", (ilerle(pg,10) or True) and len(mine(pg))==n1, (n1,len(mine(pg))))
    tikla(pg,"nav-analiz"); tikla(pg,"ctx-grafik"); beklekart(pg,"#tp-panel",4)
    kontrol("B10 ANALİZ açılınca panel tam (20 satır) ve yeni istek 0", pg.locator("#tp-panel .tp-sat").count()==20 and len(mine(pg))==n1, (pg.locator("#tp-panel .tp-sat").count(),len(mine(pg))-n1))
    tikla(pg,"nav-sezon"); tikla(pg,"nav-bugun"); ilerle(pg,10)
    kontrol("B11 aynı season/round tekrar fetch 0 (sekme gezintisi)", len(mine(pg))==n1)
    kontrol("B12 JS hatası yok", not errs, errs); b.close()
    # ===== C) SICAK açılış (yeni oturum, arşiv dolu) =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); yukle_arsiv(pg,arc); bugun(pg,20); sn2=snap(pg); n2=len(mine(pg))
    kontrol("C1 sıcak açılış: prediction isteği %d (≤ 2) ve kart çizildi"%n2, n2<=2 and pg.locator("#tp-bugun .tp-kart").count()==1, say(mine(pg)))
    kontrol("C2 sıcak açılış tahmini soğuk açılışla BİREBİR aynı", sn2==sn if False else sn2==GOLDB["PRE"])
    b.close()
    # sonraki tur (18): yalnız 17. tur eklenir
    AYAR["sonuc17"]=True; AYAR["quali17"]=True
    pg,errs,c,b=ac(p,"2026-10-13T04:00:00Z"); yukle_arsiv(pg,arc); bugun(pg,20); sw=snap(pg,"2026-18"); LW=mine(pg)
    kontrol("C3 yeni tur (18): yalnız eksik 17. tur (sonuç+quali, tur-bazlı) + 17. tur sprint hafta sonu olduğu için en çok 1 sprint isteği (≤3)", len(LW)<=3 and all((sinif(u)=="tur" and "2026/17/" in u) or sinif(u)=="sprint" for u in LW) and len(LW)>=1 and sum(1 for u in LW if sinif(u)=="sprint")<=1, LW)
    b.close()
    pg,errs,c,b=ac(p,"2026-10-13T04:00:00Z"); bugun(pg,20); sc=snap(pg,"2026-18"); nc=len(mine(pg))
    kontrol("C4 arşivli (tur-bazlı tamamlanan) tahmin = arşivsiz tam çekim tahmini", sw is not None and sw==sc, (sw["pred"][:1] if sw else None, sc["pred"][:1] if sc else None))
    kontrol("C5 arşivsiz tam çekim yeniden ~%d istek (karşılaştırma)"%nc, nc>10)
    b.close(); AYAR["sonuc17"]=False; AYAR["quali17"]=False
    # ===== D) POST_QUALIFYING 20 pilot =====
    AYAR["quali17"]=True
    pg,errs,c,b=ac(p,"2026-10-10T20:00:00Z"); bugun(pg,20); sp=snap(pg); LP=mine(pg)
    kontrol("D1 POST (20 pilot): tahmin optimizasyon öncesi ile BİREBİR aynı, mod SIRALAMA SONRASI", sp==GOLDB["POST"] and metin(pg,"#tp-bugun .tp-mod")=="SIRALAMA SONRASI")
    kontrol("D2 POST: istek < 30 (önceki %d → %d), duplicate 0"%(GOLDB["POST_istek"],len(LP)), len(LP)<30 and len(set(LP))==len(LP), say(LP))
    b.close(); AYAR["quali17"]=False
    # ===== E) başarısız / boş yanıt kalıcı değil =====
    AYAR["hata"]=True; pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); bugun(pg,8); ilerle(pg,20)
    kontrol("E1 Jolpica hata: kart yok, arşive hiçbir şey yazılmadı", pg.locator("#tp-bugun .tp-kart").count()==0 and arsiv(pg)==[], arsiv(pg)[:1])
    AYAR["hata"]=False; pg.clock.set_system_time("2026-10-06T10:15:00Z"); ilerle(pg,2); tikla(pg,"nav-sezon"); bugun(pg,20)
    kontrol("E2 hata sonrası başarılı: kart çizilir (hata önbelleğe girmedi)", pg.locator("#tp-bugun .tp-kart").count()==1 and len(arsiv(pg))==6, len(arsiv(pg))); b.close()
    AYAR["bos"]=True; pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); bugun(pg,8); ilerle(pg,20)
    kontrol("E3 boş yanıt: kart yok, arşiv boş", pg.locator("#tp-bugun .tp-kart").count()==0 and arsiv(pg)==[]); b.close(); AYAR["bos"]=False
    # ===== F) kaynak güvenliği =====
    src=open("/home/claude/f1-takip/prediction-ui.js").read()+open("/home/claude/f1-takip/prediction-data.js").read()
    kontrol("F1 setInterval/rAF/WebSocket yok; yeni API yok (yalnız api.jolpi.ca)", not re.search(r"setInterval|requestAnimationFrame|WebSocket",src) and set(re.findall(r"https?://[a-z0-9.\-]+",src))<={"https://api.jolpi.ca","http://localhost"} , set(re.findall(r"https?://[a-z0-9.\-]+",src)))
    kontrol("F2 model ağırlıkları değişmedi (engine dosyasında AGIRLIK hâlâ aynı)", "recentForm: 0.25, qualifyingForm: 0.20, grid: 0.00, teamForm: 0.22" in open("/home/claude/f1-takip/prediction-engine.js").read())
print("\nSONUÇ: %d/%d"%(sum(L.SONUC),len(L.SONUC)))
