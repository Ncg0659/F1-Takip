# README görselleri + demo GIF üretir (docs/media/). GERÇEK uygulama + GERÇEK veri:
#   • Jolpica uç noktaları F1DB'den (CC BY 4.0) öykünülür (jolpica_f1db.py) — sezon 2026, saat: Las Vegas GP sonrası.
#   • Ghost Lap: gerçek OpenF1 verisi (Singapur 2023, oturum 9161, RUS #63 – PIA #81; testler/ghost/real) ile Ghost Lap bileşeni.
#   • Race Feed / OpenF1 canlı / hava durumu bu ortamda YOK → uygulama kendi boş durumunu gösterir. Veri uydurulmaz.
# Kullanım: python3 testler/vitrin/vitrin_uret.py <f1db/src/data>     (gerekenler: playwright chromium, ffmpeg, Pillow)
import sys, os, json, gzip, re, shutil, subprocess, tempfile, urllib.parse
from datetime import datetime
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from jolpica_f1db import Jolpica
from playwright.sync_api import sync_playwright
from PIL import Image
SITE = os.path.abspath(os.path.join(HERE, "..", "..")); MEDIA = os.path.join(SITE, "docs", "media"); os.makedirs(MEDIA, exist_ok=True)
J = Jolpica(sys.argv[1]); SAAT = "2026-11-22T20:30:00Z"
H = {"access-control-allow-origin": "*"}; TMP = tempfile.mkdtemp(prefix="vitrin-")

def rota(r):
    u = r.request.url
    if u.startswith("file:"): return r.continue_()
    if "api.jolpi.ca" in u: return r.fulfill(status=200, content_type="application/json", headers=H, body=json.dumps(J.yanit(u)))
    if "cdnjs" in u: return r.abort()
    return r.fulfill(status=200, content_type="application/json", headers=H, body="[]")
def site(p, w, h, intro=False, dpr=2):
    b = p.chromium.launch(); cx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr, locale="tr-TR", timezone_id="Europe/Istanbul", color_scheme="dark")
    cx.add_init_script("try{%slocalStorage.setItem('f1-ogren-v2-goruldu','1');localStorage.setItem('f1-tema','koyu')}catch(e){}" % ("" if intro else "sessionStorage.setItem('f1-mo2-isik','1');"))
    cx.route("**/*", rota); pg = cx.new_page(); err = []; pg.on("pageerror", lambda e: err.append(str(e)))
    pg.clock.install(time=SAAT); pg.goto("file://" + SITE + "/index.html"); return b, pg, err
def bekle(pg, sn):
    for _ in range(int(sn)): pg.clock.run_for(1000); pg.wait_for_timeout(60)
def png(kaynak, hedef, genislik=None, renk=256):
    im = Image.open(kaynak).convert("RGB")
    if genislik and im.width > genislik: im = im.resize((genislik, round(im.height * genislik / im.width)), Image.LANCZOS)
    im.quantize(colors=renk, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(hedef, optimize=True)
    print("  ", os.path.basename(hedef), im.size, os.path.getsize(hedef) // 1024, "KB")

# ---- Ghost Lap (gerçek OpenF1) ----
GD = os.path.join(SITE, "testler", "ghost"); G = lambda n: json.load(gzip.open(os.path.join(GD, "real", n + ".json.gz")))
F = {"laps": {63: G("laps_63"), 81: G("laps_81")}, "car_data": {63: G("car_63"), 81: G("car_81")}, "location": {63: G("loc_63"), 81: G("loc_81")}}
def ghost_rota(rt):
    u = urllib.parse.unquote(rt.request.url)
    if not u.startswith(("http://", "https://")): return rt.continue_()
    if "api.openf1.org" not in u: return rt.abort()
    yol = u.split("/v1/")[1]; ep, _, q = yol.partition("?"); Q = dict(x.split("=", 1) for x in q.split("&") if "=" in x)
    cev = lambda o, st=200: rt.fulfill(status=st, content_type="application/json", headers=H, body=json.dumps(o))
    dn = int(Q.get("driver_number", "0"))
    if Q.get("session_key") != "9161" or dn not in (63, 81): return cev([], 404)
    if ep == "laps": return cev(F["laps"][dn])
    if ep in ("car_data", "location"):
        m = re.search(r"date>=([^&]+)&date<=([^&]+)", q); P = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
        a, b = P(m.group(1)), P(m.group(2)); return cev([x for x in F[ep][dn] if a <= P(x["date"]) <= b])
    return cev([], 404)
def ghost(p, w, h, dpr=2):
    b = p.chromium.launch(); pg = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr).new_page()
    pg.route("**/*", ghost_rota); pg.goto("file://" + GD + "/harness_real.html"); pg.evaluate("__ac()")
    pg.click("#gl-ghost > summary"); pg.select_option("[data-gl='A']", "63"); pg.select_option("[data-gl='B']", "81"); pg.wait_for_timeout(1500)
    return b, pg

with sync_playwright() as p:
    print("ekran görüntüleri")
    b, pg, err = site(p, 390, 844); bekle(pg, 20)
    pg.screenshot(path=TMP + "/bugun.png"); png(TMP + "/bugun.png", MEDIA + "/bugun-mobil.png", 780)
    pg.click("#nav-sezon"); bekle(pg, 12); pg.screenshot(path=TMP + "/sezon.png"); png(TMP + "/sezon.png", MEDIA + "/sezon-mobil.png", 780)
    assert not err, err; b.close()
    b, pg, err = site(p, 1280, 900); bekle(pg, 20)
    pg.evaluate("sekmeAc('grafik')"); bekle(pg, 16)
    tp = pg.locator("#tp-panel"); bb = tp.bounding_box()
    pg.screenshot(path=TMP + "/tahmin.png", clip={"x": bb["x"], "y": bb["y"], "width": bb["width"], "height": min(bb["height"], 560)}, full_page=True)
    png(TMP + "/tahmin.png", MEDIA + "/tahmin-masaustu.png", 1600)
    kart = pg.locator(".a3-kart").filter(has_text="Şampiyona puan gelişimi").first; kart.scroll_into_view_if_needed(); kart.screenshot(path=TMP + "/analiz.png")
    png(TMP + "/analiz.png", MEDIA + "/analiz-puan-gelisimi.png", 1600)
    assert not err, err; b.close()
    b, gp = ghost(p, 1100, 900); gp.evaluate("GhostLap._kaydir(45000)"); gp.wait_for_timeout(400)
    gp.locator("#gl-ghost").screenshot(path=TMP + "/ghost.png"); png(TMP + "/ghost.png", MEDIA + "/ghost-lap.png", 1600); b.close()

    print("demo GIF kareleri (390 px mobil)")
    kare = []; KD = os.path.join(TMP, "k"); os.makedirs(KD)
    def cek(pg, tekrar=1):
        yol = os.path.join(KD, "%04d.png" % len(kare)); pg.screenshot(path=yol)
        for _ in range(tekrar): kare.append(yol)
    b, pg, err = site(p, 390, 844, intro=True, dpr=1)
    for _ in range(26): cek(pg); pg.wait_for_timeout(180)             # giriş: ışıklar → F1 TAKİP (~5–6 sn gerçek zaman)
    for _ in range(40):
        if not pg.locator(".mo2-isik").count(): break
        pg.wait_for_timeout(150)
    bekle(pg, 18); cek(pg, 16)                                         # BUGÜN: yarış tamamlandı + podyum
    pg.click("#nav-sezon"); bekle(pg, 10); cek(pg, 14)                  # SEZON: sıradaki yarış + geri sayım
    pg.evaluate("sekmeAc('grafik')"); bekle(pg, 16)
    pg.evaluate("document.getElementById('tp-panel').scrollIntoView({block:'start'}); scrollBy(0,-70)"); cek(pg, 14)   # ANALİZ: yarış tahmini
    k = pg.locator(".a3-kart").filter(has_text="Şampiyona puan gelişimi").first; k.scroll_into_view_if_needed(); pg.evaluate("scrollBy(0,-60)"); cek(pg, 14)
    assert not err, err; b.close()
    b, gp = ghost(p, 390, 844, dpr=1); gp.evaluate("document.querySelector('[data-gl-pist]').scrollIntoView({block:'center'})")
    for t in range(0, 92000, 4600): gp.evaluate("GhostLap._kaydir(%d)" % t); gp.wait_for_timeout(60); cek(gp)
    cek(gp, 6); b.close()
    gif = os.path.join(MEDIA, "f1-takip-demo.gif"); liste = os.path.join(TMP, "liste.txt")
    with open(liste, "w") as f:
        for k in kare: f.write("file '%s'\nduration 0.125\n" % k)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", liste, "-vf",
                    "fps=8,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
                    "-loop", "0", gif], check=True)
    print("  f1-takip-demo.gif", len(kare), "kare,", round(len(kare) / 8, 1), "sn,", os.path.getsize(gif) // 1024, "KB")
shutil.rmtree(TMP, ignore_errors=True)
