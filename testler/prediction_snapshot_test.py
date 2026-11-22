# Prediction snapshot + evaluation v1: aşama kayıtları (PRE_WEEKEND / POST_QUALIFYING / RACE_START_FROZEN), tekrar yok, yarış sonrası değerlendirme.
import sys, json, subprocess, os
sys.path.insert(0,'.')
exec(open('prediction_ui_v1_test.py').read().split("\nwith sync_playwright")[0])
import datetime as _d
def sonra(iso,dk): return (_d.datetime.fromisoformat(iso.replace("Z","+00:00"))+_d.timedelta(minutes=dk)).strftime("%Y-%m-%dT%H:%M:%SZ")
ARS="(()=>{try{return JSON.parse(localStorage.getItem('f1-tahmin-arsiv-v1')||'{}')}catch(e){return {}}})()"
def bpred(st): return [[x["driver"],x["winProbability"],x["podiumProbability"],x["pointsProbability"]] for x in st["pred"]["suruculer"]]
with sync_playwright() as p:
    pg,errs,c,b=ac(p,"2026-10-10T07:00:00Z"); bugun(pg)
    st=S(pg); a=pg.evaluate(ARS); k=a.get("2026-17")
    kontrol("P1 PRE_WEEKEND snapshot yazıldı (sezon+tur anahtarı), motor değerleri AYNEN", bool(k) and list(k["asamalar"].keys())==["PRE_WEEKEND"] and k["asamalar"]["PRE_WEEKEND"]["suruculer"]==bpred(st) and k["season"]==2026 and k["round"]==17, k and list(k["asamalar"].keys()))
    qbit=pg.evaluate("(()=>{const m=BugunV3.modBelirle(Date.now());const q=m.h.seanslar.filter(s=>s.anahtar==='Qualifying')[0];return q.bitis.toISOString()})()")
    rbas=pg.evaluate("(()=>{const m=BugunV3.modBelirle(Date.now());return m.race.baslangic.toISOString()})()")
    kontrol("P2 kayıtta yarış başlangıcı tutuluyor", k and k["raceBas"]==pg.evaluate("Date.parse('%s')"%rbas))
    pre_ts=k["asamalar"]["PRE_WEEKEND"]["ts"]
    # aynı oturumda yeniden hesaplama/yeniden yükleme: tekrar yok, ilk kayıt korunur
    tekrar=pg.evaluate("(()=>{const s=TahminUI._durum.sonuc['2026-17'];const t=TahminUI.hedefBul(Date.now(),true);return TahminArsiv.kaydet(t,s.mod,s.pred,Date.now())})()")
    a=pg.evaluate(ARS)
    kontrol("P3 aynı aşama yeniden kaydedilmek istenince reddedilir (ilk kayıt korunur)", tekrar is False and list(a["2026-17"]["asamalar"].keys())==["PRE_WEEKEND"] and a["2026-17"]["asamalar"]["PRE_WEEKEND"]["ts"]==pre_ts)
    AYAR["quali17"]=True; pg.clock.set_system_time(sonra(qbit,25)); ilerle(pg,1); tikla(pg,"nav-sezon"); tikla(pg,"nav-bugun")
    for _ in range(10):
        ilerle(pg,6)
        if metin(pg,"#tp-bugun .tp-mod")=="SIRALAMA SONRASI": break
    st2=S(pg); a=pg.evaluate(ARS); k=a["2026-17"]
    kontrol("P4 POST_QUALIFYING snapshot eklendi; PRE değişmedi", sorted(k["asamalar"].keys())==["POST_QUALIFYING","PRE_WEEKEND"] and k["asamalar"]["POST_QUALIFYING"]["suruculer"]==bpred(st2) and k["asamalar"]["PRE_WEEKEND"]["ts"]==pre_ts)
    kontrol("P5 PRE ve POST farklı (grid etkisi saklandı)", k["asamalar"]["POST_QUALIFYING"]["suruculer"]!=k["asamalar"]["PRE_WEEKEND"]["suruculer"])
    AYAR["sonuc17"]=True; pg.clock.set_system_time(sonra(rbas,20)); ilerle(pg,1); tikla(pg,"nav-sezon"); tikla(pg,"nav-bugun"); ilerle(pg,20)
    a=pg.evaluate(ARS); k=a["2026-17"]; fz=k["asamalar"].get("RACE_START_FROZEN")
    kontrol("P6 yarış başladı → RACE_START_FROZEN = son yarış-öncesi tahmin (POST)", bool(fz) and fz["kaynakAsama"]=="POST_QUALIFYING" and fz["suruculer"]==k["asamalar"]["POST_QUALIFYING"]["suruculer"] and fz["ts"]<k["raceBas"], fz and fz.get("kaynakAsama"))
    pg.reload(); tikla(pg,"nav-bugun"); ilerle(pg,20); a2=pg.evaluate(ARS)
    kontrol("P7 yarış sonrası yeniden açılış: aşamalar değişmedi, tekrar yok", a2==a)
    # değerlendirme (fixture yarış sonucu ile)
    sonuc=pg.evaluate("fetch('https://api.jolpi.ca/ergast/f1/2026/17/results/?limit=100').then(r=>r.json()).then(j=>j.MRData.RaceTable.Races[0].Results)")
    d=pg.evaluate("r=>TahminArsiv.degerlendir(JSON.parse(localStorage.getItem('f1-tahmin-arsiv-v1'))['2026-17'], r)", sonuc)
    kaz=[x["Driver"]["driverId"] for x in sonuc if x["position"]=="1"][0]
    pm=d["asamalar"]["POST_QUALIFYING"]; kz=[s for s in k["asamalar"]["POST_QUALIFYING"]["suruculer"] if s[0]==kaz]
    kontrol("P8 değerlendirme: 3 aşama ölçüldü, kazananın olasılığı kayıttaki değer", d["sonucVar"] and all(d["asamalar"][x] for x in ("PRE_WEEKEND","POST_QUALIFYING","RACE_START_FROZEN")) and kz and abs(pm["kazananOlasiligi"]-kz[0][1])<1e-12, (kaz, pm))
    kontrol("P9 ölçü aralıkları: podyum 0–3, kapsama 0–1, Brier ≥ 0", all(0<=d["asamalar"][x]["podyumIsabet"]<=3 and 0<=d["asamalar"][x]["puanKapsama"]<=1 and d["asamalar"][x]["brierWin"]>=0 for x in d["asamalar"]))
    kontrol("P10 FROZEN ölçümü POST ile aynı (aynı tahmin)", d["asamalar"]["RACE_START_FROZEN"]==d["asamalar"]["POST_QUALIFYING"])
    kontrol("P11 arayüzde yeni öğe yok (geliştirici tarafı)", pg.locator("text=RACE_START_FROZEN").count()==0 and pg.locator("[class*=arsiv]").count()==0)
    kontrol("P12 JS hatası yok", not errs, errs); b.close()
    # yarış başladıktan SONRA ilk kez açılırsa: yarış-öncesi snapshot uydurulmaz
    pg,errs,c,b=ac(p,"2026-10-11T13:30:00Z"); tikla(pg,"nav-bugun"); ilerle(pg,30)
    a=pg.evaluate(ARS)
    kontrol("P13 ilk açılış yarış sırasında: hiçbir aşama kaydedilmez (sonradan hesaplanan 'yarış öncesi' sayılmaz)", "2026-17" not in a or not a["2026-17"]["asamalar"], a.get("2026-17"))
    kontrol("P14 hata yok", not errs, errs); b.close()
# saf hesap (node): metrik tanımları elle
JS=r"""
const A=require('/home/claude/f1-takip/prediction-snapshot.js'); global.localStorage=undefined;
const t={season:2026,round:5,ad:'X',raceBas:1000};
const pred={model:'m',mode:'PRE_WEEKEND',suruculer:[{driver:'a',winProbability:.5,podiumProbability:.8,pointsProbability:.95},{driver:'b',winProbability:.3,podiumProbability:.7,pointsProbability:.9},{driver:'c',winProbability:.2,podiumProbability:.5,pointsProbability:.8},{driver:'d',winProbability:0,podiumProbability:null,pointsProbability:.1}]};
const o={};
o.k1=A.kaydet(t,'PRE_WEEKEND',pred,500); o.k2=A.kaydet(t,'PRE_WEEKEND',pred,600); o.k3=A.kaydet(t,'POST_QUALIFYING',pred,1200); o.k4=A.kaydet(t,'RACE_START_FROZEN',pred,500);
o.f0=A.dondur(t,900); o.f1=A.dondur(t,1500); o.f2=A.dondur(t,1600);
const k=A.liste()['2026-5']; o.asama=Object.keys(k.asamalar); o.fzKaynak=k.asamalar.RACE_START_FROZEN.kaynakAsama;
const R=[{position:'1',Driver:{driverId:'b'}},{position:'2',Driver:{driverId:'a'}},{position:'3',Driver:{driverId:'x'}},{position:'4',Driver:{driverId:'c'}}];
const d=A.degerlendir(k,R).asamalar.PRE_WEEKEND; o.d=d;
o.bosSonuc=A.degerlendir(k,[]).sonucVar; o.yokKazanan=A.degerlendir(k,[{position:'1',Driver:{driverId:'zz'}}]).asamalar.PRE_WEEKEND;
for(let i=1;i<=70;i++) A.kaydet({season:2025,round:i,raceBas:1e9},'PRE_WEEKEND',pred,1); o.adet=Object.keys(A.liste()).length; o.eskiSilindi=!A.liste()['2025-1'] && !!A.liste()['2026-5'];
console.log(JSON.stringify(o));
"""
o=json.loads(subprocess.run(["node","-e",JS],capture_output=True,text=True).stdout)
kontrol("N1 kaydet: ilk kayıt yazılır, aynı aşama ikinci kez yazılmaz, yarış başladıktan sonra hesaplanan reddedilir, FROZEN doğrudan yazılamaz", o["k1"] and not o["k2"] and not o["k3"] and not o["k4"], o)
kontrol("N2 dondur: başlamadan önce yok; başlayınca bir kez (PRE'den)", not o["f0"] and o["f1"] and not o["f2"] and o["asama"]==["PRE_WEEKEND","RACE_START_FROZEN"] and o["fzKaynak"]=="PRE_WEEKEND", o)
d=o["d"]
kontrol("N3 top-1 yanlış (model a, kazanan b); kazanan olasılığı 0.3, sırası 2", d["top1"]==False and d["kazananOlasiligi"]==0.3 and d["kazananSirasi"]==2, d)
kontrol("N4 podyum isabet: model ilk3 (a,b,c) ∩ gerçek (b,a,x) = 2", d["podyumIsabet"]==2, d)
kontrol("N5 Brier(win) elle: ((.5-0)²+(.3-1)²+(.2)²+0²)/4", abs(d["brierWin"]-((.25+.49+.04+0)/4))<1e-12, d["brierWin"])
kontrol("N6 Brier(podium) yalnız sayısal olanlar (d=null hariç): ((.8-1)²+(.7-1)²+(.5)²)/3", abs(d["brierPodium"]-((.04+.09+.25)/3))<1e-12, d["brierPodium"])
kontrol("N7 log-loss = -ln(0.3); puan kapsama = 4 sınıflandırılmış pilottan model ilk4 ∩ gerçek ilk4 = 3/4", abs(d["logLossWin"]+__import__('math').log(.3))<1e-12 and abs(d["puanKapsama"]-0.75)<1e-12, d)
kontrol("N8 sonuç yoksa ölçüm yok (null); kazanan listede yoksa olasılık null", o["bosSonuc"]==False and o["yokKazanan"]["kazananOlasiligi"] is None and o["yokKazanan"]["top1"]==False, o["yokKazanan"])
kontrol("N9 en çok 60 yarış tutulur, en eskiler silinir", o["adet"]==60 and o["eskiSilindi"], o["adet"])
print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
