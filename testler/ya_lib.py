import json, re, sys, copy
sys.path.insert(0,'.')
import a2fix as X
import a2_test_lib as L
from playwright.sync_api import sync_playwright
OUT="/tmp/f1-ekran/"
kontrol=L.kontrol
NOW="2026-10-06T10:00:00Z"        # tur 16 (Sepang) son tamamlanmış; Yarış Günü de tur 16'yı gösterir
LIVE="2026-10-11T12:30:00Z"       # tur 17 canlı
GUN17="2026-10-11T01:00:00Z"      # Yarış Günü tur 17'ye geçti (start-12sa), tur 17 henüz başlamadı
def drv(k,f): return {"driverId":f.lower(),"code":k,"givenName":"X","familyName":f}
def row(pos,k,f,t,grid,st="Finished",txt=None,pts="0"):
    return {"number":"1","position":str(pos),"positionText":txt if txt is not None else str(pos),"points":pts,"grid":str(grid),"laps":"50","status":st,
            "Driver":drv(k,f),"Constructor":{"constructorId":t.lower(),"name":t}}
RES={}
# 16: kazanan NOR (grid 3), pole ANT P2 bitirdi, GAS +8, LEC -6, 3 DNF  (6 satır tavanı: gerileyen sığmaz)
RES[16]=[row(1,"NOR","Norris","McLaren",3),row(2,"ANT","Antonelli","Mercedes",1),row(3,"VER","Verstappen","Red Bull",2),row(4,"GAS","Gasly","Alpine",12),
         row(5,"RUS","Russell","Mercedes",6),row(6,"PIA","Piastri","McLaren",5),row(7,"HAD","Hadjar","Red Bull",8),row(8,"LEC","Leclerc","Ferrari",4)]
RES[16][7]["position"]="14"; RES[16][7]["positionText"]="14"           # LEC: grid 4 → P14 = -10
RES[16]=RES[16][:7]+[RES[16][7]]
RES[16]+= [row(15,"HAM","Hamilton","Ferrari",7,"Engine","R"),row(16,"SAI","Sainz","Williams",9,"Accident","R"),row(17,"ALB","Albon","Williams",10,"Collision","R")]
# 15: pole sahibi kazandı
RES[15]=[row(1,"VER","Verstappen","Red Bull",1),row(2,"NOR","Norris","McLaren",2),row(3,"ANT","Antonelli","Mercedes",3),row(4,"GAS","Gasly","Alpine",9)]
# 14: pole sahibi kazanamadı (RUS pole, P3)
RES[14]=[row(1,"ANT","Antonelli","Mercedes",2),row(2,"NOR","Norris","McLaren",3),row(3,"RUS","Russell","Mercedes",1),row(4,"VER","Verstappen","Red Bull",4)]
# 12: grid 0 / pit lane
RES[12]=[row(1,"NOR","Norris","McLaren",1),row(2,"ALO","Alonso","Aston Martin",0),row(3,"VER","Verstappen","Red Bull",3),row(4,"GAS","Gasly","Alpine",6),row(5,"LEC","Leclerc","Ferrari",2)]
# 11: DNS + DSQ + DNF
RES[11]=[row(1,"NOR","Norris","McLaren",1),row(2,"VER","Verstappen","Red Bull",2),row(3,"ANT","Antonelli","Mercedes",3),row(4,"GAS","Gasly","Alpine",6),
         row(19,"HAM","Hamilton","Ferrari",0,"Did not start","W"),row(20,"SAI","Sainz","Williams",7,"Disqualified","D"),row(18,"ALB","Albon","Williams",8,"Engine","R")]
# 9: sade yarış, yarış dışı yok
RES[9]=[row(1,"RUS","Russell","Mercedes",1),row(2,"ANT","Antonelli","Mercedes",2),row(3,"NOR","Norris","McLaren",3)]
QP={16:("ANT","Antonelli","Mercedes"),15:("VER","Verstappen","Red Bull"),14:("RUS","Russell","Mercedes"),12:("NOR","Norris","McLaren"),9:("RUS","Russell","Mercedes")}
QP_BOS={10}
def standings():
    ds=[]
    for i,(k,f,pts) in enumerate([("ANT","Antonelli",290),("RUS","Russell",198),("NOR","Norris",150),("VER","Verstappen",140)]):
        ds.append({"position":str(i+1),"points":str(pts),"wins":"0","Driver":dict(drv(k,f),permanentNumber="1",dateOfBirth="2000-01-01",nationality="X"),"Constructors":[{"name":"Mercedes"}]})
    return ds
def js(r,o,st=200): r.fulfill(status=st,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps(o))
class Ctx:
    def __init__(s): s.net=[]; s.of=[]; s.std_bos=False
def yeni(p,saat,w=1100,engelle=(),br=None,tema=None,feed16=False,std_bos=False):
    d=L.D(); alt=L.kur(d); c=Ctx()
    def rota(r):
        u=r.request.url
        if any(e in u for e in engelle): return r.abort()
        if u.startswith("http"): c.net.append(u)
        if "api.openf1.org" in u:
            c.of.append(u); return js(r,[])
        if "api.jolpi.ca" in u:
            yol=u.split("/ergast/f1/")[-1]
            m=re.search(r"^2026/(\d+)/results/",yol)
            if m:
                n=int(m.group(1))
                rows=RES.get(n) or (X.tam_satirlari(n) if n in X.TAM else None)
                if rows is None: rows=RES[9]
                return js(r,{"MRData":{"RaceTable":{"Races":[{"season":"2026","round":str(n),"raceName":X.yarisAd(n),"Results":rows}]}}})
            if re.search(r"^2026/qualifying/1/",yol):   # UI turu: Güncel Sezon açılışta toplu pole çağrısı yapar → aynı yarış başına taklitten üret
                rl=[]
                for n in sorted(QP):
                    if n in QP_BOS: continue
                    k,f,t=QP[n]; rl.append({"season":"2026","round":str(n),"raceName":X.yarisAd(n),"QualifyingResults":[row(1,k,f,t,1)]})
                return js(r,{"MRData":{"RaceTable":{"Races":rl}}})
            m=re.search(r"^2026/(\d+)/qualifying/1/",yol)
            if m:
                n=int(m.group(1))
                if n in QP_BOS: return js(r,{"MRData":{"RaceTable":{"Races":[]}}})
                if n in QP:
                    k,f,t=QP[n]
                    return js(r,{"MRData":{"RaceTable":{"Races":[{"season":"2026","round":str(n),"raceName":X.yarisAd(n),"QualifyingResults":[row(1,k,f,t,1)]}]}}})
            if re.search(r"^2026/driverstandings/",yol):
                return js(r,{"MRData":{"StandingsTable":{"StandingsLists":[{"DriverStandings":standings()}]}}})
        return alt(r)
    b=br or p.chromium.launch()
    cx=b.new_context(timezone_id="Europe/Istanbul",viewport={"width":w,"height":900})
    cx.add_init_script("try{ if(!window.__introTest) sessionStorage.setItem('f1-mo2-isik','1'); }catch(e){}")   # giriş animasyonu (oturumda bir kez, ~6 sn) testlerde kapalı; intro kendi testinde ölçülür
    page=cx.new_page(); errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    page.route("**/*",rota); page.clock.install(time=saat); page.goto("file:///home/claude/f1-takip/index.html")
    page.evaluate("localStorage.clear()")
    if feed16: seed_feed(page,16)
    if tema: page.evaluate("document.documentElement.setAttribute('data-tema','%s')"%tema)
    return page,errs,c,b
def seed_feed(pg,tur):
    pg.evaluate("""(t)=>localStorage.setItem('f1-feed-v1-2026-'+t, JSON.stringify({olaylar:[{id:'a',timestamp:'2026-10-04T07:30:00Z',category:'RESULT',priority:'high',textTr:'Test olayı',sourceUrl:'https://x',sourceName:'Test',drivers:[]}],gorulen:{},enYeniPost:null,motorSurum:RaceFeed.MOTOR_SURUM}))""",tur)
def ilerle(pg,sn=12): L.ilerle(pg,sn)
def yaris_ac(pg,tur=None):
    pg.click("#btn-yarisgrup"); ilerle(pg,3); pg.click("#btn-yaris"); ilerle(pg,10)
    if tur is not None: sec(pg,tur)
def sec(pg,tur): pg.select_option("#yaris-sec",str(tur)); ilerle(pg,12)
JS="""()=>{const k=document.getElementById('yo-kart'); if(!k) return null; const r=k.getBoundingClientRect();
 return {hidden:k.hidden, vis:k.offsetParent!==null, tur:k.getAttribute('data-tur'), baslik:(k.querySelector('h2')||{}).textContent||'',
  satir:[...k.querySelectorAll('.yo-s')].map(li=>({a:li.className.replace('yo-s yo-',''),t:li.textContent,alt:(li.querySelector('.yo-alt')||{}).textContent||''})),
  aks:[...k.querySelectorAll('.yo-btn')].map(b=>b.textContent), h:r.height, w:r.width, sw:k.scrollWidth, cw:k.clientWidth, txt:k.textContent}}"""
def kart(pg): return pg.evaluate(JS)
def sat(k,a):
    for s in k["satir"]:
        if s["a"]==a: return s["t"]
    return None
YASAK=re.compile(r"kırılma|doğru yaptı|harika|kötü start|dominant|şanslı|favori|beklenmedik|sürpriz|müthiş|inanılmaz|fark açıldı|fark kapandı|açıldı|kapandı|hata yaptı|stratejiyi",re.I)

