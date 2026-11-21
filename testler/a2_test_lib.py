import json, re, sys
sys.path.insert(0,'.')
import a2fix as X
from playwright.sync_api import sync_playwright
SH="/tmp/claude-0/-home-claude/fd4d519e-fd7f-5e4f-afb5-c742b7139195/scratchpad/"
class D:
    def __init__(s):
        s.cagri=[]; s.yok=set(); s.h429={}; s.hata=set(); s.eksik_pole=set(); s.takvim_hata=False
def sirali_kayit(rows, rnd):
    return {"season":"2026","round":str(rnd),"raceName":X.yarisAd(rnd)}
def kur(d):
    def rota(r):
        u=r.request.url
        def js(o,st=200): r.fulfill(status=st,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps(o))
        if "api.jolpi.ca" in u:
            yol=u.split("/ergast/f1/")[-1]; d.cagri.append(yol)
            for k in list(d.h429):
                if k in yol and d.h429[k]>0: d.h429[k]-=1; return r.fulfill(status=429,body="x",headers={"access-control-allow-origin":"*"})
            for k in d.hata:
                if k in yol: return js({},500)
            def races(alan,veri,extra=False):
                out=[]
                for n in sorted(veri):
                    if n in d.yok: continue
                    satir=[veri[n]]
                    if extra:
                        e=dict(veri[n]); e["position"]="4"; e["positionText"]="4"; e["Driver"]=X.drv("XXX","Extra"); satir=[e]+satir if n not in d.eksik_pole else [e]
                    k=sirali_kayit(None,n); k[alan]=satir; out.append(k)
                return {"MRData":{"RaceTable":{"Races":out}}}
            if re.search(r"^2026/races/",yol):
                if d.takvim_hata: return js({},500)
                return js({"MRData":{"RaceTable":{"Races":X.CAL}}})
            m=re.search(r"^2026/results/([123])/",yol)
            if m: return js(races("Results",{"1":X.sonuc1(),"2":X.sonuc2(),"3":X.sonuc3()}[m.group(1)]))
            if re.search(r"^2026/sprint/1/",yol): return js(races("SprintResults",X.sprint()))
            if re.search(r"^2026/qualifying/1/",yol): return js(races("QualifyingResults",X.pole(),True))
            m=re.search(r"^2026/(\d+)/qualifying/1/",yol)
            if m:
                n=int(m.group(1)); return js({"MRData":{"RaceTable":{"Races":[dict(sirali_kayit(None,n),QualifyingResults=[X.pole()[n]])]}}})
            m=re.search(r"^2026/(\d+)/results/",yol)
            if m:
                n=int(m.group(1))
                if n in d.yok: return js({"MRData":{"RaceTable":{"Races":[]}}})
                rows=X.tam_satirlari(n) if n in X.TAM else [X.sonuc1()[n],X.sonuc2()[n],X.sonuc3()[n]]
                return js({"MRData":{"RaceTable":{"Races":[dict(sirali_kayit(None,n),Results=rows)]}}})
            if "/pitstops/" in yol or "/laps/" in yol: return js({"MRData":{"RaceTable":{"Races":[]}}})
            ds=[{"position":str(i+1),"points":"10","wins":"0","Driver":dict(X.drv(k,k.title()),permanentNumber="1",dateOfBirth="2000-01-01",nationality="X"),"Constructors":[{"name":"Mercedes"}]} for i,k in enumerate(["ANT","RUS","HAM","NOR","LEC","VER"])]
            cs=[{"position":"1","points":"10","wins":"0","Constructor":{"constructorId":"m","name":"Mercedes","nationality":"X"}}]
            return js({"MRData":{"StandingsTable":{"StandingsLists":[{"DriverStandings":ds,"ConstructorStandings":cs}]}}})
        if "api.openf1.org" in u: return js([])
        if u.startswith("http"): return r.abort()
        r.continue_()
    return rota
SONUC=[]
def kontrol(ad,ok,ek=""):
    SONUC.append(bool(ok)); print(("PASS " if ok else "FAIL ")+ad+(" | "+str(ek)[:400] if (ek and not ok) else ""))
def ilerle(page,sn):
    for _ in range(sn):
        page.clock.run_for(1000); page.wait_for_timeout(60)
def yeni(p,d,saat,genislik=1100,ctx=None,temizle=True,engelle=(),mod="acik",url="file:///home/claude/f1-takip/index.html"):
    br=p.chromium.launch()
    c=ctx or br.new_context(timezone_id="Europe/Istanbul",viewport={"width":genislik,"height":900})
    page=c.new_page(); errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    page.route("**/*",kur(d))
    for e in engelle: page.route("**/"+e+"*",lambda r:r.abort())
    page.clock.install(time=saat)
    page.goto(url)
    if temizle: page.evaluate("localStorage.clear()")
    if mod: page.evaluate("window.Ogren&&Ogren.modYaz(%r)"%mod)
    return page,errs,c
def SV(d): return [c for c in d.cagri if re.search(r"^2026/(races/\?limit=100|results/[123]/|sprint/1/|qualifying/1/|\d+/qualifying/1/)",c)]
