# F1 TAKİP v4.0 — AŞAMA 3: YARIŞ HAFTASI + HAVA (yalnız ?nav=v4). Katar 2026 yarış haftası (fikstür tur 22: FP1–FP3, Q, R; Losail).
#   M : saf hesap (node testler/hava_v4_yon.js) — rüzgâr okunun coğrafi doğruluğu, WMO kodları, seans saati eşleme
#   V : yayındaki v3 aynen (ek kap yok, kısa tahmin BUGÜN'de, eski hava satırı görünür)
#   P : PROGRAM — alt menü (sprintsiz Katar / sprintli Singapur), ek kap, hava kartı (TAHMİN etiketi, sıcaklık, yağış çubuğu, nem halkası,
#       pist üstünde rüzgâr oku = HavaV4Hesap açısı, seans şeridi TR saatiyle), ölçüm (ÖLÇÜLEN + pist sıcaklığı yalnız ölçümde),
#       tahmin servisi hatası (uydurma yok), nötr seçim rengi, Türkçe etiketler; 390/1100 × koyu/açık, taşma 0, hata 0
#   C : CANLI — doğrulanmış LIVE kırmızı / LIVE TAHMİNİ amber, tek dokunuş, Race Feed + ticker korunur, kısa hava kartı, eski hava satırı gizli
import sys, re, json, subprocess, datetime
import urllib.parse as up
sys.path.insert(0, '.')
from ya_lib import *

OUT = "/tmp/f1-ekran/"
URL = "file:///home/claude/f1-takip/index.html"
KATAR_HS = "2026-11-28T10:00:00Z"      # Katar haftası: FP1–FP2 bitti, FP3 / Q / R gelecek
KATAR_Q = "2026-11-28T18:30:00Z"       # sıralama sürüyor (saate göre)
KATAR_R = "2026-11-29T16:30:00Z"       # yarış sürüyor
SINGAPUR = "2026-10-08T21:00:00Z"      # sprint haftası
def ev(id, ts, cat, tr): return {"id": id, "timestamp": ts, "category": cat, "priority": "high", "textTr": tr, "sourceUrl": "https://x", "sourceName": "Chris Medland", "sourceLevel": "B", "status": "confirmed", "drivers": []}
LV22 = [dict(ev("k0", "2026-11-29T16:02:00Z", "RESTART", "Yarış başladı."), originalText="Lights out in Lusail. The race has started.")]
ENG = ["UPCOMING", "RACE DAY", "FINISHED", "RESULTS PENDING", "POSTPONED", "CANCELLED", "DELAYED", "RED FLAG", "STOPPED", "RESUMED", "RESCHEDULED", "RAIN RISK"]

def om_yanit(u, hata=False):
    if hata: return 500, {"error": True}
    q = dict(up.parse_qsl(up.urlparse(u).query))
    if "start_date" not in q:   # Yarış Günü'nün eski "current" isteği
        return 200, {"current": {"time": "2026-11-28T18:00", "temperature_2m": 24, "precipitation": 0, "weather_code": 1, "wind_speed_10m": 14, "cloud_cover": 20}, "hourly": {"time": ["2026-11-28T18:00", "2026-11-28T19:00", "2026-11-28T20:00"], "precipitation_probability": [5, 5, 10]}}
    a = datetime.date.fromisoformat(q["start_date"]); b = datetime.date.fromisoformat(q["end_date"])
    H = {k: [] for k in ("time", "temperature_2m", "relative_humidity_2m", "precipitation_probability", "weather_code", "wind_speed_10m", "wind_direction_10m", "is_day")}
    d, i = a, 0
    while d <= b:
        for h in range(24):
            H["time"].append("%sT%02d:00" % (d.isoformat(), h)); H["temperature_2m"].append(round(21 + 0.5 * (h % 12), 1)); H["relative_humidity_2m"].append(40 + (i % 9) * 5)
            H["precipitation_probability"].append([0, 10, 30, 60, 85][i % 5]); H["weather_code"].append([0, 2, 3, 61, 95][i % 5]); H["wind_speed_10m"].append(6 + i % 15)
            H["wind_direction_10m"].append((i * 41) % 360); H["is_day"].append(1 if 4 <= h < 15 else 0); i += 1
        d += datetime.timedelta(days=1)
    return 200, {"hourly": H}
def om_rota(hata=False):
    def f(r):
        st, o = om_yanit(r.request.url, hata)
        r.fulfill(status=st, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps(o))
    return f

def sekme(pg): return pg.evaluate("[...document.querySelectorAll('[id^=sekme-]')].filter(e=>!e.hidden).map(e=>e.id.slice(6))")
def ctx(pg): return pg.evaluate("[...document.querySelectorAll('#ctx-v4 button')].map(b=>b.textContent)")
def ctxa(pg): return pg.evaluate("[...document.querySelectorAll('#ctx-v4 [aria-current]')].map(b=>b.dataset.cx4)")
def tasma(pg): return pg.evaluate("document.documentElement.scrollWidth-innerWidth")
def vis(pg, s): return pg.evaluate("(s)=>{const e=document.querySelector(s);return !!e&&e.checkVisibility()}", s)
def tik(pg, s, sn=6): pg.click(s); ilerle(pg, sn)
def ham(pg, kok): return pg.evaluate("([k,E])=>{const r=document.querySelector(k);if(!r)return [];return [...r.querySelectorAll('.bg-kod,.g3-kod,.dr,#a45-et')].filter(e=>e.checkVisibility()).map(e=>e.textContent.trim().toUpperCase()).filter(t=>E.includes(t))}", [kok, ENG])

def ac(p, saat, w=1100, tema="koyu", feed=None, tur=22, v4=True, om_hata=False):
    pg, errs, c, b = yeni(p, saat, w=w, tema=tema)
    pg.route(re.compile(r"api\.open-meteo\.com"), om_rota(om_hata))
    pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2026/(17|22)/(qualifying|sprint|results)"), lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"MRData":{"RaceTable":{"Races":[]}}}'))
    ilerle(pg, 4)
    if feed: pg.evaluate("""([o,t])=>localStorage.setItem('f1-feed-v1-2026-'+t, JSON.stringify({olaylar:o,gorulen:{},enYeniPost:null,motorSurum:RaceFeed.MOTOR_SURUM}))""", [feed, tur])
    pg.evaluate("(t)=>localStorage.setItem('f1-tema',t)", tema)
    pg.goto(URL + ("?nav=v4" if v4 else "")); ilerle(pg, 12)
    return pg, errs, c, b

r = subprocess.run(["node", "hava_v4_yon.js"], capture_output=True, text=True)
for satir in r.stdout.splitlines():
    if satir.startswith(("PASS", "FAIL")): kontrol("M " + satir[5:], satir.startswith("PASS"))
kontrol("M0 saf hesap betiği hatasız bitti", r.returncode == 0, r.stderr[-300:])

with sync_playwright() as p:
    # ===== V) yayın varsayılanı =====
    pg, errs, c, b = ac(p, KATAR_HS, v4=False)
    pg.evaluate("sekmeAc('hafta')"); ilerle(pg, 10)
    kontrol("V1 v3: PROGRAM ek kabı ve yeni hava kartı yok", not pg.evaluate("!!document.getElementById('sekme-hafta-v4') || !!document.querySelector('.hv4')"))
    kontrol("V2 v3: kısa tahmin kutusu BUGÜN'de, a43 kartı yerinde", pg.evaluate("document.getElementById('tp-bugun').closest('[id^=sekme-]').id==='sekme-bugun' && document.getElementById('a43-bilmen').parentElement.tagName==='MAIN' || document.getElementById('a43-bilmen').closest('#sekme-hafta-v4')===null"))
    pg.evaluate("sekmeAc('gun')"); ilerle(pg, 10)
    kontrol("V3 v3: Yarış Günü eski hava satırı görünür (yeni kart yok)", vis(pg, "#gun-hava") and not pg.evaluate("!!document.getElementById('hv4-canli')"))
    kontrol("V4 hata yok", not errs, errs[:3]); b.close()

    # ===== P) PROGRAM (Katar) × genişlik × tema =====
    for w, tema in ((1100, "koyu"), (390, "koyu"), (390, "acik"), (1100, "acik")):
        e = "%d-%s" % (w, tema)
        pg, errs, c, b = ac(p, KATAR_HS, w=w, tema=tema)
        tik(pg, "#nv4-hafta", 12)
        kontrol("P1 %s YARIŞ HAFTASI → PROGRAM + ek kap görünür" % e, sekme(pg) == ["hafta", "hafta-v4"] and ctxa(pg) == ["program"], sekme(pg))
        kontrol("P2 %s Katar (sprintsiz): alt menü PROGRAM·CANLI" % e, ctx(pg) == ["PROGRAM", "CANLI"], ctx(pg))
        kontrol("P3 %s kısa tahmin kutusu PROGRAM'da (ana sayfada değil)" % e, pg.evaluate("document.getElementById('tp-bugun').closest('[id^=sekme-]').id==='sekme-hafta-v4' && !document.querySelector('#sekme-sezon #tp-bugun')"))
        hv = pg.evaluate("""(()=>{const k=document.getElementById('hv4-program');if(!k)return null;
            const bar=k.querySelector('.hv-vitrin .hv-bar'),i=bar&&bar.querySelector('i'),nem=k.querySelector('.hv-vitrin .hv-halka-d');
            return {et:[...k.querySelectorAll('.hv-vitrin .hv-et')].map(x=>x.textContent), sic:(k.querySelector('.hv-sic')||{}).textContent, kos:(k.querySelector('.hv-kos')||{}).textContent,
              bar:bar?bar.getAttribute('aria-valuenow'):null, barW:i?i.style.width:null, nem:!!nem, ik:!!k.querySelector('.hv-vitrin svg.hv-ik'),
              ok:!!k.querySelector('.hv-vitrin svg.hv-pist line.hv-ok'), serit:k.querySelectorAll('.hv-sk').length, saat:[...k.querySelectorAll('.hv-sk-z')].map(x=>x.textContent),
              pist:[...k.querySelectorAll('.hv-m-ad')].some(x=>/PİST SICAKLIĞI/.test(x.textContent)), ses:(k.querySelector('.hv-ses b')||{}).textContent}})()""")
        kontrol("P4 %s hava kartı: vitrin TAHMİN etiketli, sıcaklık °C, koşul adı, ikon" % e, bool(hv) and hv["et"] == ["TAHMİN"] and hv["sic"] and "°C" in hv["sic"] and hv["kos"] and hv["ik"], hv)
        kontrol("P5 %s yağış olasılığı doluluk çubuğu (aria + genişlik eşit) ve nem halkası" % e, bool(hv) and hv["bar"] is not None and hv["barW"] == hv["bar"] + "%" and hv["nem"], hv)
        kontrol("P6 %s sıradaki seans vitrinde (FP3), şerit 5 seans, TR saatleri (FP1 16:30, Q 21:00, R 19:00)" % e, bool(hv) and hv["ses"] == "ANTRENMAN 3" and hv["serit"] == 5 and hv["saat"][0].endswith("16:30") and hv["saat"][3].endswith("21:00") and hv["saat"][4].endswith("19:00"), hv)
        aci = pg.evaluate("""(()=>{const l=document.querySelector('#hv4-program .hv-vitrin line.hv-ok');if(!l)return null;
            const dx=l.x2.baseVal.value-l.x1.baseVal.value, dy=l.y2.baseVal.value-l.y1.baseVal.value, ol=(Math.atan2(dx,-dy)*180/Math.PI+360)%360;
            const h=HaftaV4._durum.son.t.hourly, s=YarisHaftasi._durum.hafta.seanslar.find(x=>x.anahtar==='ThirdPractice'), t=HavaV4Hesap.seansTahmini(h,s.baslangic.getTime());
            return {ol:ol, bek:HavaV4Hesap.ruzgarAci('losail', t.ruzgarYon, PistSiluetleri.YON, PistSiluetleri.YOL), yon:t.ruzgarYon}})()""")
        kontrol("P7 %s rüzgâr oku Losail çizimi üzerinde, açısı hesapla aynı (±0.5°)" % e, bool(aci) and abs(((aci["ol"] - aci["bek"] + 540) % 360) - 180) <= 0.5, aci)
        kontrol("P8 %s ölçüm yokken PİST SICAKLIĞI gösterilmez" % e, bool(hv) and not hv["pist"])
        # ölçüm (OpenF1 özeti önbellekte) → FP1 ÖLÇÜLEN
        pg.evaluate("""(()=>{const asil=SeansHavaVeri.oku; window.__shv=asil; SeansHavaVeri.oku=function(h,s){ if(s.anahtar==='FirstPractice') return {durum:'ok',ozet:{veriVar:true,baslangic:{airTemperature:27.4,trackTemperature:33.1,humidity:48,windSpeed:3.2,windDirection:200,ms:Date.parse('2026-11-27T13:31:00Z')},hava:{min:27.1,max:28.0},pist:{min:31.5,max:33.9},yagis:{olcumVar:true,goruldu:false}}}; return asil.call(this,h,s); };
            HaftaV4._durum.imza={}; HaftaV4._durum.secili='FirstPractice'; HaftaV4.ciz('hv4-program',false);})()"""); ilerle(pg, 1)
        ol = pg.evaluate("""(()=>{const k=document.getElementById('hv4-program');return {et:[...k.querySelectorAll('.hv-vitrin .hv-et')].map(x=>x.textContent), pist:[...k.querySelectorAll('.hv-m')].filter(m=>/PİST SICAKLIĞI/.test(m.textContent)).map(m=>m.querySelector('.hv-m-d').textContent),
            sk:(k.querySelector("[data-hv-sec='FirstPractice'] .hv-sk-k")||{}).textContent, sic:(k.querySelector('.hv-sic')||{}).textContent, yagisBar:!!k.querySelector('.hv-vitrin .hv-bar')}})()""")
        kontrol("P9 %s ölçüm varsa: ÖLÇÜLEN etiketi, pist sıcaklığı 33.1°C, şeritte ÖLÇÜLEN, tahmin yağış çubuğu karıştırılmaz" % e, ol["et"] == ["ÖLÇÜLEN"] and ol["pist"] == ["33.1°C"] and ol["sk"] == "ÖLÇÜLEN" and ol["sic"].startswith("27") and not ol["yagisBar"], ol)
        pg.evaluate("SeansHavaVeri.oku=window.__shv; HaftaV4._durum.secili=null; HaftaV4._durum.imza={}; HaftaV4.ciz('hv4-program',false)"); ilerle(pg, 1)
        tik(pg, "[data-hv-sec='Race']", 1)
        kontrol("P10 %s şeritte YARIŞ'a dokununca vitrin yarışı gösterir (nötr seçim)" % e, pg.inner_text("#hv4-program .hv-ses b") == "YARIŞ" and pg.get_attribute("[data-hv-sec='Race']", "aria-pressed") == "true")
        sec = pg.evaluate("""(()=>{const s=document.querySelector('#sekme-hafta .h-cz.h-sec'),red=getComputedStyle(document.documentElement).getPropertyValue('--vurgu').trim();return s?{b:getComputedStyle(s).borderTopColor}:null})()""")
        kontrol("P11 %s program kutusunda seçili seans çerçevesi kırmızı değil" % e, sec is None or ("225, 6, 0" not in sec["b"] and "212, 22, 28" not in sec["b"]), sec)
        kontrol("P12 %s ham İngilizce durum etiketi yok (program + ana sayfa kartı)" % e, ham(pg, "#sekme-hafta") == [] and pg.evaluate("[...document.querySelectorAll('#bg-kok .bg-kod')].map(e=>e.textContent)").count("UPCOMING") == 0)
        kontrol("P13 %s taşma 0, hata yok" % e, tasma(pg) == 0 and not errs, (tasma(pg), errs[:3]))
        pg.evaluate("HaftaV4._durum.secili=null; HaftaV4._durum.imza={}; HaftaV4.ciz('hv4-program',false); window.scrollTo(0,0)"); ilerle(pg, 1)
        pg.screenshot(path=OUT + "hafta4-katar-%s.png" % e, full_page=True)
        pg.locator("#hf4-hava").screenshot(path=OUT + "hava4-katar-%s.png" % e)
        b.close()

    # tahmin servisi hatası → uydurma yok
    pg, errs, c, b = ac(p, KATAR_HS, om_hata=True); tik(pg, "#nv4-hafta", 12)
    t = pg.inner_text("#hv4-program")
    kontrol("P14 tahmin servisi hatası: açıklama var, sıcaklık/yağış değeri yok", "Tahmin servisine şu an ulaşılamıyor" in t and pg.locator("#hv4-program .hv-sic").count() == 0 and pg.locator("#hv4-program .hv-bar").count() == 0 and "%" not in pg.inner_text("#hv4-program .hv-serit"), t[:300])
    kontrol("P15 hata durumunda konsol hatası yok, taşma 0", not errs and tasma(pg) == 0, errs[:3]); b.close()

    # sprint haftası (Singapur): SPRINT alt menüsü
    pg, errs, c, b = ac(p, SINGAPUR, tur=17); tik(pg, "#nv4-hafta", 12)
    kontrol("P16 Singapur (sprint haftası): PROGRAM·SPRINT·CANLI; şeritte 5 seans (SQ + SPR dahil)", ctx(pg) == ["PROGRAM", "SPRINT", "CANLI"] and pg.locator("#hv4-program .hv-sk").count() == 5 and "SPR" in pg.inner_text("#hv4-program .hv-serit"), ctx(pg))
    kontrol("P17 Singapur ok marina_bay çiziminde", vis(pg, "#hv4-program .hv-vitrin line.hv-ok") or pg.locator("#hv4-program .hv-vitrin .hv-ruz").count() == 1)
    b.close()

    # ===== C) CANLI (Katar) =====
    for w, tema in ((1100, "koyu"), (390, "koyu"), (390, "acik")):
        e = "%d-%s" % (w, tema)
        pg, errs, c, b = ac(p, KATAR_R, w=w, tema=tema, feed=LV22)
        d = pg.evaluate("(()=>{const d=document.getElementById('nv4-durum');return {c:d.className,t:d.textContent,bg:getComputedStyle(d).backgroundColor}})()")
        kontrol("C1 %s Katar yarışı, Race Feed doğruladı: menü göstergesi kırmızı LIVE" % e, "nv4-live" in d["c"] and d["t"] == "LIVE", d)
        tik(pg, "#nv4-hafta", 10)
        kontrol("C2 %s tek dokunuş → CANLI" % e, sekme(pg) == ["gun"] and ctxa(pg) == ["canli"], sekme(pg))
        kc = pg.evaluate("(()=>{const k=document.getElementById('hv4-canli');return k?{v:k.checkVisibility(),et:[...k.querySelectorAll('.hv-et')].map(x=>x.textContent),ses:(k.querySelector('.hv-ses b')||{}).textContent,canli:!!k.querySelector('.hv-canli'),serit:k.querySelectorAll('.hv-sk').length}:null})()")
        kontrol("C3 %s CANLI'da kısa hava kartı: YARIŞ, 'SEANS SÜRÜYOR', TAHMİN etiketi, şerit yok" % e, bool(kc) and kc["v"] and kc["ses"] == "YARIŞ" and kc["canli"] and "TAHMİN" in kc["et"] and kc["serit"] == 0, kc)
        kontrol("C4 %s eski tek satırlık hava gizli, Race Feed görünür" % e, not vis(pg, "#gun-hava") and vis(pg, "#gun-notlar-bolum") and "yarış başladı" in pg.inner_text("#gun-notlar-bolum").lower())
        kontrol("C5 %s ticker canlıda görünür, ham İngilizce etiket yok (CANLI + ticker)" % e, vis(pg, "#a45-git") and ham(pg, "#sekme-gun") == [] and ham(pg, "#rc-bar") == [], (ham(pg, "#sekme-gun"), ham(pg, "#rc-bar")))
        kontrol("C6 %s taşma 0, hata yok" % e, tasma(pg) == 0 and not errs, (tasma(pg), errs[:3]))
        pg.evaluate("window.scrollTo(0,0)"); pg.screenshot(path=OUT + "canli4-katar-%s.png" % e, full_page=True); b.close()
    pg, errs, c, b = ac(p, KATAR_Q)
    d = pg.evaluate("(()=>{const d=document.getElementById('nv4-durum');return {c:d.className,t:d.textContent}})()")
    kontrol("C7 Katar sıralaması, feed yok: amber LIVE TAHMİNİ (kırmızı değil)", "nv4-tahmin" in d["c"] and d["t"] == "LIVE TAHMİNİ", d)
    tik(pg, "#nv4-hafta", 10); tik(pg, "#cx4-program", 10)
    cz = pg.evaluate("(()=>{const e=document.querySelector('#sekme-hafta .h-cz.h-canli');if(!e)return null;const s=getComputedStyle(e);return {live:e.classList.contains('hz-live'),bs:s.borderTopStyle,bc:s.borderTopColor}})()")
    kontrol("C8 PROGRAM'da saate göre sürdüğü düşünülen seans: amber kesik çerçeve (kırmızı değil)", cz is not None and not cz["live"] and cz["bs"] == "dashed" and "225, 6, 0" not in cz["bc"], cz)
    kontrol("C9 hata yok", not errs, errs[:3]); b.close()

    src = open('/home/claude/f1-takip/hafta-v4.js', encoding='utf-8').read()
    kontrol("K1 hafta-v4.js: setInterval / WebSocket / localStorage yazımı / rAF yok; tek ağ çağrısı Open-Meteo", not re.search(r"setInterval|WebSocket|localStorage\.setItem|requestAnimationFrame|EventSource", src) and len(re.findall(r"\bfetch\s*\(", src)) == 1 and "api.open-meteo.com" in src)
    kontrol("K2 hava-v4-hesap.js saf (DOM / ağ yok)", not re.search(r"document\.|fetch\s*\(|localStorage", open('/home/claude/f1-takip/hava-v4-hesap.js', encoding='utf-8').read()))
print("TOPLAM %d/%d" % (sum(L.SONUC), len(L.SONUC)))
