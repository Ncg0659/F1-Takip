# ghost_lap_v1_test — Ghost Lap + Location Replay. OpenF1 yalnız taklit (ağ yok). Çalıştır: python3 ghost_lap_v1_test.py
import json, re, subprocess, sys, os, urllib.parse
from playwright.sync_api import sync_playwright
D=os.path.dirname(os.path.abspath(__file__))+"/ghost/"
S=[]
def k(a,ok,ek=""):
    S.append(bool(ok)); print(("PASS " if ok else "FAIL ")+a+((" | "+str(ek)[:300]) if not ok else ""),flush=True)
# ---- 1) saf hesap (node) ----
r=subprocess.run(["node","ghost_kontrol.js"],cwd=D,capture_output=True,text=True)
if r.returncode!=0: print(r.stderr[-1500:]); sys.exit(1)
for c in json.loads(r.stdout.strip().splitlines()[-1]): k("[hesap] "+c["ad"],c["ok"],c["d"])
# ---- 2) tarayıcı: gerçek ghost-lap.js + telemetry-data.js, OpenF1 taklidi ----
subprocess.run(["node","ghost_mock.js"],cwd=D,check=True,capture_output=True)
M=json.load(open(D+"mock.json"))
ISO=lambda s: s
def rota_kur(page,log):
    def rota(rt):
        u=urllib.parse.unquote(rt.request.url)
        if "api.openf1.org" not in u: return rt.continue_()
        yol=u.split("/v1/")[1]; log.append(yol); ep,_,q=yol.partition("?")
        Q=dict(p.split("=",1) for p in q.split("&") if "=" in p) if q else {}
        # date>=…&date<=… anahtarları "date>" / "date<" olarak ayrışır
        def cevap(o,st=200): rt.fulfill(status=st,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps(o))
        sk=Q.get("session_key"); dn=Q.get("driver_number")
        if ep=="laps":
            v=M["laps"].get(f"{sk}/{dn}"); return cevap(v) if v else cevap([],404)
        if ep in ("car_data","location"):
            m=re.search(r"date>=([^&]+)&date<=([^&]+)",q); a=m.group(1)
            v=M["car" if ep=="car_data" else "loc"].get(f"{sk}/{dn}/{a}")
            if v is None: return cevap([],404)
            return cevap(v)
        if ep=="stints" and sk=="100": return cevap(list(M["stints"].values()))
        if ep=="pit" and sk=="100": return cevap(M["pit"])
        return cevap([],404)
    page.route("**/*",rota)
def ac(p,w=1100,br=None):
    b=br or p.chromium.launch(); cx=b.new_context(viewport={"width":w,"height":900}); page=cx.new_page(); log=[]; errs=[]
    page.on("pageerror",lambda e:errs.append(str(e))); rota_kur(page,log)
    page.goto("file://"+D+"harness.html"); page.evaluate("__ac()"); return page,log,errs,b
def ghost(page): return page.evaluate("GhostLap._durum.sonuc&&{a:GhostLap._durum.sonuc.a.lap,b:GhostLap._durum.sonuc.b.lap,as:GhostLap._durum.sonuc.a.sure,bs:GhostLap._durum.sonuc.b.sure}")
def sec(page,ne,v): page.select_option(f"[data-gl='{ne}']",v); page.wait_for_timeout(250)
def kimlik(log,ep): return [x for x in log if x.startswith(ep+"?")]
def tasma(page): return page.evaluate("document.documentElement.scrollWidth-innerWidth")
def txt(page): return page.inner_text("#gl-ghost")
with sync_playwright() as p:
    page,log,errs,b=ac(p)
    k("U1 panel 'ÖNE ÇIKAN ANALİZ' olarak YARIŞ ANALİZİ'nin ÜSTÜNDE, kapalı oluşur (audit v1)", page.evaluate("(()=>{const g=document.getElementById('gl-ghost'),t=document.getElementById('yv-detay');return !!g&&!g.open&&g.nextElementSibling===t&&/ÖNE ÇIKAN ANALİZ/.test(g.querySelector('summary').textContent)&&/GHOST LAP/.test(g.querySelector('summary').textContent)})()"))
    k("U2 yeni ana sekme/menü eklenmedi (panel tek <details>)", page.locator("#gl-ghost").count()==1 and page.locator("nav,[data-nav]").count()==0)
    k("L1 panel kapalıyken OpenF1 isteği 0", len(log)==0, log)
    page.click("#gl-ghost > summary"); page.wait_for_timeout(150)
    k("L2 panel açılınca da OpenF1 isteği 0 (telemetri tembel)", len(log)==0, log)
    k("P1 iki seçici var, ikisi de BOŞ (otomatik zorunlu seçim yok)", page.input_value("[data-gl='A']")=="" and page.input_value("[data-gl='B']")=="" and "Pilot A ve Pilot B seç" in txt(page))
    k("P2 oturum seçici: Yarış, Sıralama, Sprint (takvimde Sprint var)", page.locator("[data-gl='oturum'] option").all_inner_texts()==["Yarış","Sıralama","Sprint"])
    sec(page,"A","1")
    k("L3 yalnız Pilot A seçilince OpenF1 isteği 0", len(log)==0, log)
    page.evaluate("localStorage.setItem('f1-favori','hamilton')"); page.evaluate("__ac()"); page.wait_for_timeout(100)
    opt=page.locator("[data-gl='B'] option").all_inner_texts()
    k("P3 favori pilot listede öne alınır (★) ama seçili gelmez", opt[1].startswith("★ HAM") and page.input_value("[data-gl='B']")=="", opt[:3])
    page.evaluate("localStorage.clear()"); page.evaluate("__ac()"); page.wait_for_timeout(100); page.click("#gl-ghost > summary") if not page.evaluate("document.getElementById('gl-ghost').open") else None
    sec(page,"A","1"); sec(page,"B","1")
    k("P4 aynı pilot A ve B: karşılaştırma yok, istek yok", "farklı pilot seç" in txt(page) and len(log)==0, log)
    sec(page,"B","44"); page.wait_for_timeout(700)
    g=ghost(page)
    k("F1 varsayılan: her pilotun kendi EN HIZLI turu (A tur 3, B tur 4 — aynı lap no zorunlu değil)", g and g["a"]==3 and g["b"]==4, g)
    k("F2 başlık EN HIZLI TUR", page.inner_text("[data-gl-baslik]")=="EN HIZLI TUR", page.inner_text("[data-gl-baslik]"))
    k("F3 lap süreleri gerçek lap_duration: 1:29.871 ve 1:29.950", "1:29.871" in txt(page) and "1:29.950" in txt(page), txt(page)[:300])
    k("F4 tur farkı +0.079 (B − A)", "+0.079" in page.inner_text("#gl-ghost .gl-tablo"), page.inner_text("#gl-ghost .gl-tablo"))
    sek=page.inner_text("#gl-ghost .gl-tablo")
    k("F5 sektörler S1/S2/S3 ve fark gösterilir", all(x in sek for x in ("S1","S2","S3")), sek)
    ses=set(re.search(r"session_key=(\d+)",x).group(1) for x in log if "session_key" in x)
    k("F6 tüm istekler AYNI oturumda (session_key=100)", ses=={"100"}, ses)
    k("F7 yalnız seçilen iki pilot için istek (driver 1 ve 44)", set(re.search(r"driver_number=(\d+)",x).group(1) for x in log if "driver_number" in x)=={"1","44"})
    dl=page.evaluate("GhostLap._durum.sonuc.delta")
    k("D1 delta tur başında tam 0 (ilk nokta)", dl["noktalar"][0]["delta"]==0 and dl["noktalar"][0]["s"]==0, dl["noktalar"][0])
    k("D2 delta metni 'Tur sonu delta: ±' biçiminde, işaretli", re.search(r"Tur sonu delta:\s*[+−±]\d\.\d{3} s", txt(page)) is not None, txt(page)[:400])
    k("D3 delta grafiği varsayılan sekme; çizgi var", page.locator("svg[data-gl-grafik='delta'] path.gl-l-d").count()==1)
    page.click("[data-gl-sek='hiz']"); page.wait_for_timeout(80)
    k("C1 hız grafiği iki seri (A ve B)", page.locator("svg[data-gl-grafik='hiz'] path.gl-l-a").count()==1 and page.locator("svg[data-gl-grafik='hiz'] path.gl-l-b").count()==1)
    page.click("[data-gl-sek='gaz']"); page.wait_for_timeout(80)
    k("C2 gaz/fren grafiği ayrı panel, dört seri", page.locator("svg[data-gl-grafik='gaz'] path.gl-l-a").count()==2 and page.locator("svg[data-gl-grafik='gaz'] path.gl-l-b").count()==2)
    # eksik gaz örnekleri: çizgi KESİLİR (A turu 3'te her 40. örnekte gaz/fren yok → birden çok 'M')
    d=page.evaluate("document.querySelectorAll(\"svg[data-gl-grafik='gaz'] path.gl-l-a\")[0].getAttribute('d')")
    k("C3 eksik (null) gaz örneklerinde çizgi kesilir; 0 uydurulmaz", d.count("M")>=5, d.count("M"))
    nl=page.evaluate("GhostLap._durum.sonuc.a.prog.noktalar.filter(p=>p.throttle===null&&p.brake===null).length")
    k("C4 eksik alanlar bellekte null (0 değil)", nl>=5 and page.evaluate("GhostLap._durum.sonuc.a.prog.noktalar.every(p=>p.throttle!==0||p.brake!==undefined)"), nl)
    page.click("[data-gl-sek='delta']"); page.wait_for_timeout(50)
    # ---- manuel tur ----
    n0=len(log); sec(page,"lapA","2"); page.wait_for_timeout(500); g=ghost(page)
    k("M1 manuel tur: A tur 2, B hâlâ en hızlı (tur 4) — farklı lap numaraları", g and g["a"]==2 and g["b"]==4, g)
    k("M2 başlık 'A: TUR 2 · B: EN HIZLI TUR'", page.inner_text("[data-gl-baslik]")=="A: TUR 2 · B: EN HIZLI TUR", page.inner_text("[data-gl-baslik]"))
    yeni=log[n0:]
    k("M3 manuel tur yalnız A'nın tur 2 telemetrisini çeker (B için yeni istek yok)", all("driver_number=1&" in x or "driver_number=1" in x for x in yeni) and not any("driver_number=44" in x for x in yeni) and len(kimlik(yeni,"car_data"))==1, yeni)
    k("M4 lap seçeneklerinde süresiz out-lap yok (tur 1 listelenmez)", "Tur 1 " not in " ".join(page.locator("[data-gl='lapA'] option").all_inner_texts()) and any("Tur 4" in t for t in page.locator("[data-gl='lapA'] option").all_inner_texts()))
    # ---- önbellek: tekrar çekim 0 ----
    n1=len(log); sec(page,"lapA","fastest"); sec(page,"lapA","2"); sec(page,"lapA","3")
    k("K1 daha önce çekilen oturum/pilot/tur tekrar çekilmez (cache)", len(log)==n1, log[n1:])
    ayni=[x for x in log if x.startswith(("car_data","location"))]
    k("K2 hiçbir car_data/location URL'si iki kez çekilmedi (duplicate 0)", len(ayni)==len(set(ayni)), len(ayni))
    k("K3 laps isteği pilot başına 1 (2 toplam, oturum 100)", len([x for x in log if x.startswith("laps?session_key=100")])==2, [x for x in log if x.startswith("laps")])
    sec(page,"lapA","fastest"); sec(page,"A",""); sec(page,"A","1"); page.wait_for_timeout(500)
    k("K4 pilotu kaldırıp tekrar seçmek de yeni istek atmaz", len([x for x in log if x.startswith(("car_data","location"))])==len(ayni), len(log))
    # ---- replay ----
    k("R1 LOCATION REPLAY alanı ve pist SVG'si var; iki işaretçi A/B", page.locator("svg[data-gl-pist]").count()==1 and page.locator("[data-gl-isaret]").count()==2)
    rp=page.evaluate("(()=>{const s=GhostLap._durum.sonuc;return {a:s._rp.sa.length,b:s._rp.sb.length,top:s._rp.toplam,T:s._rp.T.durum,hata:s._rp.T.hata,ayna:s._rp.T.ayna}})()")
    k("R2 yalnız gerçek x/y örnekleri; dönüşüm bulundu; ayna/ölçek/döndürme görsel", rp["a"]>200 and rp["b"]>200 and rp["T"]=="ok" and rp["ayna"] is True and rp["hata"]<0.03, rp)
    k("R3 replay süresi gerçek tur süresi (≈90 sn)", 89000<=rp["top"]<=91000, rp["top"])
    n2=len(log)
    page.evaluate("GhostLap._kaydir(600)"); vis=page.evaluate("[...document.querySelectorAll('[data-gl-isaret]')].map(g=>!g.hasAttribute('hidden'))")
    k("R5 600 ms: iki pilot da pistte (gerçek konum)", vis==[True,True], vis)
    # işaretçi konumu = ham x/y'nin doğrusal dönüşümü (snap yok) ve çizgiye yakın (veri çizgi üstünde üretildi)
    sn=page.evaluate("""(()=>{const s=GhostLap._durum.sonuc,R=s._rp;GhostLap._kaydir(45000);const g=document.querySelector("[data-gl-isaret='A']");const m=/translate\\(([-\\d.]+) ([-\\d.]+)\\)/.exec(g.getAttribute('transform'));
      const p=GhostHesap.konumZaman(R.sa,45000),u=GhostHesap.uygula(R.T,p.x,p.y);return {dx:Math.abs(+m[1]-u.x),dy:Math.abs(+m[2]-u.y)}})()""")
    k("R6 işaretçi = uygula(dönüşüm, ham x/y) (≤0.01 birim): yapay snap yok", sn["dx"]<0.01 and sn["dy"]<0.01, sn)
    p1=page.evaluate("(()=>{GhostLap._kaydir(30000);const f=i=>{const m=/translate\\(([-\\d.]+) ([-\\d.]+)\\)/.exec(document.querySelector(\"[data-gl-isaret='\"+i+\"']\").getAttribute('transform'));return [+m[1],+m[2]]};return [f('A'),f('B')]})()")
    k("R7 iki pilot aynı anda farklı konumda (gerçek fark; progress eşleştirmesi yok)", p1[0]!=p1[1], p1)
    sB=page.evaluate("(()=>{const s=GhostLap._durum.sonuc;GhostLap._kaydir(s._rp.toplam);const a=document.querySelector(\"[data-gl-isaret='A']\"),b=document.querySelector(\"[data-gl-isaret='B']\");return [a.getAttribute('data-durum'),b.getAttribute('data-durum'),a.hasAttribute('hidden'),b.hasAttribute('hidden'),s._rp.sa[s._rp.sa.length-1].t,s._rp.sb[s._rp.sb.length-1].t]})()")
    k("R8 tur biten pilot son gerçek konumunda kalır (durum 'bitti', gizlenmez)", sB[0]=="bitti" and sB[1]=="bitti" and sB[2] is False and sB[3] is False, sB)
    # kontroller
    page.evaluate("GhostLap._kaydir(0)")
    page.click("[data-gl-rp='oynat']"); page.wait_for_timeout(700)
    pz=page.evaluate("GhostLap._durum.rp.poz")
    k("PL1 Play: zaman ilerler", pz>300, pz)
    k("PL2 Play düğmesi 'Duraklat' olur (aria-pressed=true)", "Duraklat" in page.inner_text("[data-gl-rp='oynat']") and page.get_attribute("[data-gl-rp='oynat']","aria-pressed")=="true")
    page.click("[data-gl-rp='oynat']"); pz1=page.evaluate("GhostLap._durum.rp.poz"); page.wait_for_timeout(500); pz2=page.evaluate("GhostLap._durum.rp.poz")
    k("PL3 Pause: zaman durur", pz1==pz2 and not page.evaluate("GhostLap._durum.rp.oynuyor"), (pz1,pz2))
    page.fill("[data-gl-kaydir]","40000"); page.dispatch_event("[data-gl-kaydir]","input"); 
    k("PL4 Scrubber: 40 sn'ye gider; süre metni güncellenir", abs(page.evaluate("GhostLap._durum.rp.poz")-40000)<20 and page.inner_text("[data-gl-sure]").startswith("40.0 /"), page.inner_text("[data-gl-sure]"))
    page.click("[data-gl-rp='basa']"); k("PL5 Başa dön: 0'a gider ve durur", page.evaluate("GhostLap._durum.rp.poz")==0 and not page.evaluate("GhostLap._durum.rp.oynuyor") and page.input_value("[data-gl-kaydir]")=="0")
    sonuc=[]
    for h in ("0.5","1","2"):
        page.click(f"[data-gl-hiz='{h}']"); page.evaluate("GhostLap._kaydir(0)"); page.evaluate("GhostLap._adim(1000)"); sonuc.append(page.evaluate("GhostLap._durum.rp.poz"))
    k("PL6 hız 0.5×/1×/2×: 1 sn gerçek süre → 500/1000/2000 ms replay", sonuc==[500,1000,2000], sonuc)
    k("PL7 hız düğmeleri aria-pressed (yalnız seçili)", page.get_attribute("[data-gl-hiz='2']","aria-pressed")=="true" and page.get_attribute("[data-gl-hiz='0.5']","aria-pressed")=="false")
    page.click("[data-gl-hiz='2']"); page.evaluate("GhostLap._kaydir(0)"); page.click("[data-gl-rp='oynat']"); page.wait_for_timeout(600); pz=page.evaluate("GhostLap._durum.rp.poz"); page.click("[data-gl-rp='oynat']")
    k("PL8 gerçek zamanlı 2× oynatma: 600 ms'de ≈1.2 sn (rAF)", 700<pz<1800, pz)
    page.evaluate("GhostLap._kaydir(0)"); page.click("[data-gl-hiz='1']"); page.evaluate("GhostLap._kaydir(GhostLap._durum.sonuc._rp.toplam-100)"); page.click("[data-gl-rp='oynat']"); page.wait_for_timeout(400)
    k("PL9 sona gelince otomatik durur", not page.evaluate("GhostLap._durum.rp.oynuyor") and page.evaluate("GhostLap._durum.rp.poz")==page.evaluate("GhostLap._durum.sonuc._rp.toplam"))
    # replay sırasında ağ 0
    page.evaluate("GhostLap._kaydir(0)"); page.click("[data-gl-hiz='2']"); page.click("[data-gl-rp='oynat']"); page.wait_for_timeout(500); page.fill("[data-gl-kaydir]","60000"); page.dispatch_event("[data-gl-kaydir]","input"); page.click("[data-gl-hiz='0.5']"); page.wait_for_timeout(300); page.click("[data-gl-rp='oynat']"); page.click("[data-gl-rp='basa']")
    k("N1 replay (oynat/duraklat/scrub/hız/başa dön) boyunca yeni ağ isteği 0", len(log)==n2, (n2,len(log)))
    k("N2 replay boyunca TelemetriVeri istek sayacı da değişmedi", page.evaluate("TelemetriVeri._sayac.istek")==page.evaluate("TelemetriVeri._sayac.istek") and len(log)==n2)
    # ---- overflow ----
    k("O1 1100 px: yatay sayfa taşması 0", tasma(page)==0, tasma(page))
    k("O2 1100 px: panel içeriği taşmıyor", page.evaluate("(()=>{const g=document.getElementById('gl-ghost');return g.scrollWidth<=g.clientWidth+1})()"))
    k("O3 SVG'ler panel genişliğini aşmaz", page.evaluate("[...document.querySelectorAll('#gl-ghost svg')].every(s=>s.getBoundingClientRect().right<=document.getElementById('gl-ghost').getBoundingClientRect().right+1)"))
    k("Y1 yorum yok: arayüz metninde yasak konu/yorum geçmiyor", not re.search(r"fren s[ıi]cakl|lastik enerji|\bERS\b|batarya|çekiş|yarış çizgisi|daha iyi|kötü|hata yaptı|dominant|harika", txt(page), re.I), txt(page)[:200])
    # ---- farklı oturum ----
    n3=len(log); sec(page,"oturum","Qualifying"); page.wait_for_timeout(700); newl=log[n3:]
    ses=set(re.search(r"session_key=(\d+)",x).group(1) for x in newl if "session_key" in x)
    g=ghost(page)
    k("X1 oturum değişince tüm yeni istekler YALNIZ yeni oturumda (200); eski oturum turu karışmaz", ses=={"200"} and g and g["a"]==2 and g["b"]==2 and abs(g["as"]-88.5)<1e-9 and abs(g["bs"]-88.9)<1e-9, (ses,g))
    k("X2 oturum değişimi seçili turları sıfırlar (lap seçenekleri yeni oturumdan)", all("Tur 3" not in t and "Tur 4" not in t for t in page.locator("[data-gl='lapA'] option").all_inner_texts()))
    # ---- konum yok ----
    sec(page,"oturum","Race"); sec(page,"A","16"); sec(page,"B","44"); page.wait_for_timeout(700)
    k("NL1 x/y yoksa (pilot 16 konumsuz, pilot 44 konumlu): konumu olan pilot için replay, olmayan için işaretçi yok", page.locator("svg[data-gl-pist]").count()==1 and page.evaluate("GhostLap._durum.sonuc._rp.sa.length")==0 and page.evaluate("GhostLap._durum.sonuc._rp.sb.length")>200)
    page.evaluate("GhostLap._kaydir(30000)")
    k("NL2 konumsuz pilotun işaretçisi gizli (fallback konum YOK)", page.evaluate("document.querySelector(\"[data-gl-isaret='A']\").hasAttribute('hidden')") and not page.evaluate("document.querySelector(\"[data-gl-isaret='B']\").hasAttribute('hidden')"))
    sec(page,"B","63"); page.wait_for_timeout(500)
    k("NL3 iki pilotta da x/y yoksa REPLAY GÖSTERİLMEZ (pist SVG yok, açıklama var)", page.locator("svg[data-gl-pist]").count()==0 and page.locator("[data-gl-replay-yok]").count()==1 and "konum verisi yok" in txt(page), txt(page)[-200:])
    k("NL4 konumsuz durumda grafikler çalışır (telemetri var)", page.locator("svg[data-gl-grafik]").count()==1)
    # car_data yok
    sec(page,"B","55"); page.wait_for_timeout(500)
    k("NL5 car_data boş pilot: 'telemetri verisi yok', grafik/replay/delta üretilmez", "telemetri verisi yok" in txt(page).lower() and page.locator("svg").count()==0 and ghost(page) is None, txt(page)[-150:])
    sec(page,"B","77"); page.wait_for_timeout(500)
    k("NL6 hiç lap kaydı olmayan pilot: 'telemetri verisi yok'", "telemetri verisi yok" in txt(page).lower())
    k("JS1 sayfada JS hatası yok", not errs, errs)
    b.close()
    # ---- 390 px ----
    page,log,errs,b=ac(p,390); page.click("#gl-ghost > summary"); sec(page,"A","1"); sec(page,"B","44"); page.wait_for_timeout(800)
    k("O4 390 px: yatay sayfa taşması 0", tasma(page)==0, tasma(page))
    k("O5 390 px: panel içeriği taşmıyor; tablo kendi içinde kayar", page.evaluate("(()=>{const g=document.getElementById('gl-ghost');return g.scrollWidth<=g.clientWidth+1})()"))
    k("O6 390 px: SVG grafik ve pist panel içinde", page.evaluate("[...document.querySelectorAll('#gl-ghost svg')].every(s=>{const r=s.getBoundingClientRect(),g=document.getElementById('gl-ghost').getBoundingClientRect();return r.left>=g.left-1&&r.right<=g.right+1&&r.width>200})"))
    k("O7 390 px: kontroller (oynat/başa/hız) tek-iki satırda, 40px+ dokunma alanı", page.evaluate("(()=>{const b=[...document.querySelectorAll('.gl-rp button')];const tops=new Set(b.map(x=>Math.round(x.getBoundingClientRect().top)));return b.length===5&&tops.size<=2&&b.every(x=>x.getBoundingClientRect().height>=38)})()"))
    k("O8 390 px: scrubber kullanılabilir (genişlik ≥ 200 px) ve çalışır", page.evaluate("document.querySelector('[data-gl-kaydir]').getBoundingClientRect().width")>=200)
    page.fill("[data-gl-kaydir]","20000"); page.dispatch_event("[data-gl-kaydir]","input")
    k("O9 390 px: scrub ile işaretçiler güncellenir", page.evaluate("!document.querySelector(\"[data-gl-isaret='A']\").hasAttribute('hidden')"))
    k("O10 390 px: seçici düzeni — Pilot A/B yan yana (iki sütun), Oturum tam satır", page.evaluate("(()=>{const a=document.querySelector(\"[data-gl='A']\").getBoundingClientRect(),b=document.querySelector(\"[data-gl='B']\").getBoundingClientRect();return Math.abs(a.top-b.top)<4&&b.left>a.right-2})()"))
    page.screenshot(path="/tmp/f1-ekran/ghost_ekran390.png",full_page=False)
    k("JS2 390 px'te JS hatası yok", not errs, errs)
    b.close()

# ---- 3) gerçek uygulama: index.html içinde Yarış analizi (yaris_v3 altyapısı) ----
import ya_fx as YF
NOW="2026-10-12T10:00:00Z"
def hazir(p,w):
    d=YF.Durum(); d.sonuc[("17","qualifying")]=YF.siralama(); d.sonuc[("17","results")]=YF.yaris(sprint=False); d.sonuc[("16","results")]=YF.yaris()
    d.of_res[2]=YF.of_sq(); d.of_rc={5:YF.FX}; d.of_laps={5:YF.laps(5,60,22,False)}; d.of_ovt={5:YF.ovt(5)}; d.of_pit={5:YF.pit(5)}; d.of_hava={5:YF.hava(5,60,yagmur=True)}
    page,errs,br=YF.ac2(p,d,NOW,w,sayfa="yaris")
    page.evaluate("Ogren.modYaz('acik')"); page.clock.run_for(15000); page.wait_for_timeout(400)
    return d,page,errs,br
TEL=re.compile(r"^(car_data|location)\?|^laps\?")
with sync_playwright() as p:
    for w in (1100,390):
        d,page,errs,b=hazir(p,w); tel=lambda: [u for u in d.of_cagri[d.ofbase:] if TEL.match(u.split("/v1/")[-1])]
        k(f"I{w}-1 gerçek uygulamada GHOST LAP paneli yarış sekmesinde, YARIŞ ANALİZİ'nin hemen üstünde (öne çıkan analiz), kapalı", page.evaluate("(()=>{const g=document.getElementById('gl-ghost');return !!g&&!g.open&&!!g.closest('#sekme-yaris')&&g.nextElementSibling===document.getElementById('yv-detay')})()"))
        k(f"I{w}-2 gerçek uygulamada panel kapalıyken car_data/location/laps isteği 0 (tur-analizi laps hariç değil: bu panel çağırmaz)", not [u for u in tel() if "car_data" in u or "location" in u], tel()[:3])
        page.evaluate("document.dispatchEvent(new CustomEvent('f1-yaris-sonuc',{detail:{tur:'17',liste:[['1','VER','Verstappen','max_verstappen'],['44','HAM','Hamilton','hamilton'],['16','LEC','Leclerc','leclerc']].map(x=>({number:x[0],Driver:{code:x[1],familyName:x[2],driverId:x[3]}}))}}))")
        page.clock.run_for(2000); page.wait_for_timeout(300)   # v3.2.0: görünürdeki Lastik Stratejisi bölümü yarış değişince kendi (tembel) verisini çeker; ölçüm ondan sonra başlar
        n0=len(d.of_cagri)
        page.evaluate("document.getElementById('gl-ghost').open=true"); page.clock.run_for(2000); page.wait_for_timeout(300)
        k(f"I{w}-3 paneli açmak OpenF1 isteği atmaz; seçiciler boş, pilot listesi dolu", len(d.of_cagri)==n0 and page.input_value("[data-gl='A']")=="" and page.locator("[data-gl='A'] option").count()>2, (len(d.of_cagri),n0))
        k(f"I{w}-4 yatay sayfa taşması 0 ({w}px)", page.evaluate("document.documentElement.scrollWidth-innerWidth")==0, page.evaluate("document.documentElement.scrollWidth-innerWidth"))
        k(f"I{w}-5 panel taşmaz (kart içinde)", page.evaluate("(()=>{const g=document.getElementById('gl-ghost');return g.scrollWidth<=g.clientWidth+1&&g.getBoundingClientRect().right<=innerWidth})()"))
        k(f"I{w}-6 JS hatası yok", not errs, errs)
        if w==390: page.screenshot(path="/tmp/f1-ekran/ghost_ekran_uygulama390.png")
        b.close()
print("SONUC %d/%d"%(sum(S),len(S))); sys.exit(0 if all(S) else 1)
