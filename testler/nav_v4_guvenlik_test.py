# F1 TAKİP v4.0 — AŞAMA 0: NAVİGASYON GÜVENLİK AĞI
# Amaç: v4 geçişi boyunca hiçbir özelliğin kaybolmaması ve yayındaki düzenin son aşamaya kadar değişmemesi.
# Kaynak: testler/v4/tasima-haritasi.json (özellik → eski konum → yeni konum).
#   G  : harita bütünlüğü (her ekran ve her sekme-* kimliği haritada; kimlikler benzersiz; her kayıtta yeni konum)
#   Y  : yayın düzeni korunuyor (varsayılan nav v3, 5 ana sekme, önizleme bayrağı olmadan değişiklik yok)
#   E  : her eski ekran sekmeAc() ile açılıyor (1100 ve 390 genişlik)
#   O  : haritadaki her özelliğin DOM bağlantı noktası / modülü mevcut
#   R  : referans ekran görüntüleri (testler/v4/referans/, JPEG) — yalnız REFERANS=1 ile yazılır
# Taşıma aşamalarında: 'yeni_*' alanları güncellenir, kayıt silinmez; Y bölümü yalnız Aşama 6'da (varsayılan geçiş) güncellenir.
import sys, os, json, re
sys.path.insert(0, '.')
from ya_lib import *

NOW = "2026-10-06T10:00:00Z"
KOK = "/home/claude/f1-takip/"
H = json.load(open(KOK + "testler/v4/tasima-haritasi.json", encoding="utf-8"))
OZ = H["ozellikler"]
EKRANLAR = ["bugun", "sezon", "hafta", "sprint", "gun", "yaris", "grafik", "profil", "sampiyonlar", "diger"]
REF = os.environ.get("REFERANS") == "1"
REF_DIR = KOK + "testler/v4/referans/"

# ---- G) harita bütünlüğü (ağsız)
html = open(KOK + "index.html", encoding="utf-8").read()
sekme_idleri = sorted(set(re.findall(r'id="sekme-([a-z0-9]+)"', html)))
idler = [o["id"] for o in OZ]
kontrol("G1 özellik kimlikleri benzersiz", len(idler) == len(set(idler)), [i for i in idler if idler.count(i) > 1])
kontrol("G2 index.html'deki her sekme-* ekranı haritada", sorted(EKRANLAR) == sekme_idleri, (sekme_idleri, EKRANLAR))
haritada = set(o["eski_ekran"] for o in OZ)
kontrol("G3 her ekranın en az bir özelliği haritada", all(e in haritada for e in EKRANLAR), [e for e in EKRANLAR if e not in haritada])
kontrol("G4 her kaydın yeni konumu yazılı", all(o.get("yeni_yol") for o in OZ), [o["id"] for o in OZ if not o.get("yeni_yol")])
kontrol("G5 her kaydın bir denetim noktası var (seçici veya modül)", all(o.get("secici") or o.get("kuresel") for o in OZ), [o["id"] for o in OZ if not (o.get("secici") or o.get("kuresel"))])
kontrol("G6 haritada en az 45 özellik", len(OZ) >= 45, len(OZ))
yerel_js = sorted(set(re.findall(r'src="([a-z0-9-]+\.js)\?v=', html)))
kontrol("G7 index.html en az 90 yerel JS yüklüyor (modül kaybı yok)", len(yerel_js) >= 90, len(yerel_js))

def ekran_ac(pg, ad):
    pg.evaluate("(a)=>{ if(a==='sprint'){ const b=document.getElementById('btn-sprint'); if(b) b.hidden=false; } sekmeAc(a); }", ad)
    ilerle(pg, 10)
    return pg.evaluate("(a)=>{const e=document.getElementById('sekme-'+a);return !!e&&!e.hidden}", ad)

def ozellik_var(pg, o):
    s = o.get("secici"); k = o.get("kuresel"); ok = True
    if s: ok = ok and pg.evaluate("(s)=>!!document.querySelector(s)", s)
    if k: ok = ok and pg.evaluate("(k)=>{try{return typeof eval(k)!=='undefined'}catch(e){return false}}", k)
    return ok

with sync_playwright() as p:
    for gen in (1100, 390):
        pg, errs, c, b = yeni(p, NOW, w=gen, tema="koyu"); ilerle(pg, 8)
        if gen == 1100:
            # ---- Y) yayın düzeni korunuyor
            kontrol("Y1 varsayılan düzen v3 (yayın değişmedi)", pg.evaluate("document.documentElement.getAttribute('data-nav')") == "v3")
            kontrol("Y2 ana menü 5 sekme, aynı sıra", pg.evaluate("[...document.querySelectorAll('#nav-v3 button')].map(b=>b.id)") == ["nav-bugun", "nav-haftasonu", "nav-sezon", "nav-analiz", "nav-kesfet"])
            kontrol("Y3 sürüm etiketi ile sw.js sürümü eşleşiyor", (lambda v: ('F1-TAKIP-v%s-PWA1' % v) in open(KOK + "sw.js", encoding="utf-8").read())(pg.evaluate("document.querySelector('meta[name=app-version]').content")))
            kontrol("Y4 v4 önizlemesi varsayılan olarak KAPALI (data-v4 yok, v4 menüsü görünmüyor)", pg.evaluate("!document.documentElement.hasAttribute('data-v4') && !document.querySelector('[data-nav=v4]') && !(document.getElementById('nav-v4')||{checkVisibility:()=>false}).checkVisibility()"))
        # ---- E + O) her ekran açılır, her özellik yerinde
        acilmayan = [a for a in EKRANLAR if not ekran_ac(pg, a)]
        kontrol("E1 %d: tüm eski ekranlar sekmeAc ile açılıyor" % gen, not acilmayan, acilmayan)
        eksik = []
        for a in EKRANLAR:
            ekran_ac(pg, a)
            for o in OZ:
                if o["eski_ekran"] == a and not ozellik_var(pg, o): eksik.append(o["id"])
        for o in OZ:
            if o["eski_ekran"] == "kuresel" and not ozellik_var(pg, o): eksik.append(o["id"])
        kontrol("O1 %d: haritadaki %d özelliğin tamamı yerinde" % (gen, len(OZ)), not eksik, eksik)
        if gen == 1100:
            # ---- E2) v3 menüsünden her alt sekme doğru ekrana gidiyor (yayın yolları)
            yol = {"nav-haftasonu": "hafta", "nav-sezon": "sezon", "nav-analiz": "yaris", "nav-kesfet": "profil"}
            yanlis = []
            for btn, hedef in yol.items():
                pg.click("#" + btn); ilerle(pg, 6)
                g = pg.evaluate("[...document.querySelectorAll('[id^=sekme-]')].filter(e=>!e.hidden).map(e=>e.id)")
                if g != ["sekme-" + hedef]: yanlis.append((btn, g))
            for ctx, hedef in (("ctx-grafik", "grafik"), ("ctx-yaris", "yaris")):
                pg.click("#nav-analiz"); ilerle(pg, 4); pg.click("#" + ctx); ilerle(pg, 6)
                g = pg.evaluate("[...document.querySelectorAll('[id^=sekme-]')].filter(e=>!e.hidden).map(e=>e.id)")
                if g != ["sekme-" + hedef]: yanlis.append((ctx, g))
            for ctx, hedef in (("ctx-sampiyonlar", "sampiyonlar"), ("ctx-diger", "diger"), ("ctx-profil", "profil")):
                pg.click("#nav-kesfet"); ilerle(pg, 4); pg.click("#" + ctx); ilerle(pg, 6)
                g = pg.evaluate("[...document.querySelectorAll('[id^=sekme-]')].filter(e=>!e.hidden).map(e=>e.id)")
                if g != ["sekme-" + hedef]: yanlis.append((ctx, g))
            kontrol("E2 menü ve alt menü yolları doğru ekrana gidiyor", not yanlis, yanlis)
        kontrol("H%d konsol / sayfa hatası yok" % gen, not errs, errs[:3])
        # ---- R) referans görüntüler
        if REF:
            os.makedirs(REF_DIR, exist_ok=True)
            for tema in ("koyu", "acik"):
                if gen == 1100 and tema == "acik": continue
                pg.evaluate("(t)=>{document.documentElement.setAttribute('data-tema',t); try{localStorage.setItem('f1-tema',t)}catch(e){}}", tema); ilerle(pg, 2)
                for a in EKRANLAR:
                    ekran_ac(pg, a); pg.evaluate("window.scrollTo(0,0)"); ilerle(pg, 2)
                    pg.screenshot(path=REF_DIR + "%s-%d-%s.jpg" % (a, gen, tema), full_page=True, type="jpeg", quality=55)
            kontrol("R%d referans görüntüler yazıldı" % gen, len([f for f in os.listdir(REF_DIR) if ("-%d-" % gen) in f]) >= len(EKRANLAR))
        b.close()

n_ok = sum(L.SONUC); print("TOPLAM %d/%d" % (n_ok, len(L.SONUC)))
