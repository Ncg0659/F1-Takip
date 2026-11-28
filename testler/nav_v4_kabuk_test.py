# F1 TAKİP v4.0 — AŞAMA 1: NAVİGASYON KABUĞU (gizli önizleme ?nav=v4)
#   V : yayındaki v3 varsayılan kalıyor; önizleme açılıp kapanıyor (geri dönüş)
#   N : 4 ana sekme, alt menüler, geçiş seçicisi, logo, alt sekme hafızası, harici çağrılar (arama, takvim Detay, sekmeAc)
#       — 390 / 1100 px × koyu / açık; her adımda taşma 0
#   S : sprint hafta sonu (SPRINT var) ↔ normal hafta sonu (SPRINT yok)
#   C : canlı seans: Race Feed doğrulamalı LIVE (kırmızı) ↔ LIVE TAHMİNİ (amber, kırmızı değil); tek dokunuş CANLI; ticker
#   E : 10 eski ekranın hepsine v4 menüsünden yalnız tıklamayla ulaşılıyor
import sys, re
sys.path.insert(0, '.')
from ya_lib import *

OUT = "/tmp/f1-ekran/"
URL = "file:///home/claude/f1-takip/index.html"
NORMAL = "2026-10-06T10:00:00Z"      # tur 17 (Singapur, SPRINT) haftası öncesi, canlı yok
NORMAL_HS = "2026-10-20T10:00:00Z"   # tur 18 (sprintsiz) haftası
CANLI = "2026-10-11T12:30:00Z"       # tur 17 yarışı sürüyor
def ev(id, ts, cat, tr): return {"id": id, "timestamp": ts, "category": cat, "priority": "high", "textTr": tr, "sourceUrl": "https://x", "sourceName": "Chris Medland", "sourceLevel": "B", "status": "confirmed", "drivers": []}
LV = [dict(ev("r0", "2026-10-11T12:02:00Z", "RESTART", "Yarış başladı."), originalText="Lights out and away we go. The race has started.")]

def sekme(pg): return pg.evaluate("[...document.querySelectorAll('[id^=sekme-]')].filter(e=>!e.hidden).map(e=>e.id.slice(6))")
def ana(pg): return pg.evaluate("[...document.querySelectorAll('#nav-v4 [aria-current]')].map(b=>b.dataset.nv4)")
def ctx(pg): return pg.evaluate("[...document.querySelectorAll('#ctx-v4 button')].map(b=>b.textContent)")
def ctxa(pg): return pg.evaluate("[...document.querySelectorAll('#ctx-v4 [aria-current]')].map(b=>b.dataset.cx4)")
def seg(pg): return pg.evaluate("(()=>{const g=document.getElementById('seg-v4');if(!g||g.hidden)return null;return [...g.querySelectorAll('button')].map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?'*':''))})()")
def tasma(pg): return pg.evaluate("document.documentElement.scrollWidth-innerWidth")
def vis(pg, s): return pg.evaluate("(s)=>{const e=document.querySelector(s);return !!e&&e.checkVisibility()}", s)
def tik(pg, s, sn=6): pg.click(s); ilerle(pg, sn)

def onizleme(p, saat, w=1100, tema="koyu", feed=None):
    pg, errs, c, b = yeni(p, saat, w=w, tema=tema)
    pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2026/17/(qualifying|sprint|results)"), lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"MRData":{"RaceTable":{"Races":[]}}}'))
    ilerle(pg, 4)
    if feed: pg.evaluate("""(o)=>localStorage.setItem('f1-feed-v1-2026-17', JSON.stringify({olaylar:o,gorulen:{},enYeniPost:null,motorSurum:RaceFeed.MOTOR_SURUM}))""", feed)
    pg.evaluate("(t)=>localStorage.setItem('f1-tema',t)", tema)
    pg.goto(URL + "?nav=v4"); ilerle(pg, 10)
    return pg, errs, c, b

with sync_playwright() as p:
    # ===== V) yayın varsayılanı + açma / kapama =====
    pg, errs, c, b = yeni(p, NORMAL); ilerle(pg, 8)
    kontrol("V1 varsayılan: data-v4 yok, v3 menüsü görünür, v4 menüsü yok", pg.evaluate("!document.documentElement.hasAttribute('data-v4')") and vis(pg, "#nav-v3") and not vis(pg, "#nav-v4"))
    kontrol("V2 varsayılan: v3 5 sekme aynen", pg.evaluate("[...document.querySelectorAll('#nav-v3 button')].map(b=>b.id)") == ["nav-bugun", "nav-haftasonu", "nav-sezon", "nav-analiz", "nav-kesfet"])
    kontrol("V3 varsayılan: logo tıklanabilir yapılmadı, önizleme etiketi yok", pg.evaluate("!document.querySelector('[data-nv4-logo]') && !document.getElementById('nv4-onizleme')"))
    pg.goto(URL + "?nav=v4"); ilerle(pg, 10)
    kontrol("V4 ?nav=v4 → önizleme açık; v3 menüsü gizli, v4 görünür", pg.evaluate("document.documentElement.dataset.v4") == "1" and vis(pg, "#nav-v4") and not vis(pg, "#nav-v3"))
    pg.goto(URL); ilerle(pg, 8)
    kontrol("V5 önizleme kalıcı (adres parametresiz yeniden açılışta)", pg.evaluate("document.documentElement.dataset.v4") == "1")
    tik(pg, "#nv4-onizleme", 8)
    kontrol("V6 'ÇIK' → yayındaki v3 görünümüne geri dönüş; bayrak silindi", pg.evaluate("!document.documentElement.hasAttribute('data-v4') && localStorage.getItem('f1-nav4')===null") and vis(pg, "#nav-v3"))
    pg.goto(URL + "?nav=off"); ilerle(pg, 6); pg.goto(URL + "?nav=v4"); ilerle(pg, 8)
    kontrol("V7 eski geliştirici geri dönüşü (?nav=off) sonrası ?nav=v4 yine açılır", pg.evaluate("document.documentElement.dataset.v4") == "1" and vis(pg, "#nav-v4"))
    pg.goto(URL + "?nav=off"); ilerle(pg, 6)
    kontrol("V8 ?nav=off → v4 de kapanır", pg.evaluate("!document.documentElement.hasAttribute('data-v4')"))
    kontrol("V9 hata yok", not errs, errs[:3]); b.close()

    # ===== N) gezinme: 390/1100 × koyu/açık =====
    gezilen = set()
    for w, tema in ((1100, "koyu"), (390, "koyu"), (390, "acik"), (1100, "acik")):
        e = "%d-%s" % (w, tema); T = []
        pg, errs, c, b = onizleme(p, NORMAL, w=w, tema=tema)
        T.append(tasma(pg))
        kontrol("N1 %s 4 ana sekme sıralı" % e, pg.evaluate("[...document.querySelectorAll('#nav-v4 button')].map(b=>b.getAttribute('aria-label'))") == ["ANA SAYFA", "YARIŞ HAFTASI", "ANALİZ", "KEŞFET"])
        kontrol("N2 %s açılış: ANA SAYFA aktif, ana sayfa (sekme-sezon + durum kartı), geçiş seçicisi YOK (Aşama 2)" % e, ana(pg) == ["ana"] and sekme(pg) == ["sezon"] and seg(pg) is None and pg.evaluate("!!document.querySelector('#sekme-sezon #bg-kok')"), (ana(pg), sekme(pg), seg(pg)))
        gezilen.update(["bugun", "sezon"])
        if w == 390:
            r = pg.evaluate("(()=>{const n=document.getElementById('nav-v4').getBoundingClientRect();return {b:Math.round(innerHeight-n.bottom),h:n.height,pos:getComputedStyle(document.getElementById('nav-v4')).position}})()")
            kontrol("N3 %s mobil: ana menü ekranın altına sabit (tek el), yükseklik ≥ 56" % e, r["pos"] == "fixed" and r["b"] == 0 and r["h"] >= 56, r)
            hd = pg.evaluate("(()=>{const r=document.getElementById('nv4-hafta').getBoundingClientRect();return r.width>=80&&r.height>=56})()")
            kontrol("N3b %s mobil: dokunma alanı ≥ 80×56" % e, hd)
            kontrol("N3c %s mobil: etiket 'YARIŞ HAFTASI' görünür" % e, "YARIŞ HAFTASI" in pg.inner_text("#nv4-hafta"))
        else:
            kontrol("N3 %s masaüstü: ana menü akışta (sabit değil)" % e, pg.evaluate("getComputedStyle(document.getElementById('nav-v4')).position") != "fixed")
        st = pg.evaluate("""(()=>{const a=getComputedStyle(document.querySelector('#nav-v4 [aria-current]')),p=getComputedStyle(document.querySelector('#nav-v4 button:not([aria-current])'));
            const red=getComputedStyle(document.documentElement).getPropertyValue('--vurgu').trim();
            return {ac:a.color,pc:p.color,ab:a.borderBottomColor,aft:getComputedStyle(document.querySelector('#nav-v4 [aria-current]'),'::after').backgroundColor,red:red}})()""")
        kontrol("N4 %s aktif sekme pasiften farklı renkte" % e, st["ac"] != st["pc"], st)
        kontrol("N4b %s aktif gösterge kırmızı değil (kırmızı yalnız LIVE)" % e, "225, 6, 0" not in st["ab"] + st["aft"] and "212, 22, 28" not in st["ab"] + st["aft"], st)
        pg.evaluate("sekmeAc('bugun')"); ilerle(pg, 6)
        kontrol("N5 %s v4'te sekmeAc('bugun') → ana sayfaya yönlenir (ayrı BUGÜN ekranı yok)" % e, sekme(pg) == ["sezon"] and ana(pg) == ["ana"], (sekme(pg), ana(pg)))
        T.append(tasma(pg))
        if not pg.locator("#a2-takvim button[data-pist]:visible").count():     # v4: SIRADAKİ kartı gizli → "Ayrıntılı yarışlar" açılır
            pg.locator("#a2-takvim details > summary").first.click(); ilerle(pg, 3)
        pp = pg.locator("#a2-takvim button[data-pist]:visible").first
        if pp.count():
            pp.click(); ilerle(pg, 6)
            kontrol("N6 %s takvim pist kısayolu pist profilini açar (masaüstü panel / mobil kart içi — v3 ile aynı)" % e, pg.evaluate("!!document.querySelector('#dp-panel[open]') || [...document.querySelectorAll('#a2-takvim button[data-pist]')].some(b=>b.getAttribute('aria-expanded')==='true')"))
            pg.keyboard.press("Escape"); ilerle(pg, 3)
        else:   # mobil v4: takvimin pist düğmesi yalnız gizlenen SIRADAKİ kartındaydı → pist profili ANALİZ › PİSTLER'den açılır
            pg.click("#nv4-analiz"); ilerle(pg, 6); pg.click("#cx4-pistler"); ilerle(pg, 6)
            pg.locator("#pist-govde button[data-pist]:visible").first.click(); ilerle(pg, 4)
            kontrol("N6 %s pist profili ANALİZ › PİSTLER'den açılıyor (mobil takvimde SIRADAKİ kartı gizli)" % e, pg.evaluate("!!document.querySelector('#dp-panel[open]') || [...document.querySelectorAll('#pist-govde button[data-pist]')].some(b=>b.getAttribute('aria-expanded')==='true')"))
            tik(pg, "#nv4-ana", 6)
        sg = pg.locator("#a2-takvim .st-git[data-git=hafta]:visible, #a2-takvim .st-ay-kart.st-ay-siradaki").first
        if sg.count():
            sg.click(); ilerle(pg, 8)
            kontrol("N6b %s takvim kısayolu (sıradaki yarış) → PROGRAM, v4 vurgusu YARIŞ HAFTASI" % e, sekme(pg) == ["hafta"] and ana(pg) == ["hafta"] and ctxa(pg) == ["program"], (sekme(pg), ana(pg), ctxa(pg)))
            tik(pg, "#nv4-ana", 6)
        else:
            kontrol("N6b %s takvimde 'Yarış Haftası'na git' kısayolu var" % e, False)
        # YARIŞ HAFTASI
        tik(pg, "#nv4-hafta", 8)
        kontrol("N7 %s YARIŞ HAFTASI → PROGRAM (sekme-hafta)" % e, sekme(pg) == ["hafta"] and ana(pg) == ["hafta"] and ctxa(pg) == ["program"], (sekme(pg), ctxa(pg)))
        kontrol("N8 %s alt menü PROGRAM·SPRINT·CANLI (sprint haftası)" % e, ctx(pg) == ["PROGRAM", "SPRINT", "CANLI"], ctx(pg))
        gezilen.add("hafta"); T.append(tasma(pg))
        tik(pg, "#cx4-sprint", 8); kontrol("N9 %s SPRINT → sekme-sprint" % e, sekme(pg) == ["sprint"] and ctxa(pg) == ["sprint"]); gezilen.add("sprint")
        tik(pg, "#cx4-canli", 8); kontrol("N10 %s CANLI → sekme-gun" % e, sekme(pg) == ["gun"] and ctxa(pg) == ["canli"] and ana(pg) == ["hafta"]); gezilen.add("gun"); T.append(tasma(pg))
        kontrol("N10b %s canlı seans yokken durum göstergesi gizli" % e, not vis(pg, "#nv4-durum"))
        # ANALİZ
        tik(pg, "#nv4-analiz", 8)
        tp = pg.evaluate("(()=>{const t=document.getElementById('tp-analiz');return !!t&&!t.hidden&&!!t.firstElementChild})()")
        bek = ["YARIŞ", "PİLOTLAR & TAKIMLAR", "PİSTLER", "GRAFİKLER"] + (["TAHMİN"] if tp else [])
        kontrol("N11 %s ANALİZ → YARIŞ; alt menü %s" % (e, "/".join(bek)), sekme(pg) == ["yaris"] and ana(pg) == ["analiz"] and ctx(pg) == bek and ctxa(pg) == ["yaris"], (sekme(pg), ctx(pg)))
        gezilen.add("yaris"); T.append(tasma(pg))
        tik(pg, "#cx4-pilotlar", 8)
        kontrol("N12 %s PİLOTLAR & TAKIMLAR → sekme-profil, seçici PROFİLLER·ŞAMPİYONLAR" % e, sekme(pg) == ["profil"] and ctxa(pg) == ["pilotlar"] and seg(pg) == ["PROFİLLER*", "ŞAMPİYONLAR"], (sekme(pg), seg(pg)))
        gezilen.add("profil")
        tik(pg, "#sg4-sampiyonlar", 8)
        kontrol("N13 %s ŞAMPİYONLAR → arşiv; ANALİZ ve PİLOTLAR & TAKIMLAR aktif kalır" % e, sekme(pg) == ["sampiyonlar"] and ana(pg) == ["analiz"] and ctxa(pg) == ["pilotlar"] and seg(pg) == ["PROFİLLER", "ŞAMPİYONLAR*"], (sekme(pg), ctxa(pg), seg(pg)))
        gezilen.add("sampiyonlar"); T.append(tasma(pg))
        tik(pg, "#cx4-pistler", 8)
        py = pg.evaluate("(()=>{const h=[...document.querySelectorAll('#sekme-profil h2')].find(x=>/pistleri/i.test(x.textContent));return h?Math.round(h.getBoundingClientRect().top):null})()")
        kontrol("N14 %s PİSTLER → sekme-profil, 'Sezonun pistleri' görünür alana kaydırıldı, seçici yok" % e, sekme(pg) == ["profil"] and ctxa(pg) == ["pistler"] and py is not None and -5 <= py < 400 and seg(pg) is None, (sekme(pg), ctxa(pg), py, seg(pg)))
        tik(pg, "#cx4-grafikler", 8)
        kontrol("N15 %s GRAFİKLER → sekme-grafik" % e, sekme(pg) == ["grafik"] and ctxa(pg) == ["grafikler"]); gezilen.add("grafik"); T.append(tasma(pg))
        if tp:
            tik(pg, "#cx4-tahmin", 8); kontrol("N15b %s TAHMİN → tahmin paneli" % e, sekme(pg) == ["grafik"] and ctxa(pg) == ["tahmin"])
        # KEŞFET
        tik(pg, "#nv4-kesfet", 8)
        kontrol("N16 %s KEŞFET → SERİLER (sekme-diger), alt menü ÖĞREN·SERİLER" % e, sekme(pg) == ["diger"] and ana(pg) == ["kesfet"] and ctx(pg) == ["ÖĞREN", "SERİLER"] and ctxa(pg) == ["seriler"], (sekme(pg), ctx(pg)))
        gezilen.add("diger"); T.append(tasma(pg))
        tik(pg, "#cx4-ogren", 4)
        kontrol("N17 %s ÖĞREN → sözlük paneli açılır, ekran değişmez" % e, sekme(pg) == ["diger"] and pg.evaluate("!!document.querySelector('#a2-dlg[open]')"))
        pg.keyboard.press("Escape"); ilerle(pg, 3)
        # hafıza + logo
        tik(pg, "#nv4-hafta", 8)
        kontrol("N18 %s YARIŞ HAFTASI son alt sekmeyi (CANLI) hatırlar" % e, sekme(pg) == ["gun"] and ctxa(pg) == ["canli"], (sekme(pg), ctxa(pg)))
        tik(pg, "#rc-bar .rc-sol", 6)
        kontrol("N19 %s F1 TAKİP logosu → ANA SAYFA" % e, sekme(pg) == ["sezon"] and ana(pg) == ["ana"])
        pg.focus("#rc-bar .rc-sol"); pg.evaluate("sekmeAc('yaris')"); ilerle(pg, 4); pg.focus("#rc-bar .rc-sol"); pg.keyboard.press("Enter"); ilerle(pg, 6)
        kontrol("N19b %s logo klavyeyle (Enter) de çalışır" % e, sekme(pg) == ["sezon"])
        # harici çağrılar
        pg.evaluate("sekmeAc('grafik')"); ilerle(pg, 6)
        kontrol("N20 %s harici sekmeAc('grafik') → ANALİZ/GRAFİKLER vurgusu" % e, ana(pg) == ["analiz"] and ctxa(pg) == ["grafikler"], (ana(pg), ctxa(pg)))
        if vis(pg, "#btn-ara"):
            tik(pg, "#btn-ara", 4); pg.fill("#ar-girdi", "şampiyonlar"); ilerle(pg, 4); pg.keyboard.press("Enter"); ilerle(pg, 8)
            kontrol("N21 %s global arama 'şampiyonlar' → arşiv, v4 vurgusu ANALİZ" % e, sekme(pg) == ["sampiyonlar"] and ana(pg) == ["analiz"], (sekme(pg), ana(pg)))
        else:
            kontrol("N21 %s arama düğmesi görünür" % e, False)
        kontrol("N22 %s yatay taşma 0 (gezilen tüm ekranlarda)" % e, max(T) == 0, T)
        kontrol("N23 %s konsol / sayfa hatası yok" % e, not errs, errs[:3])
        if w == 390: pg.evaluate("sekmeAc('sezon')"); ilerle(pg, 4); pg.screenshot(path=OUT + "nav4-%s.png" % e)
        b.close()
    kontrol("E1 10 eski ekranın hepsine v4 menüsünden ulaşıldı (BUGÜN özeti ana sayfanın içinde)", sorted(gezilen) == sorted(["bugun", "sezon", "hafta", "sprint", "gun", "yaris", "profil", "sampiyonlar", "grafik", "diger"]), sorted(gezilen))

    # ===== S) normal (sprintsiz) hafta sonu =====
    for w in (390, 1100):
        pg, errs, c, b = onizleme(p, NORMAL_HS, w=w)
        tik(pg, "#nv4-hafta", 8)
        kontrol("S1 %d normal hafta sonu: alt menü PROGRAM·CANLI (SPRINT yok)" % w, ctx(pg) == ["PROGRAM", "CANLI"], ctx(pg))
        pg.evaluate("document.getElementById('btn-sprint').hidden=false"); ilerle(pg, 2)
        kontrol("S2 %d sprint görünür olunca SPRINT eklenir; gizlenince kalkar" % w, "SPRINT" in ctx(pg) and (pg.evaluate("document.getElementById('btn-sprint').hidden=true") or True) and (ilerle(pg, 2) or True) and "SPRINT" not in ctx(pg), ctx(pg))
        kontrol("S3 %d taşma 0, hata yok" % w, tasma(pg) == 0 and not errs, (tasma(pg), errs[:2])); b.close()

    # ===== C) canlı seans =====
    for w, tema in ((1100, "koyu"), (390, "koyu"), (390, "acik")):
        e = "%d-%s" % (w, tema)
        pg, errs, c, b = onizleme(p, CANLI, w=w, tema=tema, feed=LV)
        d = pg.evaluate("(()=>{const d=document.getElementById('nv4-durum');const s=getComputedStyle(d);return {v:d.checkVisibility(),cls:d.className,t:d.textContent,bg:s.backgroundColor,lbl:document.getElementById('nv4-hafta').getAttribute('aria-label')}})()")
        kontrol("C1 %s doğrulanmış LIVE: kırmızı gösterge, metin LIVE, erişilebilir etiket" % e, d["v"] and "nv4-live" in d["cls"] and d["t"] == "LIVE" and ("225, 6, 0" in d["bg"] or "212, 22, 28" in d["bg"]) and "doğruladı" in d["lbl"], d)
        tik(pg, "#nv4-hafta", 8)
        kontrol("C2 %s canlıyken YARIŞ HAFTASI tek dokunuş → CANLI (sekme-gun)" % e, sekme(pg) == ["gun"] and ctxa(pg) == ["canli"], (sekme(pg), ctxa(pg)))
        if w == 390: pg.screenshot(path=OUT + "nav4-canli-%s.png" % e)
        tik(pg, "#nv4-ana", 6)
        if vis(pg, "#a45-git"):
            tik(pg, "#a45-git", 8); kontrol("C3 %s ticker → CANLI, v4 vurgusu YARIŞ HAFTASI/CANLI" % e, sekme(pg) == ["gun"] and ana(pg) == ["hafta"] and ctxa(pg) == ["canli"], (sekme(pg), ana(pg)))
        else:
            kontrol("C3 %s ticker canlı seansta görünür" % e, False)
        kontrol("C4 %s taşma 0, hata yok" % e, tasma(pg) == 0 and not errs, (tasma(pg), errs[:2])); b.close()
        pg, errs, c, b = onizleme(p, CANLI, w=w, tema=tema, feed=None)
        d = pg.evaluate("(()=>{const d=document.getElementById('nv4-durum');const s=getComputedStyle(d);return {v:d.checkVisibility(),cls:d.className,t:d.textContent,bg:s.backgroundColor,c:s.color,lbl:document.getElementById('nv4-hafta').getAttribute('aria-label')}})()")
        kontrol("C5 %s doğrulanmamış: amber LIVE TAHMİNİ, kırmızı DEĞİL" % e, d["v"] and "nv4-tahmin" in d["cls"] and d["t"] == "LIVE TAHMİNİ" and "225, 6, 0" not in d["bg"] + d["c"] and "212, 22, 28" not in d["bg"] + d["c"] and "tahmini" in d["lbl"], d)
        tik(pg, "#nv4-hafta", 8)
        kontrol("C6 %s tahmini canlıda da tek dokunuş → CANLI" % e, sekme(pg) == ["gun"])
        if w == 390 and tema == "koyu": pg.screenshot(path=OUT + "nav4-tahmin-%s.png" % e)
        kontrol("C7 %s taşma 0, hata yok" % e, tasma(pg) == 0 and not errs, (tasma(pg), errs[:2])); b.close()

    src = open('/home/claude/f1-takip/nav-v4.js', encoding='utf-8').read()
    kontrol("K1 nav-v4.js: fetch / XHR / WebSocket / setInterval / setTimeout / localStorage yazımı YOK", not re.search(r"\bfetch\s*\(|XMLHttpRequest|WebSocket|setInterval|setTimeout|localStorage\.setItem|requestAnimationFrame", src))
print("TOPLAM %d/%d" % (sum(L.SONUC), len(L.SONUC)))
