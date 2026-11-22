# 20 pilotluk gerçekçi alan (prediction_request testleri için); prediction_ui_v1_test mock'unu yeniden kullanır
EX=[("sainz","SAI","Sainz","Williams","williams"),("albon","ALB","Albon","Williams","williams"),("alonso","ALO","Alonso","Aston Martin","aston_martin"),("stroll","STR","Stroll","Aston Martin","aston_martin"),
    ("gasly","GAS","Gasly","Alpine","alpine"),("colapinto","COL","Colapinto","Alpine","alpine"),("ocon","OCO","Ocon","Haas","haas"),("bearman","BEA","Bearman","Haas","haas"),
    ("lawson","LAW","Lawson","RB","rb"),("lindblad","LIN","Lindblad","RB","rb"),("hulkenberg","HUL","Hulkenberg","Audi","audi"),("bortoleto","BOR","Bortoleto","Audi","audi")]
ORD=ORD+EX
PTS=[25,18,15,12,10,8,6,4,2,1]+[0]*10
# --- tüm prediction istekleri (sonuç/quali sayfaları, tur bazlı, takvim, pit) sayılır ---
def _rota(r):
    u=r.request.url
    m=re.search(r"ergast/f1/(\d{4})/(results|qualifying)/\?limit=100&offset=(\d+)",u)
    if m:
        AYAR["log"].append(u)
        if AYAR["hata"]: return jol(r,{"x":1},500)
        if AYAR["bos"]: return jol(r,{"MRData":{"total":"0","RaceTable":{"Races":[]}}})
        return jol(r,sayfa(int(m.group(1)),m.group(2),int(m.group(3))))
    m=re.search(r"ergast/f1/(\d{4})/(\d+)/(results|qualifying)/\?limit=100",u)      # tur bazlı
    if m:
        AYAR["log"].append(u); y,rr,tur=int(m.group(1)),int(m.group(2)),m.group(3)
        if AYAR["hata"]: return jol(r,{"x":1},500)
        mx=yarisSayisi(y) if tur=="results" else qSayisi(y)
        if rr>mx: return jol(r,{"MRData":{"total":"0","RaceTable":{"Races":[]}}})
        anah="Results" if tur=="results" else "QualifyingResults"; rows=sonuclar(y,rr) if tur=="results" else qual(y,rr)
        return jol(r,{"MRData":{"total":str(len(rows)),"RaceTable":{"Races":[dict(meta(y,rr),**{anah:rows})]}}})
    if re.search(r"ergast/f1/\d{4}/(races|\d+/pitstops)/\?limit=100",u):
        AYAR["log"].append(u)
        return jol(r,{"MRData":{"total":"0","RaceTable":{"Races":[]}}})
    return r.fallback()
rota=_rota
