# prediction_ui_v1_test — BUGÜN kartı + ANALİZ paneli. Jolpica 5 sezon sentetik taklit; ağ yok.
import sys, re, json, hashlib
sys.path.insert(0,'.')
exec(open('nav_v3_test.py').read().split("with sync_playwright")[0])
OUT="/tmp/f1-ekran/"
ORD=[("norris","NOR","Norris","McLaren","mclaren"),("antonelli","ANT","Antonelli","Mercedes","mercedes"),("verstappen","VER","Verstappen","Red Bull","red_bull"),
     ("russell","RUS","Russell","Mercedes","mercedes"),("piastri","PIA","Piastri","McLaren","mclaren"),("leclerc","LEC","Leclerc","Ferrari","ferrari"),
     ("hamilton","HAM","Hamilton","Ferrari","ferrari"),("hadjar","HAD","Hadjar","Red Bull","red_bull")]
PTS=[25,18,15,12,10,8,6,4]
AYAR={"quali17":False,"sonuc17":False,"bos":False,"hata":False,"log":[]}
def jit(y,r,d,salt): return (int(hashlib.md5(f"{y}{r}{d}{salt}".encode()).hexdigest()[:6],16)%1000)/1000
def siralama(y,r,salt):
    sc=sorted([(i*0.9+jit(y,r,o[0],salt)*2.2,o) for i,o in enumerate(ORD)],key=lambda x:x[0]); return [o for _,o in sc]
SPR_TURLAR=[2,4,5,9,12,17]    # uygulamanın test takvimindeki sprint hafta sonları (17. tur sprint hafta sonu)
def hadPole(y,r): return y==2026 and r==17
def qsira(y,r):
    s=siralama(y,r,"q")
    if hadPole(y,r): s=[o for o in s if o[0]=="hadjar"]+[o for o in s if o[0]!="hadjar"]
    return s
def yarisSayisi(y): return (16+(1 if AYAR["sonuc17"] else 0)) if y==2026 else 22
def qSayisi(y): return (16+(1 if AYAR["quali17"] else 0)) if y==2026 else 22
def drvj(o): return {"driverId":o[0],"code":o[1],"givenName":"X","familyName":o[2]}
def meta(y,r): return {"season":str(y),"round":str(r),"raceName":"GP %d"%r,"date":"%d-0%d-01"%(y,min(r,9)),"Circuit":{"circuitId":"circ%d"%r}}
def sonuclar(y,r):
    q=[o[0] for o in qsira(y,r)]; rows=[]
    for i,o in enumerate(siralama(y,r,"r")):
        dnf=(int(hashlib.md5(f"{y}{r}{o[0]}d".encode()).hexdigest()[:4],16)%13==0)
        rows.append({"position":str(i+1),"positionText":"R" if dnf else str(i+1),"points":"0" if dnf else str(PTS[i]),"grid":str(q.index(o[0])+1),"status":"Engine" if dnf else "Finished",
                     "Driver":drvj(o),"Constructor":{"constructorId":o[4],"name":o[3]}})
    return rows
def qual(y,r): return [{"position":str(i+1),"Driver":drvj(o),"Constructor":{"constructorId":o[4],"name":o[3]}} for i,o in enumerate(qsira(y,r))]
def sayfa(y,tur,off):
    n=yarisSayisi(y) if tur=="results" else qSayisi(y); anah="Results" if tur=="results" else "QualifyingResults"; flat=[]
    for r in range(1,n+1):
        for x in (sonuclar(y,r) if tur=="results" else qual(y,r)): flat.append((r,x))
    part=flat[off:off+100]; by={}
    for r,x in part:
        by.setdefault(r,dict(meta(y,r),**{anah:[]}))[anah].append(x)
    return {"MRData":{"total":str(len(flat)),"RaceTable":{"Races":list(by.values())}}}
def jol(r,o,st=200): r.fulfill(status=st,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps(o))
def rota(r):
    u=r.request.url; m=re.search(r"ergast/f1/(\d{4})/(results|qualifying)/\?limit=100&offset=(\d+)",u)
    if m:
        AYAR["log"].append(u)
        if AYAR["hata"]: return jol(r,{"x":1},500)
        if AYAR["bos"]: return jol(r,{"MRData":{"total":"0","RaceTable":{"Races":[]}}})
        return jol(r,sayfa(int(m.group(1)),m.group(2),int(m.group(3))))
    m=re.search(r"ergast/f1/(\d{4})/(\d+)/(results|qualifying)/\?limit=100",u)      # tur bazlı (arşivden tamamlama)
    if m:
        AYAR["log"].append(u); y,rr,tur=int(m.group(1)),int(m.group(2)),m.group(3)
        if AYAR["hata"]: return jol(r,{"x":1},500)
        if AYAR["bos"] or rr>(yarisSayisi(y) if tur=="results" else qSayisi(y)): return jol(r,{"MRData":{"total":"0","RaceTable":{"Races":[]}}})
        anah="Results" if tur=="results" else "QualifyingResults"; rows=sonuclar(y,rr) if tur=="results" else qual(y,rr)
        return jol(r,{"MRData":{"total":str(len(rows)),"RaceTable":{"Races":[dict(meta(y,rr),**{anah:rows})]}}})
    m=re.search(r"ergast/f1/(\d{4})/sprint/\?limit=100&offset=(\d+)",u)      # sprint sonuçları (şampiyonluk motoru): TAKVİM'deki tamamlanmış sprint turları, resmi 8-7-6-5-4-3-2-1
    if m:
        AYAR["log"].append(u); y=int(m.group(1))
        if AYAR["hata"]: return jol(r,{"x":1},500)
        rl=[n for n in SPR_TURLAR if n<=yarisSayisi(y)] if y==2026 and not AYAR["bos"] else []
        if not rl: return jol(r,{"MRData":{"total":"0","RaceTable":{"Races":[]}}})
        rows=[]
        for rr in rl:
            for i,o in enumerate(siralama(y,rr,"s")):
                rows.append((rr,{"position":str(i+1),"positionText":str(i+1),"points":str(8-i),"grid":str(i+1),"status":"Finished","Driver":drvj(o),"Constructor":{"constructorId":o[4],"name":o[3]}}))
        part=rows[int(m.group(2)):int(m.group(2))+100]; by={}
        for rr,x in part: by.setdefault(rr,dict(meta(y,rr),**{"SprintResults":[]}))["SprintResults"].append(x)
        return jol(r,{"MRData":{"total":str(len(rows)),"RaceTable":{"Races":list(by.values())}}})
    if re.search(r"ergast/f1/\d{4}/(races|\d+/pitstops)/",u): return jol(r,{"MRData":{"total":"0","RaceTable":{"Races":[]}}})
    return r.fallback()
def std():
    out=[]
    for i,o in enumerate(ORD): out.append({"position":str(i+1),"points":str(300-i*30),"wins":"0","Driver":dict(drvj(o),permanentNumber="1",dateOfBirth="2000-01-01",nationality="X"),"Constructors":[{"name":o[3]}]})
    return out
def ac(p,saat,w=1100,tema="koyu",kur=True):
    for k in ("log",): AYAR[k]=[]
    pg,errs,c,b=yeni(p,saat,w=w,tema=tema); pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/"),rota); ilerle(pg,5); flag(pg)
    pg.evaluate("(l)=>{sezonPilotlar=l}",std()); return pg,errs,c,b
def bugun(pg,bek=14):
    tikla(pg,"nav-bugun"); beklekart(pg,"#tp-bugun .tp-kart",bek)
def beklekart(pg,sel,maks=14):
    for _ in range(maks):
        if pg.locator(sel).count(): return True
        ilerle(pg,6)
    return pg.locator(sel).count()>0
def S(pg,anah="2026-17"): return pg.evaluate("(k)=>{const s=TahminUI._durum.sonuc[k];return s?{mod:s.mod,pred:s.pred,champ:s.champ}:null}",anah)
def yuz(p): return ("<1%" if 0<p<0.005 else "%d%%"%round(p*100+1e-9))
def metin(pg,sel): return pg.evaluate("(s)=>{const e=document.querySelector(s);return e?e.textContent:''}",sel)
HAM_RE=re.compile(r"undefined|NaN|\[object|Cannot read|\bnull\b")
YASAK=re.compile(r"kesin|garanti(?!si)|kazanacak|şampiyon olacak|favori kesin",re.I)
with sync_playwright() as p:
    # ===== A) B modu (PRE): BUGÜN kartı =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); bugun(pg)
    st=S(pg)
    kontrol("A1 BUGÜN: tahmin kartı çizildi (veri var)", pg.locator("#tp-bugun .tp-kart").count()==1 and st is not None)
    kontrol("A2 BUGÜN: yalnız ilk 3 pilot", pg.locator("#tp-bugun .tp-top li").count()==3, pg.locator("#tp-bugun .tp-top li").count())
    ilk=[x["driver"] for x in st["pred"]["suruculer"][:3]]
    kontrol("A3 sıra winProbability'ye göre (kart = motor ilk 3, azalan)", pg.evaluate("[...document.querySelectorAll('#tp-bugun .tp-top li')].map(l=>l.dataset.driver)")==ilk and st["pred"]["suruculer"][0]["winProbability"]>=st["pred"]["suruculer"][1]["winProbability"]>=st["pred"]["suruculer"][2]["winProbability"], ilk)
    yy=pg.evaluate("[...document.querySelectorAll('#tp-bugun .tp-top .tp-y')].map(e=>e.textContent)")
    kontrol("A4 kart yüzdeleri motor değerleriyle birebir", yy==[yuz(x["winProbability"]) for x in st["pred"]["suruculer"][:3]], (yy))
    kontrol("A5 PRE_WEEKEND etiketi: HAFTA SONU ÖNCESİ", st["mod"]=="PRE_WEEKEND" and metin(pg,"#tp-bugun .tp-mod")=="HAFTA SONU ÖNCESİ" and pg.evaluate("document.querySelector('#tp-bugun .tp-kart').dataset.mod")=="PRE_WEEKEND", metin(pg,"#tp-bugun .tp-mod"))
    kontrol("A6 yarış başlamadı: 'SABİT' etiketi yok", pg.locator("#tp-bugun .tp-sabit").count()==0)
    g=pg.evaluate("document.querySelector('#tp-bugun .tp-g-d').textContent"); sev=pg.evaluate("document.querySelector('#tp-bugun .tp-guven').dataset.guven")
    kontrol("A7 güven v3: motor UNRELIABLE → seviye (YÜKSEK/ORTA/DÜŞÜK) gösterilmez, yerine açıklama", sev=="UNRELIABLE" and g=="Güven seviyesi için yeterli geçmiş veri yok" and st["pred"]["genelGuven"]["seviye"]=="UNRELIABLE" and not re.search(r"YÜKSEK|ORTA|DÜŞÜK",metin(pg,"#tp-bugun .tp-guven")), (g,sev))
    kontrol("A8 UNRELIABLE: 'Güven:' etiketi ve yüzde yok, yalnız açıklama", "Güven:" not in metin(pg,"#tp-bugun .tp-guven") and "%" not in metin(pg,"#tp-bugun .tp-guven"))
    pg.evaluate("()=>{TahminUI._durum.sonuc['2026-17'].pred.genelGuven.seviye='HIGH';TahminUI._durum.sonuc['2026-17'].pred.suruculer.forEach(s=>s.confidenceSeviye='HIGH');TahminUI._durum.html.bugun=null;TahminUI._durum.html.analiz=null;TahminUI.ciz();}")
    kontrol("A8b motor HIGH verirse (eşik geçerliyse) YÜKSEK etiketi gösterilir", metin(pg,"#tp-bugun .tp-g-d")=="YÜKSEK" and "Güven:" in metin(pg,"#tp-bugun .tp-guven"), metin(pg,"#tp-bugun .tp-guven"))
    pg.evaluate("()=>{TahminUI._durum.sonuc['2026-17'].pred.genelGuven.seviye='UNRELIABLE';TahminUI._durum.sonuc['2026-17'].pred.suruculer.forEach(s=>s.confidenceSeviye='UNRELIABLE');TahminUI._durum.html.bugun=null;TahminUI._durum.html.analiz=null;TahminUI.ciz();}")
    kontrol("A9 disclaimer BUGÜN kartında", "Tahminler mevcut verilere dayalı olasılıklardır; sonuç garantisi değildir." in metin(pg,"#tp-bugun"))
    kontrol("A10 CTA: DETAYLI TAHMİN", "DETAYLI TAHMİN" in metin(pg,"#tp-bugun .tp-btn"))
    kontrol("A11 mevcut BUGÜN hero/CTA bozulmadı (bg-hero + bg-cta var)", pg.locator("#bg-kok .bg-hero").count()==1 and pg.locator("#bg-kok .bg-cta").count()==1)
    t=metin(pg,"#sekme-bugun"); kontrol("A12 BUGÜN metninde ham anahtar/undefined/NaN yok, kesinlik dili yok", not HAM_RE.search(t) and not YASAK.search(t), (HAM_RE.findall(t),YASAK.findall(t)))
    kontrol("A13 1100: yatay taşma 0 (BUGÜN)", tasma(pg)==0, tasma(pg)); pg.screenshot(path=OUT+"tahmin-bugun-1100.png")
    n_once=len(AYAR["log"]); tikla(pg,"nav-sezon"); tikla(pg,"nav-bugun"); ilerle(pg,12)
    kontrol("A14 aynı sezon/tur/mod tekrar açılınca duplicate fetch 0", len(AYAR["log"])==n_once, (n_once,len(AYAR["log"])))
    istek=[u for u in AYAR["log"]]; yillar=sorted(set(re.search(r"f1/(\d{4})/",u).group(1) for u in istek))
    kontrol("A15 yalnız son 5 sezon istendi (2022–2026)", yillar==["2022","2023","2024","2025","2026"], yillar)
    kontrol("A16 BUGÜN: OpenF1 isteği yok (telemetri/yeni kaynak yok)", len(c.of)==0, c.of[:3])
    # CTA → ANALİZ
    pg.click("#tp-bugun .tp-btn"); ilerle(pg,4)
    kontrol("A17 CTA → GRAFİK sekmesi, ANALİZ vurgusu, panel görünür", sekme(pg)==["sekme-grafik"] and aktif(pg)==["nav-analiz"] and vis(pg,"#tp-panel"), (sekme(pg),aktif(pg)))
    # ===== B) ANALİZ paneli =====
    n=len(st["pred"]["suruculer"])
    kontrol("B1 panel: tüm pilotlar listelendi (%d satır)"%n, pg.locator("#tp-panel .tp-sat").count()==n==8, pg.locator("#tp-panel .tp-sat").count())
    kontrol("B2 kolonlar: Pilot / Kazanma % / Podyum % / Puan %", pg.evaluate("[...document.querySelectorAll('#tp-panel thead th')].map(t=>t.textContent)")==["Pilot","Kazanma %","Podyum %","Puan %"])
    rows=pg.evaluate("[...document.querySelectorAll('#tp-panel .tp-sat')].map(r=>({d:r.dataset.driver,k:r.querySelector('.kod').textContent,y:[...r.querySelectorAll('.tp-y')].map(e=>e.textContent)}))")
    sr=st["pred"]["suruculer"]
    kontrol("B3 sıralama winProbability yüksekten düşüğe (DOM = motor sırası)", [x["d"] for x in rows]==[x["driver"] for x in sr] and all(sr[i]["winProbability"]>=sr[i+1]["winProbability"] for i in range(len(sr)-1)))
    kontrol("B4 win/podium/points yüzdeleri motorla birebir", all(r["y"]==[yuz(s["winProbability"]),yuz(s["podiumProbability"]),yuz(s["pointsProbability"])] for r,s in zip(rows,sr)), rows[:2])
    kodlar={o[0]:o[1] for o in ORD}
    kontrol("B5 yanlış pilot karışmıyor (satır kodu = driverId'nin kodu)", all(kodlar[r["d"]]==r["k"] for r in rows), rows)
    kontrol("B6 mod etiketi + tur başlığı panelde", metin(pg,"#tp-panel .tp-mod")=="HAFTA SONU ÖNCESİ" and ("TUR 17 / %d"%pg.evaluate("BugunKaynak().yarislar.length")) in metin(pg,"#tp-panel .tp-meta"), metin(pg,"#tp-panel .tp-meta"))
    kontrol("B7 nedenler başlangıçta kapalı", pg.locator("#tp-panel .tp-neden:not([hidden])").count()==0)
    d0=sr[0]["driver"]; pg.click("#tp-panel .tp-sat[data-driver='%s'] .tp-ac"%d0); ilerle(pg,2)
    ac_=pg.evaluate("(d)=>{const r=document.getElementById('tp-n-'+d);return {h:r.hidden,li:[...r.querySelectorAll('.tp-nd li')].map(l=>l.textContent.replace(/^[+−]/,'')),exp:document.querySelector('[data-tp-ac=\"'+d+'\"]').getAttribute('aria-expanded')}}",d0)
    kontrol("B8 satır tıklanınca nedenler açılır (aria-expanded)", ac_["h"] is False and ac_["exp"]=="true")
    kontrol("B9 reasons max 5 ve motorun reasons[] metniyle aynen aynı", len(ac_["li"])<=5 and ac_["li"]==[x["metin"] for x in sr[0]["reasons"]], (ac_["li"],sr[0]["reasons"]))
    ilerle(pg,12)   # sonraki çizimler açık satırı kapatmaz, odak korunur
    kontrol("B10 yeniden çizimde açık satır korunur", pg.evaluate("(d)=>!document.getElementById('tp-n-'+d).hidden",d0))
    allr=pg.evaluate("[...document.querySelectorAll('#tp-panel .tp-neden')].map(r=>r.querySelectorAll('.tp-nd li').length)")
    kontrol("B11 hiçbir pilotta 5'ten fazla neden yok", max(allr)<=5, allr)
    kontrol("B12 pilot satırında seviye yok; UNRELIABLE açıklaması", all(("Güven seviyesi için yeterli geçmiş veri yok" in x and not re.search(r"Güven: (YÜKSEK|ORTA|DÜŞÜK)",x)) for x in pg.evaluate("[...document.querySelectorAll('#tp-panel .tp-neden')].map(r=>r.textContent)")))
    kontrol("B13 panel disclaimer + güven açıklaması", "Tahminler mevcut verilere dayalı olasılıklardır; sonuç garantisi değildir." in metin(pg,"#tp-panel"))
    kontrol("B14 şampiyonluk: gerçek sprint verisi bağlı (sprintDataComplete=true, kalan sprint takvimden=1)", st["champ"]["meta"]["sprintDataComplete"] is True and st["champ"]["meta"]["kalanSprint"]==1 and st["champ"]["meta"]["elemeYapildi"] is True, st["champ"]["meta"])
    ch=st["champ"]["suruculer"]; top5=[x for x in ch if x["championshipProbability"]>0][:5]
    cl=pg.evaluate("[...document.querySelectorAll('#tp-ch .tp-top li')].map(l=>({d:l.dataset.driver,y:l.querySelector('.tp-y').textContent}))")
    kontrol("B14 ŞAMPİYONLUK TAHMİNİ: ilk 5, motorla aynı sıra/yüzde", "ŞAMPİYONLUK TAHMİNİ" in metin(pg,"#tp-ch") and len(cl)==min(5,len(top5)) and [x["d"] for x in cl]==[x["driver"] for x in top5] and [x["y"] for x in cl]==[yuz(x["championshipProbability"]) for x in top5], (cl,top5[:2]))
    kontrol("B15 şampiyonlukta kesinlik dili yok", not YASAK.search(metin(pg,"#tp-ch")), metin(pg,"#tp-ch"))
    t=metin(pg,"#sekme-grafik"); kontrol("B16 panel metninde ham anahtar/undefined/NaN yok, kesinlik dili yok", not HAM_RE.search(metin(pg,"#tp-analiz")) and not YASAK.search(metin(pg,"#tp-analiz")), (HAM_RE.findall(metin(pg,"#tp-analiz")),YASAK.findall(metin(pg,"#tp-analiz"))))
    kontrol("B17 1100: yatay taşma 0 (ANALİZ)", tasma(pg)==0, tasma(pg)); pg.screenshot(path=OUT+"tahmin-analiz-1100.png")
    kontrol("B18 mevcut ANALİZ içeriği (a3-merkez) hâlâ DOM'da", pg.locator("#a3-merkez").count()==1)
    kontrol("B19 JS hatası yok", not errs, errs); b.close()
    # ===== C) favori vurgusu =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); pg.evaluate("localStorage.setItem('f1-favori','norris')"); bugun(pg); ilerle(pg,3)
    st=S(pg); topdrv=[x["driver"] for x in st["pred"]["suruculer"][:3]]
    tikla(pg,"nav-analiz"); tikla(pg,"ctx-grafik"); beklekart(pg,"#tp-panel",4); ilerle(pg,3)
    fav=pg.evaluate("(()=>{const r=document.querySelector('#tp-panel .tp-sat[data-driver=\"norris\"]');const o=document.querySelector('#tp-panel .tp-sat[data-driver=\"hadjar\"]');return {f:r.classList.contains('favori')||r.hasAttribute('data-fav'),o:o.classList.contains('favori')||o.hasAttribute('data-fav'),bg:getComputedStyle(r.querySelector('td')).backgroundColor,bg2:getComputedStyle(o.querySelector('td')).backgroundColor,sec:getComputedStyle(r.querySelector('.pilot'),'::after').content}})()")
    kontrol("C1 favori pilot satırı mevcut sistemle vurgulu, diğeri değil", fav["f"] and not fav["o"] and fav["bg"]!=fav["bg2"], fav)
    kontrol("C2 favori ★ mevcut işaretle (kırmızı state ile karışmıyor: arka plan nötr)", "★" in fav["sec"] and "225, 6, 0" not in fav["bg"] and "212, 22, 28" not in fav["bg"], fav)
    if "norris" in topdrv:
        tikla(pg,"nav-bugun"); ilerle(pg,2)
        kontrol("C3 BUGÜN ilk 3'te favori satırı vurgulu", pg.evaluate("!!document.querySelector('#tp-bugun .tp-top li[data-driver=\"norris\"][data-fav]')"))
    else: kontrol("C3 (favori ilk 3 dışında; vurgu satırı yok, kart bozulmadı)", pg.locator("#tp-bugun .tp-top li[data-fav]").count()==0)
    pg.evaluate("localStorage.removeItem('f1-favori'); FavoriV1.isaretle()"); ilerle(pg,2)
    kontrol("C4 favori kaldırılınca panelde vurgu kalmaz", pg.evaluate("document.querySelectorAll('#tp-panel tr.favori, #tp-bugun li[data-fav]').length")==0)
    b.close()
    # ===== D) mod değişimi: qualifying sonrası =====
    pg,errs,c,b=ac(p,"2026-10-10T07:00:00Z"); bugun(pg)   # sprint hafta sonu, qualifying henüz yok
    st=S(pg); kontrol("D1 qualifying öncesi (A modu): PRE_WEEKEND", st and st["mod"]=="PRE_WEEKEND" and metin(pg,"#tp-bugun .tp-mod")=="HAFTA SONU ÖNCESİ", metin(pg,"#tp-bugun .tp-mod"))
    qbit=pg.evaluate("(()=>{const m=BugunV3.modBelirle(Date.now());const q=m.h.seanslar.filter(s=>s.anahtar==='Qualifying')[0];return q.bitis.toISOString()})()")
    rbas=pg.evaluate("(()=>{const m=BugunV3.modBelirle(Date.now());return m.race.baslangic.toISOString()})()")
    win_pre={x["driver"]:x["winProbability"] for x in st["pred"]["suruculer"]}
    # qualifying bitti ama Jolpica henüz yayımlamadı → yarış öncesine düşer, hata/boş kart yok
    import datetime as _d
    def sonra(iso,dk): return (_d.datetime.fromisoformat(iso.replace("Z","+00:00"))+_d.timedelta(minutes=dk)).strftime("%Y-%m-%dT%H:%M:%SZ")
    pg.clock.set_system_time(sonra(qbit,10)); tikla(pg,"nav-sezon"); bugun(pg,3)
    kontrol("D2 qualifying bitti, veri yok: PRE kartı sürüyor (boş/hatalı kart yok)", pg.locator("#tp-bugun .tp-kart").count()==1 and metin(pg,"#tp-bugun .tp-mod")=="HAFTA SONU ÖNCESİ")
    AYAR["quali17"]=True; pg.clock.set_system_time(sonra(qbit,25)); ilerle(pg,1); tikla(pg,"nav-sezon"); tikla(pg,"nav-bugun")
    for _ in range(10):
        ilerle(pg,6)
        if metin(pg,"#tp-bugun .tp-mod")=="SIRALAMA SONRASI": break
    st2=S(pg)
    kontrol("D3 qualifying verisi gelince POST_QUALIFYING: etiket SIRALAMA SONRASI", st2["mod"]=="POST_QUALIFYING" and metin(pg,"#tp-bugun .tp-mod")=="SIRALAMA SONRASI" and pg.evaluate("document.querySelector('#tp-bugun .tp-kart').dataset.mod")=="POST_QUALIFYING", (st2["mod"],metin(pg,"#tp-bugun .tp-mod")))
    win_post={x["driver"]:x["winProbability"] for x in st2["pred"]["suruculer"]}
    kontrol("D4 grid dahil olunca tahmin değişti (pole HAD'ın kazanma payı arttı)", win_post["hadjar"]>win_pre["hadjar"]+0.02, (win_pre["hadjar"],win_post["hadjar"]))
    kontrol("D5 POST toplam win ≈ 1, win ≤ podium ≤ points", abs(sum(win_post.values())-1)<0.01 and all(x["winProbability"]<=x["podiumProbability"]<=x["pointsProbability"] for x in st2["pred"]["suruculer"]))
    # yarış başladı → sabit
    n_log=len(AYAR["log"]); pg.evaluate("1")
    ham_json=json.dumps(st2["pred"],sort_keys=True)
    AYAR["sonuc17"]=True; pg.clock.set_system_time(sonra(rbas,20)); ilerle(pg,1); tikla(pg,"nav-sezon"); tikla(pg,"nav-bugun"); ilerle(pg,20)
    kontrol("D6 yarış başladı: 'YARIŞ ÖNCESİ · SABİT' etiketi", "SABİT" in metin(pg,"#tp-bugun .tp-sabit") and pg.locator("#tp-bugun .tp-sabit").count()==1, metin(pg,"#tp-bugun"))
    st3=S(pg)
    kontrol("D7 yarış başladıktan sonra tahmin DEĞİŞMEDİ (aynı mod, aynı olasılıklar)", st3["mod"]=="POST_QUALIFYING" and json.dumps(st3["pred"],sort_keys=True)==ham_json and metin(pg,"#tp-bugun .tp-mod")=="SIRALAMA SONRASI")
    kontrol("D8 yarış başladıktan sonra yeniden fetch yok (canlı/sonuç verisi tahmine girmez)", len(AYAR["log"])==n_log, (n_log,len(AYAR["log"])))
    kontrol("D9 JS hatası yok", not errs, errs); b.close()
    # ===== E) yarış tamamlandı (C modu): kart yok =====
    pg,errs,c,b=ac(p,"2026-10-11T18:00:00Z"); tikla(pg,"nav-bugun"); ilerle(pg,20)
    kontrol("E1 C modu (yarış tamamlandı): BUGÜN'de yeni tahmin kartı çizilmez", pg.evaluate("BugunV3.modBelirle(Date.now()).mod")=="C" and pg.locator("#tp-bugun .tp-kart").count()==0 and pg.evaluate("document.getElementById('tp-bugun').children.length")==0)
    b.close()
    # ===== F) veri yok / hata: boş kart yok =====
    AYAR["bos"]=True; pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); tikla(pg,"nav-bugun"); ilerle(pg,40)
    kontrol("F1 Jolpica boş: kart/panel yok, boş kutu yok", pg.locator("#tp-bugun .tp-kart").count()==0 and pg.evaluate("document.getElementById('tp-bugun').children.length")==0 and not vis(pg,"#tp-bugun"))
    n1=len(AYAR["log"]); ilerle(pg,30)
    kontrol("F2 boş yanıt tekrar tekrar denenmez (hız sınırı)", len(AYAR["log"])-n1<=12, len(AYAR["log"])-n1)
    kontrol("F3 boş yanıt cache'lenmedi (sonuç saklanmadı)", pg.evaluate("Object.keys(TahminUI._durum.sonuc).length")==0)
    AYAR["bos"]=False; pg.clock.set_system_time("2026-10-06T10:15:00Z"); ilerle(pg,2); tikla(pg,"nav-sezon"); bugun(pg,14)
    kontrol("F4 veri gelince kart çizilir (başarısızlık kalıcı değil)", pg.locator("#tp-bugun .tp-kart").count()==1)
    kontrol("F5 JS hatası yok", not errs, errs); b.close()
    AYAR["hata"]=True; pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); tikla(pg,"nav-bugun"); ilerle(pg,40)
    kontrol("F6 Jolpica 500: kart yok, JS hatası yok, ham hata metni yok", pg.locator("#tp-bugun .tp-kart").count()==0 and not errs and "500" not in metin(pg,"#sekme-bugun"), errs); b.close(); AYAR["hata"]=False
    # ===== G) mobil 390 + tema =====
    for tema in ("koyu","acik"):
        pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=390,tema=tema); bugun(pg)
        kontrol("G1[%s] 390: kart var, ilk 3 alt alta, yatay taşma 0"%tema, pg.locator("#tp-bugun .tp-top li").count()==3 and tasma(pg)==0, tasma(pg))
        ge=pg.evaluate("(()=>{const k=document.querySelector('#tp-kart').getBoundingClientRect();return {r:k.right,w:innerWidth,l:k.left}})()")
        kontrol("G2[%s] 390: kart ekranın içinde"%tema, ge["l"]>=0 and ge["r"]<=ge["w"], ge)
        pg.screenshot(path=OUT+"tahmin-bugun-390-%s.png"%tema)
        tikla(pg,"nav-analiz"); tikla(pg,"ctx-grafik"); beklekart(pg,"#tp-panel",4); ilerle(pg,2)
        kontrol("G3[%s] 390: tablo mobilde taşmıyor (tablo ≤ görünüm, sayfa taşması 0)"%tema, pg.evaluate("(()=>{const t=document.querySelector('.tp-tablo');return t.scrollWidth<=t.clientWidth+1&&t.getBoundingClientRect().right<=innerWidth})()") and tasma(pg)==0, tasma(pg))
        pg.click("#tp-panel .tp-sat .tp-ac"); ilerle(pg,2)
        kontrol("G4[%s] 390: açık neden satırı taşmıyor"%tema, tasma(pg)==0 and pg.evaluate("(()=>{const r=document.querySelector('.tp-neden:not([hidden])').getBoundingClientRect();return r.right<=innerWidth+1})()"), tasma(pg))
        pg.screenshot(path=OUT+"tahmin-analiz-390-%s.png"%tema)
        kontrol("G5[%s] tema: yazı rengi/zemin kontrastı okunur (başlık rengi zeminden farklı)"%tema, pg.evaluate("(()=>{const e=document.querySelector('.tp-y'),b=getComputedStyle(document.body).backgroundColor;return getComputedStyle(e).color!==b})()"))
        kontrol("G6[%s] yeni parlak renk/glow yok (kart/panel box-shadow none)"%tema, pg.evaluate("[...document.querySelectorAll('.tp-kart,.tp-panel,.tp-bar,.tp-bar b,.tp-mod')].every(e=>getComputedStyle(e).boxShadow==='none'&&getComputedStyle(e).textShadow==='none')"))
        kontrol("G7[%s] JS hatası yok"%tema, not errs, errs); b.close()
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=1100,tema="acik"); bugun(pg); pg.screenshot(path=OUT+"tahmin-bugun-1100-acik.png")
    kontrol("G8[acik 1100] taşma 0, kart var", tasma(pg)==0 and pg.locator("#tp-bugun .tp-kart").count()==1); b.close()
    # ===== V4) gizli önizleme: kısa tahmin kartı YARIŞ HAFTASI › PROGRAM'da (v4.0 Aşama 3) =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z")
    bugun(pg)                                     # veri v3 akışıyla yüklendi (kart BUGÜN'de çizildi)
    pg.evaluate("document.documentElement.setAttribute('data-v4','1'); NavV4._yeniden(); AnaV4.kur(); HaftaV4.kur();"); ilerle(pg,2)   # aynı sayfada önizleme kabukları kurulur (fikstür yeniden yüklenmez)
    pg.click("#nv4-hafta"); ilerle(pg,4); beklekart(pg,"#tp-bugun .tp-kart",14)
    kontrol("V4a önizleme: kart PROGRAM'ın ek kabında (#sekme-hafta-v4) ve çizildi", pg.evaluate("document.getElementById('tp-bugun').closest('[id^=sekme-]').id")=="sekme-hafta-v4" and pg.locator("#tp-bugun .tp-kart").count()==1, (pg.evaluate("[document.documentElement.dataset.v4, (document.getElementById('tp-bugun').closest('[id^=sekme-]')||{}).id, document.getElementById('tp-bugun').innerHTML.length, [...document.querySelectorAll('[id^=sekme-]')].filter(e=>!e.hidden).map(e=>e.id), Object.keys(TahminUI._durum.sonuc||{})]")))
    kontrol("V4b önizleme: kart görünür, ana sayfada yok", pg.evaluate("document.querySelector('#tp-bugun .tp-kart').checkVisibility()") and not pg.evaluate("!!document.querySelector('#sekme-sezon #tp-bugun')"))
    kontrol("V4c önizleme: JS hatası yok", not errs, errs[:3]); b.close()
    # ===== H) kaynak güvenliği =====
    src=open("/home/claude/f1-takip/prediction-ui.js").read()
    kontrol("H1 prediction-ui.js: setInterval/rAF/WebSocket YOK; localStorage yazımı yalnız tahmin arşivi (tek nokta)", not re.search(r"setInterval|requestAnimationFrame|WebSocket|EventSource",src) and src.count("localStorage.setItem")==1 and "f1-tahmin-arsiv-v1:" in src)
    kontrol("H2 setTimeout yalnız 429 bekleme yardımcısında", len(re.findall(r"setTimeout",src))==1 and "function bekle" in src)
    kontrol("H3 UI yeni model/ağırlık tanımlamıyor (AGIRLIK/SICAKLIK yok)", not re.search(r"AGIRLIK|SICAKLIK|Math\.exp",src))
    kontrol("H4 UI metinlerinde yasak dil yok", not re.search(r"kesin|garanti(?!si)|kazanacak|şampiyon olacak",src.replace("sonuç garantisi değildir","")))
    kontrol("H5 yeni ana sekme/nav düğmesi eklenmedi (nav 5 öğe)", len(re.findall(r'data-nav="[a-z]+"',open("/home/claude/f1-takip/index.html").read().split('id="nav-v3"')[1].split('</div>')[0]))==5)
    kontrol("H6 index.html: prediction-ui.js motor/veriden SONRA yüklenir", (lambda h: h.index("prediction-engine.js")<h.index("prediction-ui.js"))(open("/home/claude/f1-takip/index.html").read()))
print("\nSONUÇ: %d/%d"%(sum(L.SONUC),len(L.SONUC)))
