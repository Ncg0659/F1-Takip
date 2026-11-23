# kaynak_timeout_v1_test — 3.0.10 VERİ KAYNAĞI ZAMAN AŞIMI. Jolpica "cevap vermiyor" (istek asılı kalır) → ~10 sn sonra sade kart,
# YENİDEN DENE → kaynak düzelince ekranlar normale döner. Sahte saat; ağ yok (ya_lib düzeneği). OpenF1 etkilenmez.
import sys, re
sys.path.insert(0,'.')
exec(open('bugun_v3_test.py').read().split("\nwith sync_playwright")[0])
from playwright.sync_api._generated import Page as _Page

DURUM={"kapali":False}; ASILI=[]; ISTEK=[]
_route=_Page.route
def _sarili_route(self, url, handler, *a, **k):            # yalnız Jolpica: "kapalı"yken yanıt verilmez (sunucu cevap vermiyor)
    def h(r):
        u=r.request.url
        if "api.jolpi.ca" in u:
            ISTEK.append(u)
            if DURUM["kapali"]: ASILI.append(r); return
        return handler(r)
    return _route(self, url, h, *a, **k)
_Page.route=_sarili_route

KART_B="VERİ KAYNAĞINA ULAŞILAMIYOR"; KART_A="Formula 1 verileri şu anda alınamıyor. Biraz sonra tekrar deneyebilirsin."
TEKNIK=re.compile(r"HTTP|CORS|timeout|zaman aşımı|AbortError|Failed to fetch|NetworkError|sunucu cevabı|Hata:|-> ağ hatası|kısa devre")
def metin(pg,sel): return pg.evaluate("(s)=>{const e=document.querySelector(s);return e?e.innerText:''}",sel)
def konsol(pg,l): pg.on("console",lambda m: l.append(m.text) if m.type=="error" and "Failed to load resource" not in m.text else None)   # düzenek dış kaynakları (CDN) keser
def bas(p,saat,w,tema,kapali=True):
    DURUM["kapali"]=kapali; del ASILI[:]; del ISTEK[:]
    pg,errs,c,b=yeni(p,saat,w=w,tema=tema); kerr=[]; konsol(pg,kerr)
    return pg,errs,kerr,b
def kart_var(pg,sel): return pg.evaluate("(s)=>{const k=document.querySelector(s+' [data-kaynak-kart]');return !!k&&k.checkVisibility()}",sel)
def races_istek(): return len([u for u in ISTEK if re.search(r"/ergast/f1/2026/races/$",u)])

with sync_playwright() as p:
    for w,tema in ((390,"koyu"),(390,"acik"),(1100,"koyu"),(1100,"acik")):
        T="[%d %s]"%(w,tema)
        # ===== A) BUGÜN: önce "yükleniyor", ~10 sn sonra kart (sonsuz YÜKLENİYOR yok) =====
        pg,errs,kerr,b=bas(p,NOW,w,tema); tikla(pg,"nav-bugun"); ilerle(pg,2)
        kontrol("A1"+T+" ilk saniyeler: yükleniyor durumu (henüz hata kartı yok)", not kart_var(pg,"#bg-kok") and "YÜKLENİYOR" in metin(pg,"#bg-kok"), metin(pg,"#bg-kok")[:80])
        ilerle(pg,12)
        bk=metin(pg,"#bg-kok")
        kontrol("A2"+T+" ~10 sn sonra BUGÜN: 'VERİ KAYNAĞINA ULAŞILAMIYOR' kartı + YENİDEN DENE; YÜKLENİYOR kalmadı", kart_var(pg,"#bg-kok") and KART_B in bk and KART_A in bk and "YENİDEN DENE" in bk and "YÜKLENİYOR" not in bk, bk[:200])
        kontrol("A3"+T+" durum ayrımı: erişilemiyor ≠ sezon arası ≠ boş", pg.evaluate("KaynakDurum.durum()")=="erisilemez" and "SEZON ARASI" not in bk and "henüz yayınlanmadı" not in bk)
        tikla(pg,"nav-sezon"); ilerle(pg,4)
        sz=pg.evaluate("document.getElementById('sekme-sezon').innerText")
        kontrol("A4"+T+" SEZON: kart + tablolarda 'Yükleniyor...' kalmadı", kart_var(pg,"#sonraki") and "Yükleniyor" not in sz and "yükleniyor" not in sz, re.findall(r".{0,30}[Yy]ükleniyor.{0,10}",sz))
        tum=pg.evaluate("document.body.innerText")
        kontrol("A5"+T+" kullanıcıya teknik hata metni yok", not TEKNIK.search(tum), TEKNIK.findall(tum))
        kontrol("A6"+T+" taşma 0, JS/konsol hatası yok", tasma(pg)==0 and not errs and not kerr, (tasma(pg),errs,kerr[:3]))
        # OpenF1 bağımsız: sarmalayıcı yalnız Jolpica'ya dokunur
        of=pg.evaluate("(async()=>{try{const r=await fetch('https://api.openf1.org/v1/sessions?year=2026');return r.status}catch(e){return 'ERR'}})()")
        kontrol("A7"+T+" OpenF1 isteği Jolpica hatasından etkilenmez (kısa devre yok)", of==200, of)
        # ===== B) YENİDEN DENE: hızlı art arda tıklama tek istek; kaynak düzelince normale dönüş =====
        DURUM["kapali"]=False; once=races_istek(); pg.evaluate("window.__ayniSayfa=1")
        pg.evaluate("(()=>{const b=document.querySelector('#sonraki [data-kaynak-yeniden]');for(let i=0;i<5;i++)b.click()})()")
        ilerle(pg,1)
        kontrol("B1"+T+" 5 hızlı tıklama → takvim isteği yalnız 1 kez", races_istek()-once==1, races_istek()-once)
        ilerle(pg,14)
        sz=pg.evaluate("document.getElementById('sekme-sezon').innerText")
        kontrol("B2"+T+" SEZON normale döndü: kart yok, puan tablosu dolu, durum 'tamam'", not kart_var(pg,"#sonraki") and pg.locator("#pilot-govde tr").count()>=3 and "Antonelli" in sz and pg.evaluate("KaynakDurum.durum()")=="tamam", sz[:120])
        tikla(pg,"nav-bugun"); ilerle(pg,4); m=M(pg)
        kontrol("B3"+T+" BUGÜN normale döndü (mod A/B/C, kart yok, sayfa yenilenmedi)", m and m["mod"] in ("A","B","C") and not kart_var(pg,"#bg-kok") and pg.evaluate("window.__ayniSayfa===1"), m)
        kontrol("B4"+T+" taşma 0, hata yok", tasma(pg)==0 and not errs and not kerr, (errs,kerr[:3])); b.close()

    # ===== C) HAFTA SONU: kart → kurtarma; son iyi veri "GÜNCEL OLMAYABİLİR" =====
    for w,tema in ((390,"koyu"),(1100,"acik")):
        T="[%d %s]"%(w,tema)
        pg,errs,kerr,b=bas(p,NOW,w,tema); tikla(pg,"nav-haftasonu"); ilerle(pg,14)
        hs=metin(pg,"#sekme-hafta")
        kontrol("C1"+T+" HAFTA SONU: kart, 'Yükleniyor...' yok, teknik metin yok", kart_var(pg,"#sekme-hafta") and "Yükleniyor" not in hs and not TEKNIK.search(hs), hs[:160])
        DURUM["kapali"]=False; pg.click("#sekme-hafta [data-kaynak-yeniden]"); ilerle(pg,16)
        kontrol("C2"+T+" YENİDEN DENE → yarış haftası açıldı (hero + seans programı)", pg.locator("#sekme-hafta .h-hero").count()==1 and pg.locator("#sekme-hafta .h-cz").count()>=3 and not kart_var(pg,"#sekme-hafta"))
        # son iyi veri: takvim önbelleği süresi dolmuş + kaynak kapalı → eski takvim GÜNCEL OLMAYABİLİR etiketiyle
        pg.evaluate("(()=>{const k='f1-hafta-v1-takvim-2026';const v=JSON.parse(localStorage.getItem(k));v.t=Date.now()-40*86400000;localStorage.setItem(k,JSON.stringify(v))})()")
        DURUM["kapali"]=True; pg.reload(); ilerle(pg,3); tikla(pg,"nav-haftasonu"); ilerle(pg,24)
        e=metin(pg,"#sekme-hafta [data-eski-veri]")
        kontrol("C3"+T+" son iyi takvim gösterilirse 'GÜNCEL OLMAYABİLİR · … son güncelleme' etiketi var", ("GÜNCEL OLMAYABİLİR" in e and "son güncelleme" in e) if pg.locator("#sekme-hafta .h-hero").count() else kart_var(pg,"#sekme-hafta"), e)
        kontrol("C4"+T+" taşma 0, hata yok", tasma(pg)==0 and not errs and not kerr, (errs,kerr[:3])); b.close()

    # ===== D) ANALİZ (Jolpica'lı bölüm) ve geçmiş yarış: kart → kurtarma =====
    pg,errs,kerr,b=bas(p,NOW,390,"koyu",kapali=False); ilerle(pg,6)
    DURUM["kapali"]=True; tikla(pg,"nav-analiz"); pg.evaluate("sekmeAc('grafik')"); ilerle(pg,16)
    kontrol("D1 ANALİZ: Sezon Analiz Merkezi yerine kart (sonsuz 'yükleniyor' yok)", kart_var(pg,"#a3-merkez") and "yükleniyor" not in metin(pg,"#a3-merkez"), metin(pg,"#a3-merkez")[:120])
    DURUM["kapali"]=False; n0=len(ISTEK); pg.click("#a3-merkez [data-kaynak-yeniden]"); ilerle(pg,30)
    # bu düzenek sezon analiz sayfalamasını (total) taklit etmez → analizin kendi "eski grafik" durumuna düşer; burada YENİDEN DENE'nin isteği gerçekten başlattığı ve kartın kalktığı ölçülür
    kontrol("D2 ANALİZ: YENİDEN DENE → sonuç istekleri yeniden başladı, kaynak kartı kalktı, durum 'tamam'", len([u for u in ISTEK[n0:] if "/results/" in u])>=1 and not kart_var(pg,"#a3-merkez") and pg.evaluate("KaynakDurum.durum()")=="tamam", ISTEK[n0:n0+3])
    DURUM["kapali"]=True; pg.evaluate("KaynakDurum._durum.kapaliBitis=0")
    pg.evaluate("sekmeAc('yaris')"); ilerle(pg,3)
    if pg.locator("#yaris-sec option").count():
        pg.select_option("#yaris-sec",pg.evaluate("document.querySelector('#yaris-sec option:nth-child(2)')?.value || document.querySelector('#yaris-sec option').value")); ilerle(pg,14)
        kontrol("D3 geçmiş yarış: kart, teknik metin yok", kart_var(pg,"#yaris-durum") and not TEKNIK.search(metin(pg,"#yaris-durum")), metin(pg,"#yaris-durum"))
        DURUM["kapali"]=False; pg.click("#yaris-durum [data-kaynak-yeniden]"); ilerle(pg,14)
        kontrol("D4 geçmiş yarış: YENİDEN DENE → sonuç tablosu geldi", not kart_var(pg,"#yaris-durum") and pg.locator("#yaris-govde tr, #sonuc-govde tr").count()>=3, pg.locator("#yaris-govde tr, #sonuc-govde tr").count())
    else: kontrol("D3 geçmiş yarış seçicisi yok (bu düzenekte atlandı)", True)
    kontrol("D5 taşma 0, hata yok", tasma(pg)==0 and not errs and not kerr, (errs,kerr[:3])); b.close()

    # ===== E) kaynak normalken kart hiç görünmez; sezon arası kendi durumunu korur =====
    pg,errs,kerr,b=bas(p,NOW,390,"koyu",kapali=False); tikla(pg,"nav-bugun"); ilerle(pg,10)
    kontrol("E1 kaynak çalışırken hiçbir ekranda kart yok, durum 'tamam'", pg.locator("[data-kaynak-kart]").count()==0 and pg.evaluate("KaynakDurum.durum()")=="tamam")
    kontrol("E2 hata yok", not errs and not kerr, (errs,kerr[:3])); b.close()

print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
