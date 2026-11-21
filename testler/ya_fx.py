import ast, json, subprocess, sys
D="/home/claude/f1-takip/testler/a7-v3/"
sys.path.insert(0,"/home/claude/f1-takip/testler/state")
from state_ui_lib import *
G=globals()
def _al(dosya,ad):
    src=open(D+dosya).read(); t=ast.parse(src)
    for n in t.body:
        if isinstance(n,ast.FunctionDef) and n.name==ad:
            exec(compile(ast.Module([n],[]),dosya,"exec"),G); return
    raise SystemExit("yok "+ad)
_al("pit_ui_test.py","pit"); _al("hava_ui_test.py","hava"); _al("laps_ui_test.py","laps"); _al("ovt_ui_test.py","ovt")
FX=json.loads(subprocess.check_output(["node","-e","console.log(JSON.stringify(require('/home/claude/f1-takip/testler/state/baglam/rc_fixture_sq.js')))"]))
for r in FX: r["session_key"]=5; r["meeting_key"]=2000
import state_ui_lib as _L
_orig=_L.kur
def _kur2(durum):
    r0=_orig(durum)
    def rota(r):
        u=r.request.url
        if "api.jolpi.ca" in u and "/pitstops/" in u:
            durum.cagri.append(u.split("/f1/")[-1])
            n=re.search(r"/f1/2026/(\d+)/pitstops",u).group(1)
            ps=[{"driverId":"russell","stop":"1","lap":"12","time":"13:20:00","duration":"22.3"},{"driverId":"norris","stop":"1","lap":"15","time":"13:23:00","duration":"23.1"},{"driverId":"verstappen","stop":"2","lap":"30","time":"13:40:00","duration":"22.8"}]
            return r.fulfill(status=200,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps({"MRData":{"RaceTable":{"Races":[{"season":"2026","round":n,"PitStops":ps}]}}}))
        return r0(r)
    return rota
_L.kur=_kur2
# --- 23 yarışlık takvim (kalan 4 gerçek kayıt korunur; ara turlar sahte dolgu) ---
def _takvim23():
    var={int(t["round"]):t for t in _L.TAKVIM}
    from datetime import date,timedelta
    out=[]
    for n in range(1,24):
        if n in var: out.append(var[n]); continue
        d=date(2026,3,1)+timedelta(days=(n-1)*14) if n<17 else date(2026,10,11)+timedelta(days=(n-17)*14)
        out.append(_L.yarisKaydi(n,"Grand Prix %d"%n,d.isoformat(),"circ%d"%n,False,"Italy"))
    return out
_L.TAKVIM[:]=_takvim23()
_orig_kur2=_L.kur
def _kur3(durum):
    r0=_orig_kur2(durum)
    def rota(r):
        u=r.request.url
        if "api.jolpi.ca" in u and "/pitstops/" in u and getattr(durum,"pit_bozuk",False):
            return r.fulfill(status=200,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps({"MRData":{"bos":1}}))
        if "api.jolpi.ca" in u and "/results/" in u and getattr(durum,"sonuc_ag_hata",False):
            return r.abort()
        return r0(r)
    return rota
_L.kur=_kur3
