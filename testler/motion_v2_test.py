import json, re, sys, threading, http.server, functools, time
from playwright.sync_api import sync_playwright

SITE = "/home/claude/f1-takip"
PORT = 8765
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE)
class Q(http.server.ThreadingHTTPServer): pass
srv = Q(("127.0.0.1", PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

def yaris(r, cid, ad, tarih, ulke, sehir):
    return {"season": "2026", "round": str(r), "raceName": ad, "date": tarih, "time": "13:00:00Z",
            "Circuit": {"circuitId": cid, "circuitName": ad + " Circuit", "Location": {"lat": "0", "long": "0", "locality": sehir, "country": ulke}}}
RACES = [yaris(1, "americas", "United States Grand Prix", "2026-10-18", "USA", "Austin"),
         yaris(2, "monaco", "Monaco Grand Prix", "2026-11-01", "Monaco", "Monte-Carlo"),
         yaris(3, "suzuka", "Japanese Grand Prix", "2026-11-22", "Japan", "Suzuka"),
         yaris(4, "baku", "Azerbaijan Grand Prix", "2026-12-06", "Azerbaijan", "Baku")]
def pilot(poz, did, kod, ad, soy, puan, takim):
    return {"position": str(poz), "points": str(puan), "wins": "1" if poz == 1 else "0",
            "Driver": {"driverId": did, "code": kod, "givenName": ad, "familyName": soy, "permanentNumber": str(poz), "nationality": "X", "dateOfBirth": "1997-01-01"},
            "Constructors": [{"constructorId": takim, "name": takim.title(), "nationality": "X"}]}
DS = [pilot(1, "norris", "NOR", "Lando", "Norris", 50, "mclaren"), pilot(2, "verstappen", "VER", "Max", "Verstappen", 43, "red_bull"),
      pilot(3, "piastri", "PIA", "Oscar", "Piastri", 40, "mclaren"), pilot(4, "leclerc", "LEC", "Charles", "Leclerc", 30, "ferrari")]
CS = [{"position": "1", "points": "90", "wins": "2", "Constructor": {"constructorId": "mclaren", "name": "McLaren", "nationality": "British"}},
      {"position": "2", "points": "43", "wins": "0", "Constructor": {"constructorId": "red_bull", "name": "Red Bull", "nationality": "Austrian"}},
      {"position": "3", "points": "30", "wins": "0", "Constructor": {"constructorId": "ferrari", "name": "Ferrari", "nationality": "Italian"}}]

def jolpica(route):
    u = route.request.url
    if "driverstandings" in u:
        b = {"StandingsTable": {"StandingsLists": [{"season": "2026", "round": "2", "DriverStandings": DS}]}}
    elif "constructorstandings" in u:
        b = {"StandingsTable": {"StandingsLists": [{"season": "2026", "round": "2", "ConstructorStandings": CS}]}}
    elif re.search(r"/\d{4}/races/?", u):
        b = {"RaceTable": {"season": "2026", "Races": RACES}}
    else:
        b = {"RaceTable": {"Races": []}, "StandingsTable": {"StandingsLists": []}, "total": "0"}
    b.update({"limit": "30", "offset": "0", "total": b.get("total", "1")})
    route.fulfill(status=200, content_type="application/json", body=json.dumps({"MRData": b}))

def calistir(pw, reduced=False, onceki=None):
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = br.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce" if reduced else "no-preference", service_workers="block")
    hatalar = []
    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1).*"), lambda r: r.abort())
    ctx.route("https://api.jolpi.ca/**", jolpica)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: hatalar.append("PAGEERROR " + str(e)))
    pg.on("console", lambda m: hatalar.append("CONSOLE " + m.text) if m.type == "error" and "net::ERR_FAILED" not in m.text and "Failed to load resource" not in m.text else None)
    if onceki:
        pg.add_init_script("try{ if(!sessionStorage.getItem('x')){ localStorage.setItem('f1-mo2-sira', %s); sessionStorage.setItem('x','1'); } }catch(e){}" % json.dumps(json.dumps(onceki)))
    pg.goto(f"http://127.0.0.1:{PORT}/index.html")
    return br, pg, hatalar

def sonuc(ad, ok, detay=""):
    print(("PASS " if ok else "FAIL ") + ad + (" — " + detay if detay else ""))
    return ok

with sync_playwright() as pw:
    tum = True
    # ---- 1) normal açılış ----
    br, pg, hat = calistir(pw)
    isik_var = pg.evaluate("!!document.querySelector('.mo2-isik')")
    tum &= sonuc("Giriş: start ışıkları açılışta görünüyor", isik_var)
    pg.wait_for_timeout(1500)
    k = pg.evaluate("[...document.querySelectorAll('.mo2-isik-sira i')].filter(i=>getComputedStyle(i).backgroundColor==='rgb(225, 6, 0)').length")
    tum &= sonuc("Giriş: 1.5 sn'de ışıklar SIRAYLA yanıyor (2-3 yanık, hepsi değil)", 2 <= k <= 3, str(k))
    pg.wait_for_timeout(1250)
    k = pg.evaluate("[...document.querySelectorAll('.mo2-isik-sira i')].filter(i=>getComputedStyle(i).backgroundColor==='rgb(225, 6, 0)').length")
    tum &= sonuc("Giriş: veri gelmiş olsa da 5 ışığın tamamı yanana kadar ekran kapalı (2.75 sn)", k == 5 and pg.evaluate("!!document.querySelector('.mo2-isik')"), str(k))
    pg.wait_for_timeout(1900)
    y = pg.evaluate("(()=>{const m=document.querySelector('.mo2-marka'), o=document.querySelector('.mo2-isik'); return o&&m ? [m.textContent, getComputedStyle(o).opacity, m.getBoundingClientRect().width>60] : null})()")
    tum &= sonuc("Giriş: ışıklardan sonra 'F1 TAKİP' kinetik yazı (4.65 sn, ekran hâlâ kapalı)", bool(y) and y[0] == "F1TAKİP" and y[1] == "1" and y[2], str(y))
    pg.wait_for_timeout(1700)
    tum &= sonuc("Giriş: ~5.8 sn sonunda kendiliğinden kalktı (≤6.4 sn)", pg.evaluate("!document.querySelector('.mo2-isik')"))
    tum &= sonuc("Giriş: sürekli animasyon bırakmadı", pg.evaluate("document.getAnimations().filter(a=>a.animationName&&/^mo2-(yan|son|cizgi|kalk|kel|cik|sira)/.test(a.animationName)).length") == 0)
    pg.evaluate("document.getElementById('btn-bugun') ? 0 : 0")
    # BUGÜN sekmesine geç (nav) → pist durumu
    pg.evaluate("sekmeAc('bugun')")
    pg.wait_for_timeout(150)
    info = pg.evaluate("""() => { const p=document.querySelector('#sekme-bugun .bg-hat'); if(!p) return null;
        return {cls:p.getAttribute('class'), pl:p.getAttribute('pathLength'), nokta: !!p.ownerSVGElement.querySelector('.mo2-nokta')}; }""")
    print("  bugun pist:", info)
    tum &= sonuc("BUGÜN pisti bulundu", info is not None)
    if info:
        tum &= sonuc("Pist çizim animasyonu başladı (mo-ciz)", "mo-ciz-" in info["cls"] and "mo2-p-bekle" not in info["cls"], info["cls"])
        dur = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('#sekme-bugun .bg-hat')).animationDuration)")
        tum &= sonuc("Pist çizimi yavaş ve okunur (2.4 sn)", abs(dur - 2.4) < 0.01, str(dur))
        pg.wait_for_timeout(2700)
        n = pg.evaluate("!!document.querySelector('#sekme-bugun .mo2-nokta')")
        tum &= sonuc("Çizimden sonra tur noktası eklendi", n)
        OLC = """() => { const c=document.querySelector('#sekme-bugun .mo2-nokta'); if(!c) return null; const p=document.querySelector('#sekme-bugun .bg-hat');
            const m=new DOMMatrix(getComputedStyle(c).transform), L=p.getTotalLength(); let en=1e9, yer=0;
            for(let i=0;i<=2000;i++){ const q=p.getPointAtLength(L*i/2000), d=Math.hypot(q.x-m.m41,q.y-m.m42); if(d<en){en=d;yer=i/2000;} }
            return {uzak:en, yer:yer, smil: c.querySelectorAll('animateMotion').length, sure: c.getAnimations()[0] ? c.getAnimations()[0].effect.getTiming().duration : null}; }"""
        pg.wait_for_timeout(600); o1 = pg.evaluate(OLC); pg.wait_for_timeout(1200); o2 = pg.evaluate(OLC)
        print("  nokta:", o1, o2)
        tum &= sonuc("Nokta pist çizgisinin ÜSTÜNDE (sapma < 1.5 birim, iki ölçüm)", bool(o1 and o2) and o1["uzak"] < 1.5 and o2["uzak"] < 1.5, str((o1, o2)))
        tum &= sonuc("Nokta pist boyunca İLERLİYOR (sabit kalmıyor)", bool(o1 and o2) and o2["yer"] - o1["yer"] > 0.15, str((o1 and o1["yer"], o2 and o2["yer"])))
        tum &= sonuc("Nokta turu 5.2 sn; SMIL/animateMotion yok", bool(o1) and o1["sure"] == 5200 and o1["smil"] == 0, str(o1))
        pg.wait_for_timeout(3900)
        tum &= sonuc("Tur noktası sonra kendini kaldırdı", pg.evaluate("!document.querySelector('#sekme-bugun .mo2-nokta')"))
        # sekme değiştir ve geri dön → yeniden çizim
        pg.evaluate("sekmeAc('sezon')"); pg.wait_for_timeout(300); pg.evaluate("sekmeAc('bugun')"); pg.wait_for_timeout(120)
        c2 = pg.evaluate("document.querySelector('#sekme-bugun .bg-hat').getAttribute('class')")
        tum &= sonuc("Sekmeye tekrar girince pist yeniden çiziliyor", "mo-ciz-" in c2, c2)
    # Sezon sekmesi: ilk kullanımda rozet yok
    pg.evaluate("sekmeAc('sezon')"); pg.wait_for_timeout(400)
    rz = pg.evaluate("document.querySelectorAll('#pilot-govde .mo2-rozet').length")
    tum &= sonuc("İlk kullanımda ▲▼ rozeti yok (karşılaştıracak kayıt yok)", rz == 0, str(rz))
    kayit = pg.evaluate("localStorage.getItem('f1-mo2-sira')")
    tum &= sonuc("Sıralama cihazda kaydedildi", bool(kayit) and "norris" in kayit)
    # Sezon takvimi (st-p) pist var mı
    st = pg.evaluate("document.querySelectorAll('#sekme-sezon .st-p-hat').length")
    print("  sezon st-p-hat sayısı:", st)
    # Lastik şeridi + grafik: sentetik DOM ile MotionV2 tetiklemesi
    syn = pg.evaluate("""async () => {
        const sec=document.getElementById('sekme-sezon');
        const d=document.createElement('div'); d.innerHTML="<div class='a34b-serit'><i class='a34b-soft' style='flex:20 1 0'></i><i class='a34b-hard' style='flex:30 1 0'></i></div>";
        sec.prepend(d);
        const g=document.createElement('div'); g.id='testg';
        g.innerHTML="<svg class='sg-svg' viewBox='0 0 300 100' width='300' height='100'><g class='sg-seri' data-id='a'><path class='sg-cizgi' d='M10,90 L290,10' style='stroke:red'/><circle class='sg-nokta' cx='10' cy='90' r='2'/></g><g class='sg-seri sg-soluk' data-id='b'><path class='sg-cizgi' d='M10,50 L290,50' stroke-dasharray='7 4'/></g><text class='sg-uc' x='5' y='5'>A</text></svg>";
        sec.prepend(g);
        await new Promise(r=>setTimeout(r,300));
        return { serit: d.firstChild.getAttribute('class'), svg: g.firstChild.getAttribute('class'),
                 duz: g.querySelector('.sg-cizgi').getAttribute('class'), kesik: g.querySelectorAll('.sg-cizgi')[1].getAttribute('class') };
    }""")
    print("  sentetik:", syn)
    tum &= sonuc("Lastik şeridi dolum animasyonu aldı", "mo2-s-a" in syn["serit"])
    tum &= sonuc("Grafik çizim animasyonu aldı", "mo2-g-a" in syn["svg"] and "mo2-duz" in syn["duz"] and "mo2-kesik" in syn["kesik"])
    pg.wait_for_timeout(1300)
    op = pg.evaluate("getComputedStyle(document.querySelector('#testg .sg-soluk')).opacity")
    print("  soluk seri opaklığı (animasyon sonrası):", op)
    tum &= sonuc("Hata yok (konsol/pageerror)", not hat, "; ".join(hat[:5]))
    pg.screenshot(path="/tmp/s1_sezon.png", full_page=False)
    br.close()

    # ---- 2) önceki sıralama varken ▲▼ ----
    onceki = {"p": {"sezon": "2026", "simdi": {"imza": "eski", "poz": {"verstappen": 1, "norris": 2, "piastri": 3, "leclerc": 4}}}}
    br, pg, hat = calistir(pw, onceki=onceki)
    pg.wait_for_timeout(600); pg.mouse.click(195, 400); pg.wait_for_timeout(700)
    tum &= sonuc("Giriş: dokununca atlanıyor", pg.evaluate("!document.querySelector('.mo2-isik')"))
    pg.wait_for_timeout(1200)
    pg.evaluate("sekmeAc('sezon')"); pg.wait_for_timeout(300)
    pg.evaluate("document.getElementById('pilot-govde').scrollIntoView({block:'center'})"); pg.wait_for_timeout(500)   # kaydırma animasyonu tablo GÖRÜNÜNCE oynar (3.0.9: SEZON başında şampiyonluk manşeti → tablo ilk ekranda değil)
    rz = pg.evaluate("Array.from(document.querySelectorAll('#pilot-govde .mo2-rozet')).map(x=>x.textContent)")
    kay = pg.evaluate("Array.from(document.querySelectorAll('#pilot-govde tr')).map(t=>t.getAttribute('class')||'')")
    print("  rozetler:", rz, " satır sınıfları:", kay)
    tum &= sonuc("Yeni sıralamada ▲1 / ▼1 rozetleri", rz == ["▲1", "▼1"], str(rz))
    tum &= sonuc("Değişen satırlar kaydı", any("mo2-kay" in k for k in kay))
    tum &= sonuc("Hata yok (2. senaryo)", not hat, "; ".join(hat[:5]))
    pg.evaluate("document.querySelector('#pilot-govde').scrollIntoView({block:'center'})"); pg.wait_for_timeout(800)
    pg.screenshot(path="/tmp/s2_rozet.png")
    br.close()

    # ---- 3) reduced motion ----
    br, pg, hat = calistir(pw, reduced=True, onceki=onceki)
    t0 = pg.evaluate("!!document.querySelector('.mo2-isik')")
    pg.wait_for_timeout(2000); pg.evaluate("sekmeAc('bugun')"); pg.wait_for_timeout(200)
    c = pg.evaluate("(document.querySelector('#sekme-bugun .bg-hat')||{getAttribute:()=>'yok'}).getAttribute('class')")
    pg.evaluate("sekmeAc('sezon')"); pg.wait_for_timeout(300)
    rz = pg.evaluate("document.querySelectorAll('#pilot-govde .mo2-rozet').length")
    tum &= sonuc("Hareketi Azalt: start ışıkları yok", not t0)
    tum &= sonuc("Hareketi Azalt: pist animasyonsuz", "mo2" not in c and "mo-ciz" not in c, c)
    tum &= sonuc("Hareketi Azalt: ▲▼ rozeti (bilgi) yine görünür", rz == 2, str(rz))
    tum &= sonuc("Hata yok (3. senaryo)", not hat, "; ".join(hat[:5]))
    br.close()
    print("\nTOPLAM:", "HEPSİ GEÇTİ" if tum else "HATA VAR")
srv.shutdown()
