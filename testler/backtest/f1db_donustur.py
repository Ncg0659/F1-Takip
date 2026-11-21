# F1DB (CC BY 4.0, github.com/f1db/f1db) → Jolpica/Ergast biçimli yarış sonuç/qualifying veri seti. Yalnız ÇEVRİMDIŞI backtest için; uygulama kodu kullanmaz.
# Kullanım: python3 f1db_donustur.py <f1db/src/data> <çıktı.json> [ilk_sezon son_sezon]
import yaml, glob, json, os, sys
D=sys.argv[1]; OUT=sys.argv[2]; S0=int(sys.argv[3]) if len(sys.argv)>3 else 2020; S1=int(sys.argv[4]) if len(sys.argv)>4 else 2026
kod={}
def kodu(did):
    if did in kod: return kod[did]
    try: d=yaml.safe_load(open(f"{D}/drivers/{did}.yml")); k=d.get("abbreviation") or d["lastName"][:3].upper()
    except Exception: k=did[:3].upper()
    kod[did]=k; return k
def y(f):
    try: return yaml.safe_load(open(f)) or []
    except FileNotFoundError: return []
def donustur(rows):
    out=[]
    for r in rows:
        p=r.get("position"); neden=r.get("reasonRetired"); gp=r.get("gridPosition")
        if isinstance(p,int): pos=str(p); pt="R" if neden else str(p); st=neden if neden else "Finished"
        else:
            pos=str(p) if p else "0"; pt={"DNF":"R","DNS":"W","DSQ":"D","NC":"R","DNQ":"W"}.get(p,"R"); st=neden or ("+%s"%(r.get("gap") or "laps") if p=="NC" else ("Disqualified" if p=="DSQ" else "Retired"))
            if p=="NC": st="+%s Laps"%((r.get("gap") or "1").split()[0].lstrip("+"))
        out.append({"position":pos,"positionText":pt,"points":str(r.get("points") or 0),"grid":str(gp) if isinstance(gp,int) else "0","status":st,
                    "Driver":{"driverId":r["driverId"],"code":kodu(r["driverId"])},"Constructor":{"constructorId":r["constructorId"]}})
    return out
def qdonustur(rows):
    return [{"position":str(r["position"]) if isinstance(r.get("position"),int) else "0","Driver":{"driverId":r["driverId"],"code":kodu(r["driverId"])},"Constructor":{"constructorId":r["constructorId"]}} for r in rows]
def sdonustur(rows):
    o=donustur(rows)
    for x,r in zip(o,rows): x['points']=str(r.get('points') or 0)
    return o
veri={"kaynak":"F1DB (CC BY 4.0) https://github.com/f1db/f1db","seasons":{}}
for s in range(S0,S1+1):
    klasorler=sorted(glob.glob(f"{D}/seasons/{s}/races/*"))
    yarislar=[]
    for k in klasorler:
        meta=y(k+"/race.yml") if False else yaml.safe_load(open(k+"/race.yml"))
        res=y(k+"/race-results.yml"); q=y(k+"/qualifying-results.yml"); spr=y(k+"/sprint-race-results.yml")
        yarislar.append({"round":meta["round"],"raceName":meta["grandPrixId"],"date":str(meta["date"]),"circuitId":meta["circuitId"],"sprint":os.path.exists(k+"/sprint-race-results.yml"),
                         "results":donustur(res),"qualifying":qdonustur(q),
                         "sprintResults":sdonustur(spr)})
    tam=[r for r in yarislar if r["results"]]
    sampiyon=None
    if tam and len(tam)==len(yarislar):
        st=y(f"{D}/seasons/{s}/driver-standings.yml")
        sampiyon=next((r["driverId"] for r in st if r.get("position")==1),None)
    veri["seasons"][str(s)]={"toplam":len(yarislar),"tamamlanan":len(tam),"sampiyon":sampiyon,"races":yarislar}
json.dump(veri,open(OUT,"w"),ensure_ascii=False,separators=(",",":"))
print({s:(v["tamamlanan"],v["toplam"],v["sampiyon"]) for s,v in veri["seasons"].items()}, os.path.getsize(OUT)//1024,"KB")
