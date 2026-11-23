# yaris_hikaye_v1_test — YARIŞIN HİKÂYESİ v1 (3.1.0).
#  U) saf katman: testler/hikaye/hikaye_birim.js (GERÇEK fixture: 2025 Hollanda GP — OpenF1 session 9920 + F1DB sonuç/puan durumu;
#     sentetik eşik / birleştirme / kırmızı bayrak / şampiyonluk vakaları).
#  B) tarayıcı: aynı gerçek veri sahte ağ üzerinden uygulamaya verilir (Jolpica 2026/16 ↔ 2025/15 verisi; OpenF1 9920; zamanlar yarış saatine kaydırılır).
#     390 / 1100 px, koyu / açık, taşma 0, konsol hatası 0, tembel yükleme, duplicate istek yok, favori vurgusu, eksik veri durumu.
import sys, re, json, subprocess
sys.path.insert(0,'.')
exec(open('bugun_v3_test.py').read().split("\nwith sync_playwright")[0])
from datetime import datetime, timezone

U=json.loads(subprocess.run(["node","hikaye/hikaye_birim.js"],capture_output=True,text=True,cwd=".").stdout)
for s in U: kontrol("U "+s["ad"], s["ok"], s["ek"])

O=json.load(open("hikaye/openf1_9920_kompakt.json")); J=json.load(open("hikaye/jolpica_2025_15.json"))
T0=datetime.fromisoformat(O["t0"].replace("Z","+00:00")).timestamp()
def yaris_sonuc():
    r=json.loads(json.dumps(J["results"])); r["season"]="2026"; r["round"]="16"; return {"MRData":{"total":str(len(r["Results"])),"RaceTable":{"season":"2026","Races":[r]}}}
def std(n,kaynak):
    s=json.loads(json.dumps(J[kaynak])); s["round"]=str(n); s["season"]="2026"; return {"MRData":{"StandingsTable":{"season":"2026","StandingsLists":[s]}}}
def kurulum(pg, bos_openf1=False):
    yb=pg.evaluate("(()=>{const y=sezonYarislar.find(r=>r.round==='16');return Date.parse(y.date+'T'+(y.time||'12:00:00Z'))/1000})()")
    iso=lambda s: datetime.fromtimestamp(yb+s,timezone.utc).isoformat().replace("+00:00","Z")
    OFI=[]
    def of(r):
        u=r.request.url; OFI.append(u.split("/v1/")[1])
        q=u.split("/v1/")[1]
        if bos_openf1: return js(r,[])
        if q.startswith("meetings"): return js(r,[{"meeting_key":9999,"year":2026,"date_start":iso(-3*86400),"date_end":iso(3*3600),"is_cancelled":False,"meeting_name":"Test GP"}])
        if q.startswith("sessions"): return js(r,[{"session_key":9920,"meeting_key":9999,"session_name":"Race","session_type":"Race","date_start":iso(0),"date_end":iso(7200),"year":2026}])
        if q.startswith("race_control"): return js(r,[{"date":iso(x[0]),"lap_number":x[1],"category":x[2],"flag":x[3],"scope":x[4],"driver_number":x[5],"message":x[6],"session_key":9920,"meeting_key":9999} for x in O["rc"]])
        if q.startswith("pit"): return js(r,[{"date":iso(x[0]),"driver_number":x[1],"lap_number":x[2],"lane_duration":x[3],"stop_duration":x[4],"session_key":9920,"meeting_key":9999} for x in O["pit"]])
        if q.startswith("stints"): return js(r,[{"driver_number":x[0],"stint_number":x[1],"lap_start":x[2],"lap_end":x[3],"compound":x[4],"tyre_age_at_start":x[5],"session_key":9920,"meeting_key":9999} for x in O["st"]])
        if q.startswith("position"): return js(r,[{"date":iso(x[0]),"driver_number":x[1],"position":x[2],"session_key":9920,"meeting_key":9999} for x in O["pos"]])
        if q.startswith("laps") and "driver_number=81" in q: return js(r,[{"lap_number":x[0],"date_start":iso(x[1]),"driver_number":81,"session_key":9920} for x in O["tur_bas"]])
        return js(r,[])
    pg.route(re.compile(r"api\.openf1\.org/v1/"),of)
    pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2026/16/results"),lambda r: js(r,yaris_sonuc()))
    pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2026/16/qualifying"),lambda r: js(r,{"MRData":{"RaceTable":{"Races":[{"season":"2026","round":"16","QualifyingResults":[J["qualifying_p1"]]}]}}}))
    pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2026/16/driverstandings"),lambda r: js(r,std(16,"standings_15")))
    pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2026/15/driverstandings"),lambda r: js(r,std(15,"standings_14")))
    pg.evaluate("(()=>{for(const k of Object.keys(localStorage)) if(/pole/.test(k)) localStorage.removeItem(k)})()")
    return OFI
def konsol(pg,l): pg.on("console",lambda m: l.append(m.text) if m.type=="error" and "Failed to load resource" not in m.text else None)
def yaris16(pg):
    pg.evaluate("sekmeAc('yaris')"); ilerle(pg,6); pg.select_option("#yaris-sec","16"); ilerle(pg,6)
def olaylar(pg): return pg.evaluate("[...document.querySelectorAll('#yh-hikaye .yh-o')].map(e=>({tip:e.dataset.tip,tur:e.querySelector('.yh-tur').textContent,b:e.querySelector('.yh-b').textContent,fav:!!e.dataset.yhFav}))")
KES=r"(()=>{const o=[];document.querySelectorAll('#yh-hikaye *').forEach(e=>{if(e.checkVisibility()&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible')o.push(e.className)});return o})()"

with sync_playwright() as p:
    for w,tema in ((390,"koyu"),(390,"acik"),(1100,"koyu"),(1100,"acik")):
        T="[%d %s]"%(w,tema)
        pg,errs,c,b=yeni(p,NOW,w=w,tema=tema); kerr=[]; konsol(pg,kerr)
        OFI=kurulum(pg)
        if w==390: pg.evaluate("localStorage.setItem('f1-favori','hadjar')")
        ilerle(pg,4); n_once=len([u for u in OFI if u.startswith(("position","laps"))])
        yaris16(pg)
        kontrol("B1"+T+" bölüm yarış özetinin altında, Ghost Lap ve YARIŞ ANALİZİ'nin üstünde", pg.evaluate("(()=>{const h=document.getElementById('yh-hikaye'),g=document.getElementById('gl-ghost'),d=document.getElementById('yv-detay');const t=e=>e.getBoundingClientRect().top;return !!h&&!h.hidden&&(!g||t(h)<t(g))&&t(h)<t(d)})()"))
        kontrol("B2"+T+" tembel: Yarış Analizi açılmadan hikâye isteği (position/laps) yok; START/BİTİŞ Jolpica'dan hemen", n_once==0 and pg.locator("#yh-hikaye .yh-o[data-tip='START']").count()==1 and pg.locator("#yh-hikaye .yh-o[data-tip='FINISH']").count()==1, OFI)
        pg.evaluate("document.getElementById('yh-hikaye').scrollIntoView({block:'start'})"); ilerle(pg,25)
        ol=olaylar(pg); tipler=[o["tip"] for o in ol]
        kontrol("B3"+T+" görünür olunca yüklendi: 8–20 olay, ilk START, son BİTİŞ + ŞAMPİYONLUK", 8<=len(ol)<=20 and tipler[0]=="START" and tipler[-2:]==["FINISH","SAMPIYONLUK"], tipler)
        kontrol("B4"+T+" SC ×3, VSC ×1, pit, DNF ×3 kartları", tipler.count("SC")==3 and tipler.count("VSC")==1 and "PIT" in tipler and tipler.count("DNF")==3, tipler)
        trs=[int(re.match(r"TUR (\d+)",o["tur"]).group(1)) for o in ol]
        kontrol("B5"+T+" yukarıdan aşağı yarış sırası", trs==sorted(trs), trs)
        kontrol("B6"+T+" her uç nokta bir kez (duplicate istek yok)", all(sum(1 for u in OFI if u.startswith(e))<=1 for e in ("race_control","pit","stints","position","laps","sessions","meetings")) and any(u.startswith("position") for u in OFI), OFI)
        n1=len(OFI)
        for _ in range(4): pg.mouse.wheel(0,600); ilerle(pg,1)
        pg.select_option("#yaris-sec","15"); ilerle(pg,6); pg.select_option("#yaris-sec","16"); ilerle(pg,6)
        pg.evaluate("document.getElementById('yh-hikaye').scrollIntoView({block:'start'})"); ilerle(pg,6)
        kontrol("B7"+T+" kaydırma ve aynı yarışı yeniden açma yeni OpenF1 isteği üretmez", len(OFI)==n1 and len(olaylar(pg))==len(ol), (n1,len(OFI)))
        sc=pg.locator("#yh-hikaye .yh-o[data-tip='SC']").first
        kontrol("B8"+T+" SC kartı: tur aralığı + tek satır terim + Nedir? (İzlerken Öğren)", "TUR 23–26" in sc.inner_text() and "sollama yapılmaz" in sc.inner_text() and sc.locator("[data-terim='safety-car']").count()==1)
        sc_renk=sc.evaluate("e=>getComputedStyle(e).borderLeftColor"); fin=pg.locator("#yh-hikaye .yh-o[data-tip='FINISH']").evaluate("e=>getComputedStyle(e).borderLeftColor")
        kontrol("B9"+T+" renk: SC amber, BİTİŞ nötr (kırmızı değil)", re.match(r"rgb\((1[6-9]\d|2\d\d), (8\d|9\d|1[0-6]\d), ([0-5]?\d)\)",sc_renk) is not None and not re.match(r"rgb\(2[0-5]\d, [0-5]?\d, [0-5]?\d\)",fin), (sc_renk,fin))
        if w==390:
            fv=[o for o in ol if o["fav"]]
            kontrol("B10"+T+" favori (Hadjar) yalnız mevcut kartlarda nötr vurgu; kırmızı değil", fv and all(not re.match(r"rgb\(2[0-5]\d, [0-5]?\d, [0-5]?\d\)",x) for x in pg.evaluate("[...document.querySelectorAll('#yh-hikaye .yh-o[data-yh-fav]')].map(e=>getComputedStyle(e).boxShadow.split(')')[0]+')')")), [o["tur"]+o["tip"] for o in fv])
        kontrol("B11"+T+" kart içi kesilme yok, taşma 0", pg.evaluate(KES)==[] and tasma(pg)==0, (pg.evaluate(KES),tasma(pg)))
        if w==1100: kontrol("B12"+T+" masaüstünde okunur genişlik (≤ 720 px)", pg.evaluate("document.getElementById('yh-hikaye').getBoundingClientRect().width")<=722)
        txt=pg.inner_text("#yh-hikaye")
        kontrol("B13"+T+" ham hata / teknik metin / sebep yorumu yok", not re.search(r"undefined|NaN|null|Error|HTTP|undercut|strateji|sayesinde|nedeniyle",txt), re.findall(r"undefined|NaN|null|Error|HTTP|undercut|strateji|sayesinde|nedeniyle",txt))
        kontrol("B14"+T+" JS/konsol hatası yok", not errs and not kerr, (errs,kerr[:3])); b.close()

    # ===== eksik veri: OpenF1 boş → sınırlı bilgi + START/BİTİŞ/şampiyonluk; kırılma yok =====
    pg,errs,c,b=yeni(p,NOW,w=390,tema="koyu"); kerr=[]; konsol(pg,kerr)
    kurulum(pg,bos_openf1=True); yaris16(pg); pg.evaluate("document.getElementById('yh-hikaye').scrollIntoView({block:'start'})"); ilerle(pg,20)
    t=[o["tip"] for o in olaylar(pg)]
    kontrol("M1 OpenF1 verisi yok: 'Bu yarış için ayrıntılı olay verisi sınırlı.' + START/BİTİŞ/ŞAMPİYONLUK, ham hata yok", "Bu yarış için ayrıntılı olay verisi sınırlı." in pg.inner_text("#yh-hikaye") and t[0]=="START" and "FINISH" in t and "SAMPIYONLUK" in t and "SC" not in t and "PIT" not in t, t)
    kontrol("M2 taşma 0, hata yok", tasma(pg)==0 and not errs and not kerr, (errs,kerr[:3])); b.close()

print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
