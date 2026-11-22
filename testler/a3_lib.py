import json, re, sys, copy
sys.path.insert(0,'.')
import a2fix as X
import a2_test_lib as L
R="/tmp/claude-0/-home-claude/fd4d519e-fd7f-5e4f-afb5-c742b7139195/scratchpad/real/"
KOD={"antonelli":("ANT","Andrea Kimi","Antonelli"),"russell":("RUS","George","Russell"),"hamilton":("HAM","Lewis","Hamilton"),"leclerc":("LEC","Charles","Leclerc"),
 "norris":("NOR","Lando","Norris"),"max_verstappen":("VER","Max","Verstappen"),"piastri":("PIA","Oscar","Piastri"),"hadjar":("HAD","Isack","Hadjar"),
 "lawson":("LAW","Liam","Lawson"),"gasly":("GAS","Pierre","Gasly"),"arvid_lindblad":("LIN","Arvid","Lindblad"),"colapinto":("COL","Franco","Colapinto"),
 "bearman":("BEA","Oliver","Bearman"),"bortoleto":("BOR","Gabriel","Bortoleto"),"hulkenberg":("HUL","Nico","Hülkenberg"),"ocon":("OCO","Esteban","Ocon"),
 "alonso":("ALO","Fernando","Alonso"),"sainz":("SAI","Carlos","Sainz"),"albon":("ALB","Alexander","Albon"),"tsunoda":("TSU","Yuki","Tsunoda"),
 "stroll":("STR","Lance","Stroll"),"bottas":("BOT","Valtteri","Bottas"),"perez":("PER","Sergio","Pérez")}
TAKIM={"mercedes":"Mercedes","ferrari":"Ferrari","mclaren":"McLaren","red_bull":"Red Bull","rb":"Racing Bulls","alpine":"Alpine F1 Team","haas":"Haas F1 Team",
 "audi":"Audi","williams":"Williams","aston_martin":"Aston Martin","cadillac":"Cadillac"}
def oku(f): return [l.strip().split("|") for l in open(R+f) if l.strip()]
def satir(r):
    rnd,dr,c,g,p,x,pts,st=r
    k,gn,fn=KOD[dr]
    return int(rnd),{"number":"1","position":p,"positionText":x,"points":pts,"grid":g,"laps":"50","status":st,
        "Driver":{"driverId":dr,"code":k,"givenName":gn,"familyName":fn},"Constructor":{"constructorId":c,"name":TAKIM[c]}}
def veri(dosya): return [satir(r) for r in oku(dosya)]
def r17_yaris():   # sentetik 17. tur (Singapur): R16 satırlarının sırası değiştirilmiş
    rows=[list(r) for r in oku("results_a.txt") if r[0]=="16"]
    rows[0],rows[1]=rows[1],rows[0]
    out=[]
    for i,r in enumerate(rows):
        r=list(r); r[0]="17"; r[4]=str(i+1)
        if r[5].isdigit(): r[5]=str(i+1)
        out.append(r)
    return out
def r17_sprint():
    rows=[list(r) for r in oku("sprint.txt") if r[0]=="12"]; out=[]
    for r in rows: r=list(r); r[0]="17"; out.append(r)
    return out
RES=veri("results_a.txt"); SPR=veri("sprint.txt")
R17R=[satir(r) for r in r17_yaris()]; R17S=[satir(r) for r in r17_sprint()]
class D3(L.D):
    def __init__(s):
        super().__init__()
        s.r17=False; s.drop=set(); s.sprint_hata=False; s.resmi_p={}; s.resmi_t={}; s.kayma=False; s.kirli_ad=None; s.say={}; s.mut=None
def tum(d,tur):
    rows=(RES if tur=="results" else SPR)[:]
    if d.r17: rows+= (R17R if tur=="results" else R17S)
    rows=[r for r in rows if r[0] not in d.drop] if tur=="results" else rows
    if getattr(d,"mut",None) and tur=="results":
        rows=d.mut(copy.deepcopy(rows))
    if d.kirli_ad:
        rows=copy.deepcopy(rows)
        for r in rows:
            if r[1]["Driver"]["driverId"]==d.kirli_ad: r[1]["Driver"]["givenName"]="<img src=x onerror=window.__xss=1>"
    return rows
def sayfa(rows,anahtar,off,lim,kayma=False):
    parca=rows[off:off+lim]; races=[]
    for rn,s in parca:
        if not races or races[-1]["round"]!=str(rn):
            races.append({"season":"2026","round":str(rn),"raceName":X.yarisAd(rn) if rn<=23 else "Tur %d"%rn,anahtar:[]})
        races[-1][anahtar].append(s)
    toplam=len(rows)+(1 if (kayma and off>0) else 0)
    return {"MRData":{"limit":str(lim),"offset":str(off),"total":str(toplam),"RaceTable":{"season":"2026","Races":races}}}
def standings(d):
    final=[l.split("|") for l in open(R+"final.txt")]
    ft=[l.split("|") for l in open(R+"final_team.txt")]
    ds=[]
    for i,(dr,p) in enumerate(final):
        k,gn,fn=KOD[dr]; pts=d.resmi_p.get(dr,int(p))
        ds.append({"position":str(i+1),"points":str(pts),"wins":"0","Driver":{"driverId":dr,"code":k,"givenName":gn,"familyName":fn,"permanentNumber":"1","dateOfBirth":"2000-01-01","nationality":"X"},"Constructors":[{"name":"X"}]})
    cs=[{"position":str(i+1),"points":str(d.resmi_t.get(c,int(p))),"wins":"0","Constructor":{"constructorId":c,"name":TAKIM[c],"nationality":"X"}} for i,(c,p) in enumerate(ft)]
    return ds,cs
def kur3(d):
    alt=L.kur(d)
    def rota(r):
        u=r.request.url
        if "api.jolpi.ca" in u:
            yol=u.split("/ergast/f1/")[-1]
            def js(o,st=200): r.fulfill(status=st,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps(o))
            if re.search(r"^2026/17/(results|qualifying|sprint|pitstops|drivers)",yol): return js({"MRData":{"total":"0","RaceTable":{"season":"2026","Races":[]}}})   # sentetik 17. tur için eski taklitte veri yok
            m=re.search(r"^2026/(results|sprint)/\?limit=(\d+)&offset=(\d+)",yol)
            if m or re.search(r"^2026/(driverstandings|constructorstandings)/",yol) or re.search(r"^2026/\d+/driverstandings/",yol):
                d.cagri.append(yol)
                for k in list(d.h429):
                    if k in yol and d.h429[k]>0: d.h429[k]-=1; return r.fulfill(status=429,body="x",headers={"access-control-allow-origin":"*"})
                for k in d.hata:
                    if k in yol: return js({},500)
                if m:
                    tur,lim,off=m.group(1),int(m.group(2)),int(m.group(3))
                    if tur=="sprint" and d.sprint_hata: return js({},500)
                    rows=tum(d,tur)
                    return js(sayfa(rows,"Results" if tur=="results" else "SprintResults",off,lim,d.kayma))
                ds,cs=standings(d)
                return js({"MRData":{"StandingsTable":{"StandingsLists":[{"DriverStandings":ds,"ConstructorStandings":cs}]}}})
        return alt(r)
    return rota
def yeni(p,d,saat,genislik=1100,ctx=None,temizle=True,engelle=(),chart=False,abort_ag=(),url="file:///home/claude/f1-takip/index.html"):
    br=p.chromium.launch() if ctx is None else None
    c=ctx or br.new_context(timezone_id="Europe/Istanbul",viewport={"width":genislik,"height":900})
    page=c.new_page(); errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    page.route("**/*",kur3(d))
    for e in engelle: page.route("**/"+e+"*",lambda r:r.abort())
    for e in abort_ag: page.route(e,lambda r:r.abort())          # UI turu: belirli ağ isteklerini düşür (ör. pole önbellekte yok senaryosu)
    if chart: page.add_init_script("window.Chart=function(){this.data={labels:[],datasets:[]};this.update=function(){};this.destroy=function(){}}")
    page.clock.install(time=saat)
    page.goto(url)
    if temizle: page.evaluate("localStorage.clear()")
    return page,errs,c
def ilerle(page,sn): L.ilerle(page,sn)
