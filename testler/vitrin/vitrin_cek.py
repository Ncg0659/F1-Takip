# README vitrin görselleri: GERÇEK uygulama (bu repo) + GERÇEK veri (F1DB, CC BY 4.0) ile ekran görüntüleri.
# Kullanım: python3 testler/vitrin/vitrin_cek.py <f1db/src/data> <çıktı klasörü> [ISO saat]
# OpenF1 / Race Feed / hava durumu gibi canlı kaynaklar burada YOK (boş döner); uygulama kendi "veri yok" durumunu gösterir. Veri uydurulmaz.
import sys, os, re, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jolpica_f1db import Jolpica
from playwright.sync_api import sync_playwright
SITE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
J = Jolpica(sys.argv[1]); OUT = sys.argv[2]; SAAT = sys.argv[3] if len(sys.argv) > 3 else "2026-11-22T20:30:00Z"
os.makedirs(OUT, exist_ok=True)
H = {"access-control-allow-origin": "*"}
def rota(r):
    u = r.request.url
    if u.startswith("file:"): return r.continue_()
    if "api.jolpi.ca" in u: return r.fulfill(status=200, content_type="application/json", headers=H, body=json.dumps(J.yanit(u)))
    if "cdnjs" in u or "jsdelivr" in u or "unpkg" in u: return r.continue_() if os.environ.get("CDN") else r.abort()
    return r.fulfill(status=200, content_type="application/json", headers=H, body="[]")
def ac(p, w, h, tema="koyu", dpr=2):
    b = p.chromium.launch(); cx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr, locale="tr-TR", timezone_id="Europe/Istanbul")
    cx.add_init_script("try{sessionStorage.setItem('f1-mo2-isik','1');localStorage.setItem('f1-tema','%s');localStorage.setItem('f1-ogren-v2-goruldu','1')}catch(e){}" % tema)
    cx.route("**/*", rota); pg = cx.new_page(); err = []; pg.on("pageerror", lambda e: err.append(str(e)))
    pg.clock.install(time=SAAT); pg.goto("file://" + SITE + "/index.html")
    return b, pg, err
def bekle(pg, sn):
    for _ in range(int(sn)): pg.clock.run_for(1000); pg.wait_for_timeout(60)
if __name__ == "__main__":
    with sync_playwright() as p:
        b, pg, err = ac(p, 390, 844); bekle(pg, 20)
        for t in ("bugun", "haftasonu", "sezon", "analiz", "kesfet"):
            pg.click("#nav-" + t); bekle(pg, 12); pg.screenshot(path=os.path.join(OUT, "_ham_%s.png" % t), full_page=True)
        print("hata:", err[:3]); print("bilinmeyen uç nokta:", sorted(set(u for k, u in J.log if k == "bilinmeyen"))[:20]); b.close()
