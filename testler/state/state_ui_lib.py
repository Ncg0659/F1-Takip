import json, sys, re
from playwright.sync_api import sync_playwright
KOD=["ANT","RUS","HAM","NOR","LEC","VER","PIA","HAD","ALO","SAI","GAS","HUL","LAW","BEA","OCO","ALB","STR","COL","BOR","LIN","PER","BOT"]
TAKIM=["Mercedes","Mercedes","Ferrari","McLaren","Ferrari","Red Bull","McLaren","Red Bull","Aston Martin","Williams","Alpine F1 Team","Audi","RB F1 Team","Haas F1 Team","Haas F1 Team","Williams","Aston Martin","Alpine F1 Team","Audi","RB F1 Team","Cadillac F1 Team","Cadillac F1 Team"]
def drv(i): return {"driverId":KOD[i].lower(),"code":KOD[i],"givenName":"G"+KOD[i],"familyName":"F"+KOD[i]}
def con(i): return {"name":TAKIM[i]}
def sure(i,q): return "1:%02d.%03d"%(30+q*2+i//10, (i*37)%1000)
def siralama(eksik=False):
    r=[]
    for i in range(22):
        x={"position":str(i+1),"Driver":drv(i),"Constructor":con(i),"Q1":sure(i,0)}
        if i<15: x["Q2"]=sure(i,1)
        if i<10: x["Q3"]=sure(i,2)
        r.append(x)
    if eksik: r[3]["Q2"]=""   # kesintisiz değil
    return r
def yaris(grid_ceza=False, sprint=False):
    r=[]
    for i in range(22):
        g=i+1
        x={"position":str(i+1),"positionText":str(i+1),"points":str(max(0,(8-i) if sprint else (25 if i==0 else 18 if i==1 else 15 if i==2 else max(0,10-i)))),"Driver":drv(i),"Constructor":con(i),"grid":str(g),"laps":"50","status":"Finished","Time":{"millis":"1","time":"1:30:%02d.000"%i if i==0 else "+%d.123"%(i)}}
        if i==0 and not sprint: x["FastestLap"]={"rank":"1","lap":"40","Time":{"time":"1:35.001"}}
        r.append(x)
    if grid_ceza:  # sıralamada 5. olan LEC (i=4) 10. sıradan başlıyor, diğerleri kayıyor
        r[4]["grid"]="10"
    return r
def yarisKaydi(rnd,ad,tarih,circ,sprint,ulke="Singapore"):
    from datetime import datetime,timedelta
    d=datetime.strptime(tarih,"%Y-%m-%d")
    def gun(n): return (d-timedelta(days=n)).strftime("%Y-%m-%d")
    k={"season":"2026","round":str(rnd),"raceName":ad,"date":tarih,"time":"12:00:00Z",
       "Circuit":{"circuitId":circ,"circuitName":circ,"Location":{"locality":"Loc","country":ulke,"lat":"1","long":"1"}}}
    if sprint:
        k["FirstPractice"]={"date":gun(2),"time":"08:30:00Z"}
        k["SprintQualifying"]={"date":gun(2),"time":"12:30:00Z"}
        k["Sprint"]={"date":gun(1),"time":"09:00:00Z"}
        k["Qualifying"]={"date":gun(1),"time":"13:00:00Z"}
    else:
        k["FirstPractice"]={"date":gun(2),"time":"11:30:00Z"}
        k["SecondPractice"]={"date":gun(2),"time":"15:00:00Z"}
        k["ThirdPractice"]={"date":gun(1),"time":"10:30:00Z"}
        k["Qualifying"]={"date":gun(1),"time":"14:00:00Z"}
    return k
TAKVIM=[yarisKaydi(2,"Chinese Grand Prix","2026-03-15","shanghai",True,"China"),
        yarisKaydi(3,"Japanese Grand Prix","2026-03-29","suzuka",False,"Japan"),
        yarisKaydi(16,"Azerbaijan Grand Prix","2026-10-04","baku",False,"Azerbaijan"),
        yarisKaydi(17,"Singapore Grand Prix","2026-10-11","marina_bay",True)]
def of_fp(n=22):
    return [{"position":i+1,"driver_number":i+1,"duration":round(90.0+i*0.123,3),"gap_to_leader":(0 if i==0 else round(i*0.123,3)),"number_of_laps":20-i%5,"dnf":False,"dns":False,"dsq":False} for i in range(n)]
def of_sq(ceza=False):
    r=[]
    for i in range(22):
        q1=round(90+i*0.05,3); q2=round(89+i*0.05,3) if i<15 else None; q3=round(88+i*0.05,3) if i<10 else None
        r.append({"position":i+1,"driver_number":i+1,"duration":[q1,q2,q3],"gap_to_leader":[0,0,0],"number_of_laps":15,"dnf":False,"dns":False,"dsq":False})
    return r
OF_OTURUM=[(1,"Practice 1","Practice","2026-10-09T08:30:00+00:00"),(2,"Sprint Qualifying","Qualifying","2026-10-09T12:30:00+00:00"),(3,"Sprint","Race","2026-10-10T09:00:00+00:00"),(4,"Qualifying","Qualifying","2026-10-10T13:00:00+00:00"),(5,"Race","Race","2026-10-11T12:00:00+00:00")]
class Durum:
    def __init__(s): s.sonuc={}; s.cagri=[]; s.http429=0; s.takvim_hata=False; s.of_res={}; s.of_cagri=[]; s.of_mod="ok"; s.of_oturum=OF_OTURUM
def kur(durum):
    def rota(r):
        u=r.request.url
        def js(o,st=200): r.fulfill(status=st,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps(o))
        if "api.jolpi.ca" in u:
            durum.cagri.append(u.split("/f1/")[-1])
            m=re.search(r"/f1/2026/(\d+)/(qualifying|sprint|results)/",u)
            if "/races/" in u:
                if durum.takvim_hata: return js({},500)
                return js({"MRData":{"RaceTable":{"Races":TAKVIM}}})
            if m:
                if durum.http429>0: durum.http429-=1; return r.fulfill(status=429,body="x",headers={"access-control-allow-origin":"*"})
                rnd,uc=m.group(1),m.group(2)
                v=durum.sonuc.get((rnd,uc))
                alan={"qualifying":"QualifyingResults","sprint":"SprintResults","results":"Results"}[uc]
                rk=[dict(next(t for t in TAKVIM if t["round"]==rnd),**{alan:v})] if v else []
                return js({"MRData":{"RaceTable":{"Races":rk}}})
            ds=[{"position":str(i+1),"points":"10","wins":"0","Driver":dict(drv(i),permanentNumber="1",dateOfBirth="2000-01-01",nationality="X"),"Constructors":[con(i)]} for i in range(6)]
            cs=[{"position":"1","points":"10","wins":"0","Constructor":{"constructorId":"m","name":"Mercedes","nationality":"X"}}]
            return js({"MRData":{"StandingsTable":{"StandingsLists":[{"DriverStandings":ds,"ConstructorStandings":cs}]}}})
        if "api.openf1.org" in u:
            durum.of_cagri.append(u.split("/v1/")[-1])
            if durum.of_mod=="abort": return r.abort()
            if durum.of_mod=="401": return js({"detail":"live"},401)
            if "meetings" in u: return js([{"meeting_key":2000,"meeting_name":"Singapore Grand Prix","date_start":"2026-10-09T08:00:00+00:00","date_end":"2026-10-11T14:00:00+00:00","year":2026,"is_cancelled":False,"gmt_offset":"08:00:00"},{"meeting_key":1999,"meeting_name":"Pre-Season Testing","date_start":"2026-02-20T08:00:00+00:00","date_end":"2026-02-22T14:00:00+00:00","year":2026,"is_cancelled":False}])
            if "/weather?" in u:
                k=int(re.search(r"session_key=(\d+)",u).group(1)); md=getattr(durum,"of_hava_mod","ok")
                if md=="abort": return r.abort()
                v=getattr(durum,"of_hava",{}).get(k)
                return js(v) if v else js({"detail":"No results found."},404)
            if "/pit?" in u:
                k=int(re.search(r"session_key=(\d+)",u).group(1)); md=getattr(durum,"of_pit_mod","ok")
                if md=="abort": return r.abort()
                v=getattr(durum,"of_pit",{}).get(k)
                return js(v) if v else js({"detail":"No results found."},404)
            if "overtakes?" in u:
                k=int(re.search(r"session_key=(\d+)",u).group(1)); md=getattr(durum,"of_ovt_mod","ok")
                if md=="abort": return r.abort()
                v=getattr(durum,"of_ovt",{}).get(k)
                return js(v) if v else js({"detail":"No results found."},404)
            if "laps?" in u:
                k=int(re.search(r"session_key=(\d+)",u).group(1)); md=getattr(durum,"of_laps_mod","ok")
                if md=="abort": return r.abort()
                v=getattr(durum,"of_laps",{}).get(k)
                return js(v) if v else js({"detail":"No results found."},404)
            if "race_control" in u:
                k=int(re.search(r"session_key=(\d+)",u).group(1)); md=getattr(durum,"of_rc_mod","ok")
                if md=="abort": return r.abort()
                v=getattr(durum,"of_rc",{}).get(k)
                return js(v) if v else js({"detail":"No results found."},404)
            if "sessions?meeting_key=2000" in u: return js([{"session_key":k,"session_name":n,"session_type":t,"date_start":d,"meeting_key":2000} for (k,n,t,d) in durum.of_oturum])
            if "sessions" in u: return js({"detail":"No results found."},404)
            if "drivers" in u: return js([{"driver_number":i+1,"name_acronym":KOD[i],"full_name":"G"+KOD[i]+" F"+KOD[i],"first_name":"G"+KOD[i],"last_name":"F"+KOD[i],"team_name":TAKIM[i]} for i in range(22)])
            if "session_result" in u:
                k=int(re.search(r"session_key=(\d+)",u).group(1)); v=durum.of_res.get(k)
                return js(v) if v else js({"detail":"No results found."},404)
        if u.startswith("http"): return r.abort()
        r.continue_()
    return rota
SONUC=[]
def kontrol(ad,ok,ek=""):
    SONUC.append(ok); print(("PASS " if ok else "FAIL ")+ad+(" | "+str(ek) if (ek and not ok) else ""))
def ac(p,durum,saat,ls=None):
    page=p.chromium.launch().new_context(timezone_id="Europe/Istanbul",viewport={"width":1100,"height":900}).new_page()
    errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    page.route("**/*",kur(durum)); page.clock.install(time=saat)
    page.goto("file:///home/claude/f1-takip/index.html")
    page.evaluate("localStorage.clear()")
    page.clock.run_for(8000); page.wait_for_timeout(300); durum.base=len(durum.cagri); durum.ofbase=len(durum.of_cagri)   # UI turu: açılış Güncel Sezon; açılış istekleri taban sayılır
    page.evaluate("sekmeAc('hafta')"); page.clock.run_for(3000); page.wait_for_timeout(300)
    return page,errs
def metin(page,sel="#sekme-hafta"): return page.inner_text(sel).replace("\n"," | ")
def jolp(d,parca): return [c for c in d.cagri[getattr(d,"base",0):] if parca in c]
def jolp17(d,parca): return [c for c in jolp(d,parca) if "/17/" in c]   # Güncel Sezon başlangıç sekmesi tur 1-16 sonuç çağrıları yapar; hafta (tur 17) için sonuç çağrısı aranır

BSKY="()=>{window.__bs=[];window.__bskyFeed=[];window.__bskyFail=false;const f=window.fetch;window.fetch=function(u,...a){if(String(u).includes('bsky.app')){window.__bs.push(Date.now());if(window.__bskyFail){return Promise.reject(new Error('ağ'))}return Promise.resolve(new Response(JSON.stringify({feed:window.__bskyFeed}),{status:200}))}return f.call(this,u,...a)};}"
def bsky(page): page.evaluate(BSKY)
def post(page,text,dk=1,uid=None):
    page.evaluate("""([t,dk,u])=>{const n=Date.now();window.__bskyFeed.push({post:{uri:'at://x/app.bsky.feed.post/'+(u||('p'+window.__bskyFeed.length)),indexedAt:new Date(n-dk*60000).toISOString(),record:{text:t,createdAt:new Date(n-dk*60000).toISOString()}}})}""",[text,dk,uid])
def adim(page,sn,parca=10):
    for _ in range(int(sn/parca)): page.clock.run_for(parca*1000); page.wait_for_timeout(12)
    page.wait_for_timeout(50)
def kart(page,i): return page.locator(".h-seans").nth(i).inner_text().replace("\n"," ")
def ac2(p,durum,saat,w=1100,sayfa="hafta"):
    br=p.chromium.launch(); page=br.new_context(timezone_id="Europe/Istanbul",viewport={"width":w,"height":900}).new_page()
    errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    page.route("**/*",kur(durum)); page.clock.install(time=saat)
    page.goto("file:///home/claude/f1-takip/index.html"); page.evaluate("localStorage.clear()")
    page.clock.run_for(8000); page.wait_for_timeout(300); durum.base=len(durum.cagri); durum.ofbase=len(durum.of_cagri)
    bsky(page)
    page.evaluate("sekmeAc('%s')"%sayfa); page.clock.run_for(3000); page.wait_for_timeout(300)
    return page,errs,br
