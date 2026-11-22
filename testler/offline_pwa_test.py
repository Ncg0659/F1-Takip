# Offline / PWA: SW cache adı = sürüm, precache = index.html'in yerel dosyaları, eski cache temizliği, API/dış kaynak cache'te yok,
# çevrimdışı açılış, Chart.js (CDN) yüklenemezse grafik yerine açıklama ve JS hatası yok.
import http.server, functools, threading, re, os, sys
from playwright.sync_api import sync_playwright
SITE=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),".."))
SONUC=[]
def kontrol(ad,ok,det=""):
    SONUC.append(bool(ok)); print(("PASS " if ok else "FAIL ")+ad+("" if ok else " | "+str(det)[:300]))
html=open(os.path.join(SITE,"index.html"),encoding="utf-8").read(); sw=open(os.path.join(SITE,"sw.js"),encoding="utf-8").read()
SURUM=re.search(r'<meta name="app-version" content="([\d.]+)"',html).group(1)
CACHE=re.search(r'VERSION = "([^"]+)"',sw).group(1)
yerel=sorted(set(r for r in re.findall(r'(?:src|href)="([^"#]+)"',html) if not re.match(r'(https?:|data:|mailto:)',r)))
pre=re.findall(r'^\s*"\./([^"]*)",?$',sw,re.M)
kontrol("V1 SW cache adı sürümle aynı (%s ↔ %s)"%(SURUM,CACHE), CACHE=="F1-TAKIP-v%s-PWA1"%SURUM)
kontrol("V2 index.html'deki her yerel dosya precache'te", all(r.lstrip("./") in pre for r in yerel), [r for r in yerel if r.lstrip("./") not in pre])
kontrol("V3 precache'teki her dosya diskte var, ?v= etiketleri sürümle aynı", all(os.path.exists(os.path.join(SITE,p.split("?")[0])) for p in pre if p) and all(p.endswith("?v="+SURUM) for p in pre if re.search(r"\.(js|css)\?",p)))
kontrol("V4 precache'te API/dış kaynak yok", not any(("http" in p) or ("api" in p.lower()) for p in pre))
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(H,directory=SITE)); PORT=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
with sync_playwright() as p:
    b=p.chromium.launch(); cx=b.new_context(viewport={"width":390,"height":844})
    dis=[]
    def ag(r):
        u=r.request.url; dis.append(u)
        if "cdnjs" in u or "chart" in u.lower(): return r.abort()                      # CDN erişilemez (çevrimdışı benzetimi)
        return r.fulfill(status=200,content_type="application/json",headers={"access-control-allow-origin":"*"},body='{"MRData":{"RaceTable":{"Races":[]},"StandingsTable":{"StandingsLists":[]}}}')
    cx.route(re.compile(r"^https?://(?!127\.0\.0\.1).*"),ag)
    pg=cx.new_page(); hata=[]; kons=[]
    pg.on("pageerror",lambda e:hata.append(str(e))); pg.on("console",lambda m: kons.append(m.text) if m.type=="error" else None)
    pg.goto(f"http://127.0.0.1:{PORT}/index.html")
    pg.evaluate("caches.open('F1-TAKIP-v0.0.1-ESKI').then(c=>c.put('/eski', new Response('x')))")
    for _ in range(80):
        if pg.evaluate("navigator.serviceWorker.controller ? 1 : 0"): break
        pg.wait_for_timeout(250)
    pg.wait_for_timeout(1500)
    r=pg.evaluate("""async()=>{const ks=await caches.keys();const c=await caches.open('%s');const k=(await c.keys()).map(x=>x.url);
      return {ks:ks,n:k.length,dis:k.filter(u=>!u.startsWith(location.origin)).length}}"""%CACHE)
    kontrol("O1 SW kuruldu, yalnız güncel cache var (eski cache silindi)", r["ks"]==[CACHE], r["ks"])
    kontrol("O2 tüm precache dosyaları cache'te (%d), dış kaynak yok"%len([x for x in pre if x]), r["n"]>=len([x for x in pre if x]) and r["dis"]==0, r)
    pg.evaluate("sekmeAc('grafik')"); pg.wait_for_timeout(2500)
    gd=pg.evaluate("(document.getElementById('grafik-durum')||{}).textContent||''")
    kontrol("O3 Chart.js yüklenemedi: grafik yerine açıklama", "yüklenemedi" in gd, gd)
    kontrol("O4 JS hatası yok (Chart is not defined yok)", not hata, hata)
    cx.set_offline(True)
    pg.reload(); pg.wait_for_timeout(3000)
    d=pg.evaluate("[document.querySelector('meta[name=app-version]').content, !!document.querySelector('#nav-bugun'), !!window.TahminArsiv, !!window.GhostLap, !!window.MotionV2]")
    kontrol("O5 çevrimdışı yeniden açılış: kabuk + yerel modüller önbellekten", d==[SURUM,True,True,True,True], d)
    pg.evaluate("sekmeAc('grafik')"); pg.wait_for_timeout(1500)
    kontrol("O6 çevrimdışı: JS hatası yok", not hata, hata)
    ag_hata=[k for k in kons if not re.search(r"Failed to load resource|net::ERR|ERR_INTERNET_DISCONNECTED|ERR_FAILED",k)]
    print("  bilgi: konsoldaki ağ (kaynak yüklenemedi) iletileri:", len(kons)-len(ag_hata))
    kontrol("O7 konsolda ağ dışı hata iletisi yok", not ag_hata, ag_hata[:3])
    b.close()
srv.shutdown()
print("\nTOPLAM %d/%d"%(sum(SONUC),len(SONUC)))
