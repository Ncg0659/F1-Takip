# sw_gecis_test — Service Worker sürüm geçişi: ESKİ sürüm (git ref, varsayılan origin/main) → bu çalışma kopyası.
# Gerçek tarayıcı + gerçek SW, yerel HTTP sunucusu; dış ağ kesik. Çekirdek pakette değil (git geçmişine bağlı):
#   python3 testler/sw_gecis_test.py [eski_ref]
import http.server, functools, threading, subprocess, tempfile, os, re, sys, time
from playwright.sync_api import sync_playwright
SITE=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),".."))
REF=sys.argv[1] if len(sys.argv)>1 else "origin/main"
SONUC=[]
def kontrol(ad,ok,det=""):
    SONUC.append(bool(ok)); print(("PASS " if ok else "FAIL ")+ad+("" if ok else "  | "+str(det)[:300]))
ESKI=tempfile.mkdtemp(prefix="sw-eski-")
subprocess.run("git archive %s | tar -x -C %s"%(REF,ESKI),shell=True,cwd=SITE,check=True)
surum=lambda d: re.search(r'<meta name="app-version" content="([^"]+)"',open(os.path.join(d,"index.html"),encoding="utf-8").read()).group(1)
swv=lambda d: re.search(r'var VERSION = "([^"]+)"',open(os.path.join(d,"sw.js"),encoding="utf-8").read()).group(1)
ES, YS, ESW, YSW = surum(ESKI), surum(SITE), swv(ESKI), swv(SITE)
print("eski:",REF,ES,ESW," yeni:",YS,YSW)
KOK={"d":ESKI}
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
    def translate_path(self,path):
        p=path.split("?",1)[0].split("#",1)[0]
        return os.path.join(KOK["d"],p.lstrip("/"))
    def end_headers(self):
        self.send_header("Cache-Control","no-cache"); super().end_headers()
srv=http.server.ThreadingHTTPServer(("127.0.0.1",0),H); PORT=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
URL="http://127.0.0.1:%d/index.html"%PORT
def bekle(pg,js,sn=20):
    t=time.time()
    while time.time()-t<sn:
        try:
            if pg.evaluate(js): return True
        except Exception: pass
        pg.wait_for_timeout(250)
    return False
with sync_playwright() as p:
    b=p.chromium.launch(); cx=b.new_context(viewport={"width":390,"height":844},service_workers="allow")
    cx.add_init_script("try{sessionStorage.setItem('f1-mo2-isik','1')}catch(e){}")
    cx.route(re.compile(r"^https?://(?!127\.0\.0\.1).*"),lambda r: r.abort())
    hata=[]; pg=cx.new_page(); pg.on("pageerror",lambda e: hata.append(str(e)))
    pg.goto(URL)
    kontrol("E1 eski sürüm (%s) yüklendi, SW sayfayı kontrol ediyor"%ES, bekle(pg,"!!navigator.serviceWorker.controller") and pg.evaluate("document.querySelector('meta[name=app-version]').content")==ES)
    kontrol("E2 eski önbellek kuruldu (%s)"%ESW, bekle(pg,"caches.keys().then(k=>k.includes('%s'))"%ESW))
    KOK["d"]=SITE                                                       # sunucu artık yeni sürümü veriyor (GitHub Pages yayını gibi)
    pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r&&r.update())")
    kontrol("Y1 yeni SW kuruldu ve eski önbellek silindi (yalnız %s)"%YSW, bekle(pg,"caches.keys().then(k=>k.filter(x=>x.startsWith('F1-TAKIP-')).join()==='%s')"%YSW,30), pg.evaluate("caches.keys()"))
    kontrol("Y2 yeni SW etkin (skipWaiting + clients.claim)", bekle(pg,"navigator.serviceWorker.controller && navigator.serviceWorker.controller.state==='activated'"))
    pg.reload(); pg.wait_for_timeout(1500)
    kontrol("Y3 yeniden açılışta app-version %s"%YS, pg.evaluate("document.querySelector('meta[name=app-version]').content")==YS)
    v=pg.evaluate("[...document.scripts].map(s=>s.getAttribute('src')||'').filter(s=>/^yaris-hikaye/.test(s))")
    kontrol("Y4 Yarışın Hikâyesi dosyaları yeni etiketle yüklendi (?v=%s)"%YS, v and all(x.endswith("?v="+YS) for x in v), v)
    kontrol("Y5 yeni kod çalışıyor (sıra titremesi filtresi mevcut)", pg.evaluate("typeof YarisHikaye==='object' && typeof YarisHikaye._gecicileriAt==='function'"))
    eksik=pg.evaluate("""(async()=>{const c=await caches.open('%s');const ks=(await c.keys()).map(r=>new URL(r.url).pathname+new URL(r.url).search);
      const ist=[...document.scripts].map(s=>s.getAttribute('src')).concat([...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.getAttribute('href'))).filter(x=>x&&!/^https?:/.test(x));
      return ist.filter(x=>!ks.includes('/'+x))})()"""%YSW)
    kontrol("Y6 sayfanın yüklediği her yerel JS/CSS yeni önbellekte", eksik==[], eksik)
    cx.set_offline(True); pg.reload(); pg.wait_for_timeout(1500)
    kontrol("Y7 çevrimdışı açılış yeni sürümden (%s), yeni kod mevcut"%YS, pg.evaluate("document.querySelector('meta[name=app-version]').content")==YS and pg.evaluate("typeof YarisHikaye._gecicileriAt==='function'"))
    kontrol("Y8 JS hatası yok", not hata, hata[:3])
    b.close()
srv.shutdown()
print("\nTOPLAM %d/%d"%(sum(SONUC),len(SONUC)))
sys.exit(0 if all(SONUC) else 1)
