# Vitrin görselleri için Jolpica (Ergast) API öykünücüsü — veri GERÇEK: F1DB (CC BY 4.0, github.com/f1db/f1db) YAML dosyaları.
# Uydurma veri yok: F1DB'de olmayan uç nokta boş liste döner (uygulama kendi "veri yok" durumunu gösterir).
# Kullanım: from jolpica_f1db import Jolpica; J = Jolpica("/yol/f1db/src/data"); durum, govde = J.yanit(url)
import os, re, json, glob, yaml
from urllib.parse import urlparse, parse_qs

PIST = {"melbourne": "albert_park", "shanghai": "shanghai", "suzuka": "suzuka", "bahrain": "bahrain", "jeddah": "jeddah", "miami": "miami",
        "montreal": "villeneuve", "monaco": "monaco", "catalunya": "catalunya", "spielberg": "red_bull_ring", "silverstone": "silverstone",
        "spa-francorchamps": "spa", "hungaroring": "hungaroring", "zandvoort": "zandvoort", "monza": "monza", "madring": "madring", "baku": "baku",
        "marina-bay": "marina_bay", "austin": "americas", "mexico-city": "rodriguez", "interlagos": "interlagos", "las-vegas": "vegas",
        "lusail": "losail", "yas-marina": "yas_marina", "sepang": "sepang", "imola": "imola"}
TAKIM = {"red-bull": "red_bull", "aston-martin": "aston_martin", "racing-bulls": "rb", "kick-sauber": "sauber", "rb": "rb"}
ULKE = {"united-states-of-america": "USA", "united-kingdom": "UK", "united-arab-emirates": "UAE", "saudi-arabia": "Saudi Arabia"}

def _yy(p):
    with open(p, encoding="utf-8") as f: return yaml.safe_load(f)
def _zaman(t):
    if t is None: return None
    if isinstance(t, int): t = "%02d:%02d" % divmod(t, 60)        # YAML 1.1: "04:00" altmışlık sayı (240) olarak okunur
    s = str(t); return s if s.endswith("Z") else (s + (":00" if s.count(":") == 1 else "") + "Z")

class Jolpica:
    def __init__(self, kok):
        self.kok = kok; self._s = {}; self.log = []
        self.ulke = {}
        for p in glob.glob(os.path.join(kok, "countries", "*.yml")):
            d = _yy(p); self.ulke[d["id"]] = d
    def surucu_id(self, f):
        if f == "max-verstappen": return "max_verstappen"
        t = [x for x in f.split("-") if x not in ("jr", "sr")]; return t[-1]
    def takim_id(self, f): return TAKIM.get(f, f.replace("-", "_"))
    def _ulke_ad(self, cid):
        if cid in ULKE: return ULKE[cid]
        d = self.ulke.get(cid); return d["name"] if d else cid
    def _milliyet(self, cid):
        d = self.ulke.get(cid); return d.get("demonym") if d else None
    def surucu(self, f):
        d = _yy(os.path.join(self.kok, "drivers", f + ".yml"))
        return {"driverId": self.surucu_id(f), "permanentNumber": str(d.get("permanentNumber") or ""), "code": d.get("abbreviation"),
                "url": "", "givenName": d.get("firstName"), "familyName": d.get("lastName"), "dateOfBirth": str(d.get("dateOfBirth")),
                "nationality": self._milliyet(d.get("nationalityCountryId"))}
    def takim(self, f):
        d = _yy(os.path.join(self.kok, "constructors", f + ".yml"))
        return {"constructorId": self.takim_id(f), "url": "", "name": d.get("name"), "nationality": self._milliyet(d.get("countryId"))}
    def pist(self, f):
        d = _yy(os.path.join(self.kok, "circuits", f + ".yml"))
        return {"circuitId": PIST.get(f, f.replace("-", "_")), "url": "", "circuitName": d.get("fullName"),
                "Location": {"lat": str(d.get("latitude")), "long": str(d.get("longitude")), "locality": d.get("placeName"), "country": self._ulke_ad(d.get("countryId"))}}
    def sezon(self, y):
        if y in self._s: return self._s[y]
        kl = os.path.join(self.kok, "seasons", str(y)); s = {"yarislar": [], "ds": None, "cs": None}
        if os.path.exists(os.path.join(kl, "driver-standings.yml")): s["ds"] = _yy(os.path.join(kl, "driver-standings.yml"))
        if os.path.exists(os.path.join(kl, "constructor-standings.yml")): s["cs"] = _yy(os.path.join(kl, "constructor-standings.yml"))
        for d in sorted(glob.glob(os.path.join(kl, "races", "*"))):
            r = _yy(os.path.join(d, "race.yml")); r["_dir"] = d; s["yarislar"].append(r)
        self._s[y] = s; return s
    def _dosya(self, r, ad):
        p = os.path.join(r["_dir"], ad); return (_yy(p) or []) if os.path.exists(p) else []
    def yaris(self, y, r):
        gp = _yy(os.path.join(self.kok, "grands-prix", r["grandPrixId"] + ".yml"))
        o = {"season": str(y), "round": str(r["round"]), "url": "", "raceName": gp.get("fullName"), "Circuit": self.pist(r["circuitId"]),
             "date": str(r["date"]), "time": _zaman(r.get("time"))}
        for anah, a in (("FirstPractice", "freePractice1"), ("SecondPractice", "freePractice2"), ("ThirdPractice", "freePractice3"),
                        ("Qualifying", "qualifying"), ("Sprint", "sprintRace"), ("SprintQualifying", "sprintQualifying")):
            if r.get(a + "Date"): o[anah] = {"date": str(r[a + "Date"]), "time": _zaman(r.get(a + "Time"))}
        return o
    def _sonuc(self, x, tur):
        o = {"number": str(x.get("driverNumber")), "position": str(x["position"]) if isinstance(x.get("position"), int) else None,
             "positionText": str(x.get("positionText", x.get("position"))), "Driver": self.surucu(x["driverId"]), "Constructor": self.takim(x["constructorId"])}
        if o["position"] is None: o["position"] = str(x.get("positionOrder") or "")
        if tur == "q":
            for q in ("q1", "q2", "q3"):
                if x.get(q): o[q.upper()] = str(x[q])
            return o
        o.update({"points": str(x.get("points") or 0).rstrip("0").rstrip(".") if isinstance(x.get("points"), float) else str(x.get("points") or 0),
                  "grid": str(x.get("gridPosition") or 0), "laps": str(x.get("laps") or 0),
                  "status": "Finished" if not x.get("reasonRetired") else str(x["reasonRetired"])})
        if x.get("time") and o["position"] == "1": o["Time"] = {"time": str(x["time"])}
        elif x.get("gap"): o["Time"] = {"time": str(x["gap"])}
        return o
    def _ds(self, liste, s, tur_sayisi):
        if not liste: return []
        kaz = {}
        for r in s["yarislar"][:tur_sayisi]:
            for x in self._dosya(r, "race-results.yml"):
                if x.get("position") == 1: kaz[x["driverId"]] = kaz.get(x["driverId"], 0) + 1
        son_takim = {}
        for r in s["yarislar"][:tur_sayisi]:
            for x in self._dosya(r, "race-results.yml"): son_takim[x["driverId"]] = x["constructorId"]
        out = []
        for x in liste:
            t = son_takim.get(x["driverId"])
            out.append({"position": str(x["position"]), "positionText": str(x["position"]), "points": str(x["points"]).replace(".0", ""),
                        "wins": str(kaz.get(x["driverId"], 0)), "Driver": self.surucu(x["driverId"]), "Constructors": [self.takim(t)] if t else []})
        return out
    def _cs(self, liste, s, tur_sayisi):
        if not liste: return []
        kaz = {}
        for r in s["yarislar"][:tur_sayisi]:
            for x in self._dosya(r, "race-results.yml"):
                if x.get("position") == 1: kaz[x["constructorId"]] = kaz.get(x["constructorId"], 0) + 1
        return [{"position": str(x["position"]), "positionText": str(x["position"]), "points": str(x["points"]).replace(".0", ""),
                 "wins": str(kaz.get(x["constructorId"], 0)), "Constructor": self.takim(x["constructorId"])} for x in liste]
    def _tamam(self, s):   # sonucu olan son tur
        n = 0
        for r in s["yarislar"]:
            if self._dosya(r, "race-results.yml"): n = int(r["round"])
        return n

    def yanit(self, url):
        u = urlparse(url); q = parse_qs(u.query); lim = int(q.get("limit", ["30"])[0]); off = int(q.get("offset", ["0"])[0])
        m = re.search(r"/ergast/f1/(.*)$", u.path); p = [x for x in (m.group(1) if m else "").split("/") if x and not x.endswith(".json")]
        bos = {"MRData": {"total": "0", "limit": str(lim), "offset": str(off), "RaceTable": {"Races": []}, "StandingsTable": {"StandingsLists": []}}}
        if not p or not re.match(r"^\d{4}$", p[0]) or not os.path.isdir(os.path.join(self.kok, "seasons", p[0])):
            self.log.append(("bos", url)); return bos
        y = int(p[0]); s = self.sezon(y); rest = p[1:]; tur = None
        if rest and re.match(r"^\d+$", rest[0]): tur = int(rest[0]); rest = rest[1:]
        kaynak = rest[0] if rest else "races"; filtre = rest[1:] if len(rest) > 1 else []
        yar = [r for r in s["yarislar"] if tur is None or int(r["round"]) == tur]
        def sar(tablo, ic, toplam=None):
            return {"MRData": {"total": str(toplam if toplam is not None else 0), "limit": str(lim), "offset": str(off), tablo: ic}}
        if kaynak == "races":
            l = [self.yaris(y, r) for r in yar]; return sar("RaceTable", {"season": str(y), "Races": l[off:off + lim]}, len(l))
        if kaynak in ("results", "qualifying", "sprint", "pitstops"):
            dosya, anah, t = {"results": ("race-results.yml", "Results", "r"), "qualifying": ("qualifying-results.yml", "QualifyingResults", "q"),
                              "sprint": ("sprint-race-results.yml", "SprintResults", "r"), "pitstops": ("pit-stops.yml", "PitStops", "p")}[kaynak]
            satir = []
            for r in yar:
                for x in self._dosya(r, dosya):
                    if filtre and filtre[0] == "drivers" and len(filtre) > 1 and self.surucu_id(x.get("driverId", "")) != filtre[1]: continue
                    if filtre and re.match(r"^\d+$", filtre[0]) and x.get("position") != int(filtre[0]): continue
                    if t == "p": satir.append((r, {"driverId": self.surucu_id(x["driverId"]), "lap": str(x.get("lap")), "stop": str(x.get("stop")), "time": str(x.get("timeOfDay") or ""), "duration": str(x.get("time") or "")}))
                    else: satir.append((r, self._sonuc(x, t)))
            dilim = satir[off:off + lim]; races = []
            for r, x in dilim:
                if not races or races[-1]["round"] != str(r["round"]):
                    races.append(dict(self.yaris(y, r), **{anah: []}))
                races[-1][anah].append(x)
            return sar("RaceTable", {"season": str(y), "Races": races}, len(satir))
        if kaynak in ("driverstandings", "constructorstandings"):
            tam = self._tamam(s); n = tur or tam
            if not n: return sar("StandingsTable", {"season": str(y), "StandingsLists": []}, 0)
            r = [x for x in s["yarislar"] if int(x["round"]) == n]
            if tur and r:
                d = self._dosya(r[0], "driver-standings.yml" if kaynak == "driverstandings" else "constructor-standings.yml")
            else:
                d = s["ds"] if kaynak == "driverstandings" else s["cs"]
            l = self._ds(d, s, n) if kaynak == "driverstandings" else self._cs(d, s, n)
            if filtre and re.match(r"^\d+$", filtre[0]): l = [x for x in l if x["position"] == filtre[0]]
            if not l: return sar("StandingsTable", {"season": str(y), "StandingsLists": []}, 0)
            k = "DriverStandings" if kaynak == "driverstandings" else "ConstructorStandings"
            return sar("StandingsTable", {"season": str(y), "round": str(n), "StandingsLists": [{"season": str(y), "round": str(n), k: l}]}, len(l))
        self.log.append(("bilinmeyen", url)); return bos
