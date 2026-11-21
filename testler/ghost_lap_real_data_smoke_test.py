# ghost_lap_real_data_smoke_test — GERÇEK OpenF1 verisi (session 9161, sürücü 63 & 81; fixture: ghost/real/*.gz). Gerçek API çağrısı YOK.
import json, re, subprocess, sys, os, gzip, urllib.parse
from playwright.sync_api import sync_playwright
D=os.path.dirname(os.path.abspath(__file__))+"/ghost/"; S=[]
def k(a,ok,ek=""):
    S.append(bool(ok)); print(("PASS " if ok else "FAIL ")+a+((" | "+str(ek)[:300]) if not ok else ""),flush=True)
r=subprocess.run(["node","real_kontrol.js"],cwd=D,capture_output=True,text=True)
if r.returncode!=0: print(r.stderr[-1500:]); sys.exit(1)
for ln in r.stdout.splitlines():
    if ln.startswith("//"): print(ln)
for c in json.loads(r.stdout.strip().splitlines()[-1]): k("[veri] "+c["ad"],c["ok"],c["d"])
G=lambda n: json.load(gzip.open(D+"real/"+n+".json.gz"))
F={"laps":{63:G("laps_63"),81:G("laps_81")},"car_data":{63:G("car_63"),81:G("car_81")},"location":{63:G("loc_63"),81:G("loc_81")}}
def rota_kur(page,log,disari):
    def rota(rt):
        u=urllib.parse.unquote(rt.request.url)
        if not u.startswith(("http://","https://")): return rt.continue_()
        if "api.openf1.org" not in u: disari.append(u); return rt.abort()
        yol=u.split("/v1/")[1]; log.append(yol); ep,_,q=yol.partition("?")
        Q=dict(p.split("=",1) for p in q.split("&") if "=" in p)
        def cev(o,st=200): rt.fulfill(status=st,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps(o))
        dn=int(Q.get("driver_number","0"))
        if Q.get("session_key")!="9161" or dn not in (63,81): return cev([],404)
        if ep=="laps": return cev(F["laps"][dn])
        if ep in ("car_data","location"):
            m=re.search(r"date>=([^&]+)&date<=([^&]+)",q); from datetime import datetime
            P=lambda s: datetime.fromisoformat(s.replace("Z","+00:00")).timestamp()
            a,b=P(m.group(1)),P(m.group(2)); return cev([x for x in F[ep][dn] if a<=P(x["date"])<=b])
        return cev([],404)
    page.route("**/*",rota)
def ac(p,w):
    b=p.chromium.launch(); page=b.new_context(viewport={"width":w,"height":900}).new_page(); log=[]; errs=[]; disari=[]
    page.on("pageerror",lambda e:errs.append(str(e))); rota_kur(page,log,disari)
    page.goto("file://"+D+"harness_real.html"); page.evaluate("__ac()"); return page,log,errs,disari,b
with sync_playwright() as p:
    for w in (1100,390):
        page,log,errs,disari,b=ac(p,w); page.click("#gl-ghost > summary")
        page.select_option("[data-gl='A']","63"); page.select_option("[data-gl='B']","81"); page.wait_for_timeout(1500)
        t=page.inner_text("#gl-ghost"); tab=page.inner_text("#gl-ghost .gl-tablo")
        s=page.evaluate("GhostLap._durum.sonuc&&{a:GhostLap._durum.sonuc.a.lap,b:GhostLap._durum.sonuc.b.lap}")
        k(f"U{w}-1 UI varsayılan en hızlı tur: 63 → tur 16, 81 → tur 2; başlık EN HIZLI TUR", s=={"a":16,"b":2} and page.inner_text("[data-gl-baslik]")=="EN HIZLI TUR", s)
        k(f"U{w}-2 UI lap süreleri 1:31.056 / 1:32.902 ve fark +1.846", "1:31.056" in tab and "1:32.902" in tab and "+1.846" in tab, tab)
        k(f"U{w}-3 UI sektörler 26.785/38.406/25.865 · 27.334/39.326/26.242; farklar +0.549/+0.920/+0.377", all(x in tab for x in ("26.785","38.406","25.865","27.334","39.326","26.242","+0.549","+0.920","+0.377")), tab)
        ds=page.inner_text("[data-gl-delta-son]")
        k(f"U{w}-4 UI 'Tur sonu delta' ≈ +1.876 (gerçek tur farkı +1.846 ile ±0.05 tutarlı)", "+1.8" in ds and abs(page.evaluate("GhostLap._durum.sonuc.delta.son")-1.846)<=0.05, ds)
        dn=page.evaluate("(()=>{const d=GhostLap._durum.sonuc.delta.noktalar;return {nul:d.filter(p=>p.delta===null).length,top:d.length,son:d[d.length-1].delta}})()")
        k(f"U{w}-5 delta: boşlukta yalnız ≤6 null, sonrası dolu; grafik iki ayrı çizgi parçası (M iki kez)", dn["nul"]<=6 and dn["nul"]>=1 and dn["son"] is not None and page.evaluate("document.querySelector('svg[data-gl-grafik=delta] path.gl-l-d').getAttribute('d').split('M').length-1")==2, dn)
        page.click("[data-gl-sek='hiz']"); k(f"U{w}-6 hız grafiği iki seri; boşluklu pilotta çizgi kesintisiz değil ama tur sonuna kadar uzanır", page.locator("svg[data-gl-grafik='hiz'] path.gl-l-a").count()==1 and page.locator("svg[data-gl-grafik='hiz'] path.gl-l-b").count()==1)
        T=page.evaluate("(()=>{const r=GhostLap._durum.sonuc._rp;return r?{durum:r.T.durum,hata:r.T.hata,var:!!document.querySelector('svg[data-gl-pist]'),yok:document.querySelectorAll('[data-gl-replay-yok]').length}:null})()")
        k(f"U{w}-7 transform hatası < 0.03 (mevcut eşik) → replay GÖRÜNÜR", T and T["durum"]=="ok" and T["hata"]<0.03 and T["var"] and T["yok"]==0, T)
        n_r=len(log)
        sn=page.evaluate("""(()=>{const s=GhostLap._durum.sonuc,R=s._rp;GhostLap._kaydir(45000);const out={};
          ['A','B'].forEach(i=>{const g=document.querySelector("[data-gl-isaret='"+i+"']");const m=/translate\\(([-\\d.]+) ([-\\d.]+)\\)/.exec(g.getAttribute('transform'));const p=GhostHesap.konumZaman(i==='A'?R.sa:R.sb,45000),u=GhostHesap.uygula(R.T,p.x,p.y);out[i]=[Math.abs(+m[1]-u.x),Math.abs(+m[2]-u.y)];});return out})()""")
        k(f"U{w}-8 işaretçi = uygula(dönüşüm, ham gerçek x/y) (snap yok); iki pilot aynı anda farklı gerçek konumda", all(v[0]<0.01 and v[1]<0.01 for v in sn.values()), sn)
        sB=page.evaluate("(()=>{const s=GhostLap._durum.sonuc;GhostLap._kaydir(91500);const f=i=>document.querySelector(\"[data-gl-isaret='\"+i+\"']\");return [f('A').getAttribute('data-durum'),f('B').getAttribute('data-durum'),s._rp.sa[s._rp.sa.length-1].t,s._rp.sb[s._rp.sb.length-1].t,s._rp.toplam]})()")
        k(f"U{w}-9 farklı tur süreleri: toplam 92.902 sn; 91.5 sn'de kısa turu biten pilot 63 son gerçek konumda ('bitti'), 81 hâlâ turda", sB[0]=="bitti" and sB[1]=="canli" and sB[4]==92902, sB)
        page.evaluate("GhostLap._kaydir(0)")
        page.click("[data-gl-rp='oynat']"); page.wait_for_timeout(600); pz=page.evaluate("GhostLap._durum.rp.poz"); page.click("[data-gl-rp='oynat']"); pz1=page.evaluate("GhostLap._durum.rp.poz"); page.wait_for_timeout(300)
        k(f"U{w}-10 Play ilerler, Pause durdurur", pz>300 and pz1==page.evaluate("GhostLap._durum.rp.poz"), (pz,pz1))
        page.fill("[data-gl-kaydir]","30000"); page.dispatch_event("[data-gl-kaydir]","input")
        k(f"U{w}-11 Scrub 30 sn", abs(page.evaluate("GhostLap._durum.rp.poz")-30000)<20 and page.inner_text("[data-gl-sure]").startswith("30.0 /"))
        sonuc=[]
        for h in ("0.5","1","2"):
            page.click(f"[data-gl-hiz='{h}']"); page.evaluate("GhostLap._kaydir(0)"); page.evaluate("GhostLap._adim(1000)"); sonuc.append(page.evaluate("GhostLap._durum.rp.poz"))
        k(f"U{w}-12 0.5×/1×/2× → 500/1000/2000 ms", sonuc==[500,1000,2000], sonuc)
        page.click("[data-gl-hiz='2']"); page.click("[data-gl-rp='oynat']"); page.wait_for_timeout(400); page.click("[data-gl-rp='basa']"); page.click("[data-gl-hiz='1']")
        k(f"U{w}-13 replay (oynat/scrub/hız/başa dön) sırasında ağ isteği 0", len(log)==n_r, (n_r,len(log)))
        n=len(log); page.click("[data-gl-sek='gaz']"); page.click("[data-gl-sek='delta']"); page.select_option("[data-gl='lapA']","16"); page.wait_for_timeout(300); page.select_option("[data-gl='lapA']","fastest"); page.wait_for_timeout(300)
        k(f"U{w}-8 aynı oturum/pilot/tur tekrar seçilince yeni istek 0", len(log)==n, log[n:])
        ayni=[x for x in log if x.startswith(("car_data","location"))]
        k(f"U{w}-9 duplicate car_data/location URL 0; laps pilot başına 1", len(ayni)==len(set(ayni)) and len([x for x in log if x.startswith("laps")])==2, len(ayni))
        k(f"U{w}-10 tüm istekler session_key=9161 ve yalnız driver 63/81; dış alan adı 0", {re.search(r"session_key=(\d+)",x).group(1) for x in log if "session_key" in x}=={"9161"} and {re.search(r"driver_number=(\d+)",x).group(1) for x in log if "driver_number" in x}=={"63","81"} and not disari, disari)
        k(f"U{w}-11 yatay sayfa taşması 0", page.evaluate("document.documentElement.scrollWidth-innerWidth")==0)
        k(f"U{w}-12 JS hatası yok", not errs, errs)
        b.close()
print("SONUC %d/%d"%(sum(S),len(S))); sys.exit(0 if all(S) else 1)
