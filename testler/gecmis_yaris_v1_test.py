# gecmis_yaris_v1_test — kendi kendine yeten (Jolpica taklidi). Çalıştır: python3 gecmis_yaris_v1_test.py
import json,re,datetime
from playwright.sync_api import sync_playwright
S=[]
def k(a,ok,ek=""):
    S.append(bool(ok)); print(("PASS " if ok else "FAIL ")+a+((" | "+str(ek)[:300]) if not ok else ""),flush=True)
NOW="2026-07-10T10:00:00Z"   # tur 1-15 bitti, 16+ gelecek
D0=datetime.date(2026,3,1)
def yarislar():
    L=[]
    for r in range(1,25):
        d=D0+datetime.timedelta(days=9*(r-1))
        L.append({"season":"2026","round":str(r),"raceName":"Test GP %d"%r,"date":d.isoformat(),"time":"13:00:00Z",
          "Circuit":{"circuitId":"marina_bay" if r==7 else "c%d"%r,"circuitName":"Pist %d"%r,"Location":{"locality":"marina_bay" if r==7 else "Şehir%d"%r,"country":"Turkey","lat":"1","long":"1"}}})
    return L
def drv(r,i,fam,code):
    return {"driverId":fam.lower(),"code":code,"givenName":"X","familyName":fam}
def sonuc(r):
    pil=[("W%d"%r,"WIN"),("Norris","NOR"),("Verstappen","VER")]
    rs=[{"number":"1","position":str(i+1),"positionText":str(i+1),"points":str(25-i*7),"grid":str(i+1),"laps":"50","status":"Finished",
         "Driver":drv(r,i,f,c),"Constructor":{"constructorId":"t%d"%i,"name":"Takım%d"%i},"Time":{"time":"1:3%d:00.000"%i}} for i,(f,c) in enumerate(pil)]
    if r==7: rs.append({"number":"9","position":"20","positionText":"R","points":"0","grid":"9","laps":"12","status":"Engine","Driver":drv(r,3,"Albon","ALB"),"Constructor":{"constructorId":"t9","name":"Takım9"}})
    return {"RaceTable":{"Races":[dict(yarislar()[r-1],Results=rs)]}}
def pit(r):
    return {"RaceTable":{"Races":[dict(yarislar()[r-1],PitStops=[{"driverId":"norris","stop":"1","lap":str(10+r),"time":"13:00:00","duration":"2%d.5"%(r%10)}])]}}
class Y:
    cagri=[]
def mock(route):
    u=route.request.url
    if not u.startswith("https://api.jolpi.ca/ergast/f1/"):
        return route.continue_() if u.startswith("file:") or "127.0.0.1" in u else route.abort()
    Y.cagri.append(u); y=u.split("/ergast/f1/")[1].split("?")[0].strip("/")
    m=re.match(r"2026/(\d+)/results",y); body=None
    if y in("2026/races","2026"): body={"RaceTable":{"Races":yarislar()}}
    elif m: body=sonuc(int(m.group(1)))
    elif re.match(r"2026/(\d+)/pitstops",y): body=pit(int(y.split("/")[1]))
    elif "constructorstandings" in y: body={"StandingsTable":{"StandingsLists":[{"ConstructorStandings":[{"position":"1","points":"100","wins":"3","Constructor":{"constructorId":"t1","name":"Takım1"}},{"position":"2","points":"90","wins":"1","Constructor":{"constructorId":"t2","name":"Takım2"}}]}]}}
    elif "driverstandings" in y: body={"StandingsTable":{"StandingsLists":[{"DriverStandings":[{"position":"1","points":"100","wins":"3","Driver":drv(0,0,"Norris","NOR"),"Constructors":[{"constructorId":"t1","name":"Takım1"}]},{"position":"2","points":"90","wins":"1","Driver":drv(0,0,"Verstappen","VER"),"Constructors":[{"constructorId":"t2","name":"Takım2"}]}]}]}}
    else: body={"RaceTable":{"Races":[]},"StandingsTable":{"StandingsLists":[]}}
    route.fulfill(status=200,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps({"MRData":body}))
def ilerle(pg,ms):
    for _ in range(int(ms/250)): pg.clock.run_for(250); pg.wait_for_timeout(12)
def jol(sub): return len([c for c in Y.cagri if sub in c])
with sync_playwright() as p:
    br=p.chromium.launch()
    for w,tema in((1100,"koyu"),(390,"acik"),(390,"koyu"),(1100,"acik")):
        t=" @%d %s"%(w,tema); Y.cagri=[]
        ctx=br.new_context(viewport={"width":w,"height":900},timezone_id="Europe/Istanbul",is_mobile=w<600); pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.route("**/*",mock); pg.clock.install(time=NOW)
        pg.goto("file:///home/claude/f1-takip/index.html?round=16&season=2026"); pg.evaluate("t=>document.documentElement.setAttribute('data-tema',t)",tema)
        ilerle(pg,25000)
        pg.evaluate("sekmeAc('yaris')"); ilerle(pg,6000)
        opts=pg.evaluate("[...document.querySelectorAll('#yaris-sec option')].map(o=>+o.value)")
        k("seçenekler yalnız tamamlanmış (1-15)"+t,opts and max(opts)==15 and min(opts)==1 and len(opts)==15,opts)
        k("?round=16 (gelecek) reddedildi → son tamamlanan (15) default"+t,pg.evaluate("document.getElementById('yaris-sec').value")=="15")
        ilerle(pg,3000)
        k("sonuç doğru yarışa ait (W15)"+t,"W15" in pg.evaluate("document.getElementById('sonuc-govde').textContent"),pg.evaluate("document.getElementById('sonuc-govde').textContent"))
        k("hero: tur 15 + podyum"+t,"TUR 15" in pg.evaluate("document.getElementById('yv-tur').textContent") and "W15" in pg.evaluate("document.getElementById('yv-meta').textContent"))
        ok=pg.evaluate("""()=>{const s=document.getElementById('yaris-sec');return [...s.options].every(o=>+o.value<=15)}""")
        # gelecek round'u zorla seçmeye çalış: option yok
        pg.evaluate("document.getElementById('yaris-sec').value='16'"); k("gelecek round seçilemiyor"+t,pg.evaluate("document.getElementById('yaris-sec').value")!="16")
        pg.evaluate("document.getElementById('yaris-sec').value='15'")
        # ticker + bugün referansı
        bg0=pg.evaluate("(document.getElementById('bg-kok')||document.body).textContent.length")
        # farklı round
        pg.select_option("#yaris-sec","7"); ilerle(pg,6000); ilerle(pg,3000)
        sg=pg.evaluate("document.getElementById('sonuc-govde').textContent")
        k("round 7: sonuç W7, W15 yok"+t,"W7" in sg and "W15" not in sg,sg)
        pt=pg.evaluate("document.getElementById('pit-govde').textContent")
        k("round 7: pit doğru yarışa ait (tur 17)"+t,"17" in pt and "27.5" in pt,pt)
        k("URL ?season=2026&round=7"+t,pg.evaluate("(()=>{const q=new URLSearchParams(location.search);return q.get('season')=='2026'&&q.get('round')=='7'})()"),pg.evaluate("location.search"))
        k("hero: pist/şehir ham anahtar sızmıyor"+t,"marina_bay" not in pg.evaluate("document.getElementById('yv-yer').textContent+document.getElementById('yaris-sec').textContent"),pg.evaluate("document.getElementById('yv-yer').textContent"))
        # duplicate fetch
        n7=jol("2026/7/results"); n7p=jol("2026/7/pitstops")
        pg.select_option("#yaris-sec","15"); ilerle(pg,5000)
        pg.select_option("#yaris-sec","7"); ilerle(pg,5000)
        k("duplicate fetch yok (7 tekrar açıldı)"+t,jol("2026/7/results")==n7==1 and jol("2026/7/pitstops")==n7p==1 and jol("2026/15/results")==1,(jol("2026/7/results"),jol("2026/7/pitstops"),jol("2026/15/results")))
        # state ayrımı
        k("ticker etkilenmedi (gizli)"+t,pg.evaluate("(()=>{const t=document.getElementById('a45-ticker');return !t||t.hidden})()") and pg.evaluate("TickerMerkezi.modelKur()")==None)
        pg.evaluate("sekmeAc('bugun')"); ilerle(pg,2000)
        bg=pg.evaluate("document.body.innerText.includes('TEST GP 7')||document.body.innerText.includes('Test GP 7')")
        k("BUGÜN geçmiş seçimden etkilenmedi"+t,not pg.evaluate("(document.getElementById('bg-kok')||{innerText:''}).innerText.includes('Test GP 7')"))
        # favori
        pg.evaluate("localStorage.setItem('f1-favori','norris')"); pg.evaluate("sekmeAc('yaris')"); pg.select_option("#yaris-sec","9"); ilerle(pg,5000)
        fav=pg.evaluate("document.querySelectorAll('#sonuc-govde tr[data-fav=\"1\"], #sonuc-govde tr.favori').length")
        k("favori vurgusu geçmiş sonuçta"+t,fav>=1,fav)
        pg.evaluate("localStorage.removeItem('f1-favori')")
        k("yatay taşma 0"+t,pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth+1"),pg.evaluate("[document.documentElement.scrollWidth,document.documentElement.clientWidth]"))
        k("JS hatası yok"+t,not errs,errs)
        ctx.close()
    # URL ?round=5 geçerli
    Y.cagri=[]; ctx=br.new_context(viewport={"width":390,"height":900}); pg=ctx.new_page(); pg.route("**/*",mock); pg.clock.install(time=NOW)
    pg.goto("file:///home/claude/f1-takip/index.html?season=2026&round=5"); ilerle(pg,6000); pg.evaluate("sekmeAc('yaris')"); ilerle(pg,6000)
    k("?round=5 ile açılış",pg.evaluate("document.getElementById('yaris-sec').value")=="5" and "W5" in pg.evaluate("document.getElementById('sonuc-govde').textContent"))
    br.close()
print(sum(S),"/",len(S))
