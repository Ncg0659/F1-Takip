# Sezon arası modu: son yarıştan sonra (Aralık) ve yeni yıl başında (yeni sezon takvimi yok / var, puan durumu boş).
import sys, os, re, json, copy, datetime as dt
sys.path.insert(0,'.')
from ya_lib import *
import a2fix as X
def kaydir(r,yil,gun):
    r=copy.deepcopy(r); r["season"]=str(yil)
    def d(s): return (dt.date.fromisoformat(s)+dt.timedelta(days=gun)).isoformat()
    for k,v in list(r.items()):
        if k=="date": r[k]=d(v)
        elif isinstance(v,dict) and "date" in v: v["date"]=d(v["date"])
    return r
CAL27=[kaydir(r,2027,364) for r in X.CAL]
H={"access-control-allow-origin":"*"}
def bos(r): r.fulfill(status=200,content_type="application/json",headers=H,body='{"MRData":{"RaceTable":{"Races":[]},"StandingsTable":{"StandingsLists":[]}}}')
def tak27(r): r.fulfill(status=200,content_type="application/json",headers=H,body=json.dumps({"MRData":{"RaceTable":{"Races":CAL27}}}))
def ac(p,saat,takvim27,w=390,tema="koyu"):
    pg,errs,c,b=yeni(p,saat,w=w,tema=tema)
    pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2027/"),bos)
    if takvim27: pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2027/races/"),tak27)
    pg.reload(); ilerle(pg,8)
    return pg,errs,c,b
def metin(pg,nav): pg.click("#nav-"+nav); ilerle(pg,10); return pg.evaluate("(()=>{const s=[...document.querySelectorAll('[id^=sekme-]')].find(e=>!e.hidden);return s?s.innerText.replace(/\\s+/g,' '):''})()")
KOTU=re.compile(r"Veri alınamadı|Cannot read|undefined|NaN|Takvim kartları yükleniyor|Yükleniyor\.\.\.")
with sync_playwright() as p:
    # S1) Aralık: sezon bitti, yeni takvim yok
    pg,errs,c,b=ac(p,"2026-12-20T10:00:00Z",False)
    t=metin(pg,"bugun")
    kontrol("S1 Aralık BUGÜN: SEZON TAMAMLANDI · 2026 Sezonu + şampiyona", "SEZON TAMAMLANDI" in t and "2026 Sezonu" in t and "ŞAMPİYONA" in t, t[:200])
    pg.evaluate("for(let y=1950;y<2026;y++) localStorage.setItem('f1-'+y, JSON.stringify({sezon:String(y),pilot:'Eski Pilot',takim:'-',puan:'1',galibiyet:'0'}))"); pg.evaluate("sekmeAc('sampiyonlar')"); ilerle(pg,12)
    r=pg.evaluate("(()=>{const t=[...document.querySelectorAll('#govde tr')].find(r=>r.cells[0]&&r.cells[0].textContent==='2026');return t?t.innerText:null})()")
    kontrol("S1 Geçmiş şampiyonlar: 2026 satırı var, sezon bittiği için '(lider)' yazmıyor", bool(r) and "lider" not in r, r)
    kontrol("S1 hata yok", not errs, errs); b.close()
    pg,errs,c,b=ac(p,"2026-10-20T10:00:00Z",False)
    pg.evaluate("for(let y=1950;y<2026;y++) localStorage.setItem('f1-'+y, JSON.stringify({sezon:String(y),pilot:'Eski Pilot',takim:'-',puan:'1',galibiyet:'0'}))"); pg.evaluate("sekmeAc('sampiyonlar')"); ilerle(pg,12)
    r=pg.evaluate("(()=>{const t=[...document.querySelectorAll('#govde tr')].find(r=>r.cells[0]&&r.cells[0].textContent==='2026');return t?t.innerText:null})()")
    kontrol("S1b sezon sürerken 2026 satırı '(lider)' yazar (değişmedi)", bool(r) and "lider" in r, r); b.close()
    # S2) Ocak 2027: takvim henüz yok, puan durumu boş
    for w,tema in ((390,"koyu"),(1100,"acik")):
        pg,errs,c,b=ac(p,"2027-01-15T10:00:00Z",False,w=w,tema=tema)
        tb=metin(pg,"bugun"); th=metin(pg,"haftasonu"); ts=metin(pg,"sezon")
        kontrol("S2 %d/%s BUGÜN: SEZON ARASI · 2027 takvimi henüz yayınlanmadı (VERİ YOK değil)"%(w,tema), "SEZON ARASI" in tb and "2027 takvimi henüz yayınlanmadı" in tb and "VERİ YOK" not in tb, tb[:200])
        kontrol("S2 %d/%s HAFTA SONU: takvim yok mesajı, sonsuz yükleniyor yok"%(w,tema), "2027 takvimi henüz yayınlanmadı" in th and not KOTU.search(th), th[:200])
        kontrol("S2 %d/%s SEZON: takvim/puan/hesaplayıcı boş durumları, hata metni yok"%(w,tema), "takvimi henüz yayınlanmadı" in ts and "henüz yarış yapılmadı" in ts and not KOTU.search(ts), (KOTU.findall(ts), ts[:300]))
        kontrol("S2 %d/%s SEZON: mesaj bir kez (tekrar yok)"%(w,tema), ts.count("2027 takvimi henüz yayınlanmadı")==1, ts.count("2027 takvimi henüz yayınlanmadı"))
        kontrol("S2 %d/%s geçen yılın puanı 2027 puanı gibi gösterilmiyor"%(w,tema), pg.locator("#pilot-govde td.sezon").count()==0 and pg.locator("#pilot-govde tr.sezon-bos").count()==1)
        pg.click("#nav-kesfet"); ilerle(pg,6)
        kontrol("S2 %d/%s KEŞFET pist listesi: boş durum mesajı"%(w,tema), "takvimi yayınlanınca" in pg.inner_text("#pist-govde"))
        kontrol("S2 %d/%s yatay taşma 0, hata yok"%(w,tema), pg.evaluate("document.documentElement.scrollWidth")<=w and not errs, errs); b.close()
    # S3) Ocak 2027: takvim yayınlandı, puan durumu boş
    pg,errs,c,b=ac(p,"2027-01-15T10:00:00Z",True)
    tb=metin(pg,"bugun"); ts=metin(pg,"sezon")
    kontrol("S3 BUGÜN: SIRADAKİ YARIŞ · TUR 1 · geri sayım; şampiyona bloğu yok", "SIRADAKİ YARIŞ" in tb and "TUR 1" in tb and "GÜN" in tb and "ŞAMPİYONA" not in tb, tb[:220])
    kontrol("S3 SEZON: yarış kartları + boş puan durumu, hata metni yok", "SIRADAKİ" in ts and "henüz yarış yapılmadı" in ts and not KOTU.search(ts), (KOTU.findall(ts), ts[:300]))
    kontrol("S3 hata yok", not errs, errs); b.close()
print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
