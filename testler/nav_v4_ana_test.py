# F1 TAKİP v4.0 — AŞAMA 2: AKILLI ANA SAYFA (yalnız ?nav=v4)
#   V : yayındaki v3 varsayılan aynen (BUGÜN ve SEZON ayrı ekranlar, DOM yerinde)
#   D : beş durum ayrı ayrı — canlı (doğrulanmış / tahmini), yarış haftası, yarış bitti, normal gün, sezon arası (2 biçim)
#       her durumda içerik önceliği (görsel sıra), tekrar eden blokların gizliliği, 390/1100 × koyu/açık, taşma 0, hata 0
#   I : içerik: SON YARIŞ, PUAN, SENARYO (kesinleşince gizlenir), TAKVİM (mobil kısa görünüm), SERİLER (yalnız F2/F3)
#   G : geçişler — son yarış → ANALİZ, seri kartı → KEŞFET › SERİLER (doğru seri), takvim kısayolu, logo, kısa tahmin kartı yerinde
import sys, re, json, copy
sys.path.insert(0, '.')
from ya_lib import *

OUT = "/tmp/f1-ekran/"
URL = "file:///home/claude/f1-takip/index.html"
def ev(id, ts, cat, tr): return {"id": id, "timestamp": ts, "category": cat, "priority": "high", "textTr": tr, "sourceUrl": "https://x", "sourceName": "Chris Medland", "sourceLevel": "B", "status": "confirmed", "drivers": []}
LV = [dict(ev("r0", "2026-10-11T12:02:00Z", "RESTART", "Yarış başladı."), originalText="Lights out and away we go. The race has started.")]
def sekme(pg): return pg.evaluate("[...document.querySelectorAll('[id^=sekme-]')].filter(e=>!e.hidden && !/-v4$/.test(e.id)).map(e=>e.id.slice(6))")  # v4 ek kapları (sekme-*-v4) ekran sayılmaz
def ana(pg): return pg.evaluate("[...document.querySelectorAll('#nav-v4 [aria-current]')].map(b=>b.dataset.nv4)")
def mod(pg): return pg.evaluate("(document.getElementById('av4')||{dataset:{}}).dataset.av4Mod")
def tasma(pg): return pg.evaluate("document.documentElement.scrollWidth-innerWidth")
def vis(pg, s): return pg.evaluate("(s)=>{const e=document.querySelector(s);return !!e&&e.checkVisibility()}", s)
def sira(pg): return pg.evaluate("[...document.querySelectorAll('#av4 > section')].filter(s=>s.checkVisibility()).map(s=>[s.id.slice(4),Math.round(s.getBoundingClientRect().top+scrollY)]).sort((a,b)=>a[1]-b[1]).map(x=>x[0])")
def tik(pg, s, sn=6): pg.click(s); ilerle(pg, sn)

def ac(p, saat, w=1100, tema="koyu", feed=None, v4=True, sezon27=None):
    pg, errs, c, b = yeni(p, saat, w=w, tema=tema)
    pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2026/17/(qualifying|sprint|results)"), lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"MRData":{"RaceTable":{"Races":[]}}}'))
    if sezon27 is not None:
        bos = lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps({"MRData": {"total": "0", "RaceTable": {"Races": []}, "StandingsTable": {"StandingsLists": []}}}))
        pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2027/"), bos)
    ilerle(pg, 4)
    if feed: pg.evaluate("""(o)=>localStorage.setItem('f1-feed-v1-2026-17', JSON.stringify({olaylar:o,gorulen:{},enYeniPost:null,motorSurum:RaceFeed.MOTOR_SURUM}))""", feed)
    pg.evaluate("(t)=>localStorage.setItem('f1-tema',t)", tema)
    pg.goto(URL + ("?nav=v4" if v4 else "")); ilerle(pg, 14)
    return pg, errs, c, b

DURUMLAR = [  # ad, saat, feed, beklenen mod, beklenen sıra (görünür bölümler), son yarış görünür mü
    ("normal", "2026-10-06T10:00:00Z", None, "normal", ["durum", "son", "puan", "senaryo", "takvim", "seriler"]),
    ("hafta", "2026-10-08T21:00:00Z", None, "hafta", ["durum", "puan", "senaryo", "son", "takvim", "seriler"]),
    ("canli-dogrulanmis", "2026-10-11T12:30:00Z", LV, "canli", ["durum", "puan", "takvim", "senaryo", "seriler"]),
    ("canli-tahmini", "2026-10-11T12:30:00Z", None, "canli", ["durum", "puan", "takvim", "senaryo", "seriler"]),
    ("bitti", "2026-10-11T18:00:00Z", None, "bitti", ["durum", "puan", "senaryo", "takvim", "seriler"]),
    ("sezon-tamam", "2026-12-20T10:00:00Z", None, "ara", None),
    ("sezon-arasi", "2027-01-15T10:00:00Z", None, "ara", None),
]

with sync_playwright() as p:
    # ===== V) yayın varsayılanı =====
    pg, errs, c, b = ac(p, "2026-10-06T10:00:00Z", v4=False)
    kontrol("V1 v3: #av4 yok, BUGÜN özeti kendi ekranında, hesaplayıcı SEZON'un doğrudan çocuğu", pg.evaluate("!document.getElementById('av4') && document.getElementById('bg-kok').parentElement.id==='sekme-bugun' && document.querySelector('#sekme-sezon > section.ui-hesap')!==null"))
    kontrol("V2 v3: açılış BUGÜN, özet çizildi, kısa tahmin kutusu BUGÜN'de", sekme(pg) == ["bugun"] and pg.evaluate("!!document.querySelector('#bg-kok [data-mod]') && document.getElementById('tp-bugun').closest('[id^=sekme-]').id==='sekme-bugun'"))
    pg.evaluate("sekmeAc('sezon')"); ilerle(pg, 8)
    kontrol("V3 v3: SEZON ekranı eski düzende (takvimin SIRADAKİ kartı görünür, ana sayfa bölümleri yok)", sekme(pg) == ["sezon"] and not pg.evaluate("!!document.querySelector('.av4-bolum')") and (pg.locator("#a2-takvim .st-p-kart").count() == 0 or vis(pg, "#a2-takvim .st-p-kart")))
    kontrol("V4 v3: Formula E diğer serilerde duruyor (v3 bozulmadı)", any(x["kod"] == "fe" for x in pg.evaluate("window.DIGER_SERILER")))
    kontrol("V5 hata yok", not errs, errs[:3]); b.close()

    # ===== D) beş durum × genişlik × tema =====
    for ad, saat, feed, bmod, bsira in DURUMLAR:
        for w, tema in ((1100, "koyu"), (390, "koyu"), (390, "acik"), (1100, "acik")):
            e = "%s %d-%s" % (ad, w, tema)
            pg, errs, c, b = ac(p, saat, w=w, tema=tema, feed=feed, sezon27=(True if saat.startswith("2027") else None))
            kontrol("D1 %s: ANA SAYFA = sekme-sezon, durum kartı en üstte, seçici yok" % e, sekme(pg) == ["sezon"] and ana(pg) == ["ana"] and not vis(pg, "#seg-v4") and sira(pg)[:1] == ["durum"], (sekme(pg), sira(pg)))
            kontrol("D2 %s: durum = %s" % (e, bmod), mod(pg) == bmod, (mod(pg), pg.evaluate("(document.querySelector('#bg-kok [data-mod]')||{}).outerHTML?.slice(0,90)")))
            if bsira: kontrol("D3 %s: içerik önceliği %s" % (e, "·".join(bsira)), sira(pg) == bsira, sira(pg))
            else: kontrol("D3 %s: sezon arası — puan durumu durum kartının hemen altında, senaryo üstte değil" % e, sira(pg)[:2] == ["durum", "puan"] and "senaryo" not in sira(pg)[:3], sira(pg))
            kontrol("D4 %s: tekrar yok — durum kartındaki ilk 3 listesi ve 'SEZONA GİT' gizli, takvimin SIRADAKİ sayacı gizli" % e, not vis(pg, "#av4-durum .bg-sampiyona") and not vis(pg, "#av4-durum [data-git=sezon]") and not vis(pg, "#av4-takvim .st-p-kart"))
            if bmod == "canli":
                ton = pg.evaluate("(document.querySelector('#bg-kok [data-mod]')||{dataset:{}}).dataset.ton")
                kod = pg.evaluate("(document.querySelector('#bg-kok .bg-kod')||{}).textContent")
                if feed: kontrol("D5 %s: doğrulanmış canlı → kart 'LIVE' (kırmızı ton), menü göstergesi kırmızı" % e, ton == "live" and kod == "LIVE" and "nv4-live" in pg.evaluate("document.getElementById('nv4-durum').className"), (ton, kod))
                else: kontrol("D5 %s: tahmini canlı → kart 'LIVE TAHMİNİ' (kırmızı değil), menü göstergesi amber" % e, ton != "live" and kod == "LIVE TAHMİNİ" and "nv4-tahmin" in pg.evaluate("document.getElementById('nv4-durum').className"), (ton, kod))
                kontrol("D5b %s: kart düğmesi 'YARIŞ HAFTASI' (eski 'HAFTA SONU' adı yok)" % e, "HAFTA SONU" not in pg.inner_text("#av4-durum").upper() and vis(pg, "#av4-durum .bg-btn[data-git]"))
            if bmod in ("canli", "bitti"): kontrol("D6 %s: ayrı SON YARIŞ kartı yok (durum kartı o yarışı anlatıyor)" % e, not vis(pg, "#av4-son"))
            ser = pg.evaluate("[...document.querySelectorAll('#av4-seriler [data-av4-seri]')].map(b=>b.dataset.av4Seri)")
            kontrol("D7 %s: SERİLER yalnız F2·F3 (Formula E / F4 / F1 Academy yok)" % e, ser == ["f2", "f3"], ser)
            kontrol("D8 %s: yatay taşma 0" % e, tasma(pg) == 0, tasma(pg))
            kontrol("D9 %s: konsol / sayfa hatası yok" % e, not errs, errs[:3])
            pg.screenshot(path=OUT + "ana4-%s-%d-%s.png" % (ad, w, tema), full_page=True)
            b.close()

    # ===== I + G) içerik ve geçişler (normal gün) =====
    for w in (390, 1100):
        pg, errs, c, b = ac(p, "2026-10-06T10:00:00Z", w=w)
        k = pg.evaluate("(()=>{const k=document.getElementById('av4-son-kart');return k?{ad:(k.querySelector('.av4-son-ad')||{}).textContent,p:k.querySelectorAll('.av4-pod-s').length,meta:(k.querySelector('.av4-son-meta')||{}).textContent}:null})()")
        kontrol("I1 %d SON YARIŞ: son tamamlanan tur (16) ve 3 kişilik podyum" % w, bool(k) and "16" in k["meta"] and k["p"] == 3 and k["ad"], k)
        kontrol("I2 %d PUAN: pilot ve takım tabloları ana sayfada, mevcut kimliklerle" % w, pg.evaluate("!!document.querySelector('#av4-puan #pilot-govde') && !!document.querySelector('#av4-puan #takim-govde')"))
        if w == 1100: kontrol("I2b 1100 PUAN: iki tablo yan yana", pg.evaluate("(()=>{const a=document.getElementById('av4-puan-p').getBoundingClientRect(),b=document.getElementById('av4-puan-t').getBoundingClientRect();return Math.abs(a.top-b.top)<2&&b.left>a.right})()"))
        else: kontrol("I2b 390 PUAN: alt alta", pg.evaluate("(()=>{const a=document.getElementById('av4-puan-p').getBoundingClientRect(),b=document.getElementById('av4-puan-t').getBoundingClientRect();return b.top>a.bottom-1})()"))
        kontrol("I3 %d SENARYO: başlık + mevcut hesaplayıcı, şampiyonluk açıkken görünür" % w, pg.inner_text("#av4-b-senaryo") == "SENARYO" and vis(pg, "#av4-senaryo #hesap-sonuc"))
        pg.evaluate("window.__sd=SampiyonlukDurumu.mevcut; SampiyonlukDurumu.mevcut=function(){return {durum:'belli',sezon:'2026'}}; AnaV4._durum.senaryo=null; AnaV4.guncelle()"); ilerle(pg, 1)
        kontrol("I4 %d SENARYO: şampiyonluk matematiksel olarak kesinleşince otomatik gizlenir" % w, not vis(pg, "#av4-senaryo"))
        pg.evaluate("SampiyonlukDurumu.mevcut=window.__sd; AnaV4._durum.senaryo=null; AnaV4.guncelle()"); ilerle(pg, 1)
        kontrol("I4b %d SENARYO: yeniden açılınca geri gelir" % w, vis(pg, "#av4-senaryo"))
        if w == 390:
            ge = pg.evaluate("[...document.querySelectorAll('#av4-takvim .st-ay-kart')].filter(b=>b.checkVisibility()).map(b=>b.className)")
            kontrol("I5 390 TAKVİM kısa görünüm: yalnız sıradaki + gelecek yarışlar", len(ge) > 0 and all("gecmis" not in x for x in ge), ge[:4])
            tik(pg, "#av4-takvim-ac", 2)
            ge2 = pg.evaluate("[...document.querySelectorAll('#av4-takvim .st-ay-kart')].filter(b=>b.checkVisibility()).length")
            kontrol("I5b 390 'GEÇMİŞ YARIŞLARI DA GÖSTER' → tüm takvim (%d kart)" % ge2, ge2 > len(ge) and pg.get_attribute("#av4-takvim-ac", "aria-expanded") == "true")
        else:
            kontrol("I5 1100 TAKVİM tam ızgara (kısaltma düğmesi yok)", not vis(pg, "#av4-takvim-ac") and pg.evaluate("[...document.querySelectorAll('#av4-takvim .st-ay-kart')].filter(b=>b.checkVisibility()).length") >= 20)
        kontrol("I6 %d kısa yarış tahmini kutusu ana sayfada değil, PROGRAM'da (Aşama 3)" % w, pg.evaluate("document.getElementById('tp-bugun').closest('[id^=sekme-]').id==='sekme-hafta-v4' && !document.querySelector('#sekme-sezon #tp-bugun')"))
        tik(pg, "#av4-son-kart [data-av4-git=yaris]", 8)
        kontrol("G1 %d SON YARIŞ → ANALİZ › YARIŞ" % w, sekme(pg) == ["yaris"] and ana(pg) == ["analiz"])
        tik(pg, "#rc-bar .rc-sol", 6)
        kontrol("G2 %d logo → ANA SAYFA" % w, sekme(pg) == ["sezon"] and ana(pg) == ["ana"])
        tik(pg, "#av4-seriler [data-av4-seri=f3]", 8)
        akt = pg.evaluate("(document.querySelector('#seri-dugmeleri button.aktif')||{dataset:{}}).dataset.kod")
        kontrol("G3 %d seri kartı F3 → KEŞFET › SERİLER, Formula 3 seçili" % w, sekme(pg) == ["diger"] and ana(pg) == ["kesfet"] and akt == "f3", (sekme(pg), akt))
        tik(pg, "#nv4-ana", 6)
        tik(pg, "#a2-takvim .st-ay-kart.st-ay-siradaki", 8)
        kontrol("G4 %d takvimde sıradaki yarış kartı → YARIŞ HAFTASI" % w, sekme(pg) == ["hafta"] and ana(pg) == ["hafta"], (sekme(pg), ana(pg)))
        kontrol("G5 %d taşma 0, hata yok" % w, tasma(pg) == 0 and not errs, (tasma(pg), errs[:3])); b.close()

    src = open('/home/claude/f1-takip/ana-v4.js', encoding='utf-8').read()
    kontrol("K1 ana-v4.js: fetch / XHR / WebSocket / setInterval / setTimeout / localStorage yazımı YOK", not re.search(r"\bfetch\s*\(|XMLHttpRequest|WebSocket|setInterval|setTimeout|localStorage\.setItem|requestAnimationFrame", src))
print("TOPLAM %d/%d" % (sum(L.SONUC), len(L.SONUC)))
