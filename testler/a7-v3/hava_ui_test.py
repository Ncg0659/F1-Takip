import sys
sys.path.insert(0,"/home/claude/f1-takip/testler/state")
from state_ui_lib import *
from playwright.sync_api import sync_playwright
TABK={"so":"olay","ta":"tur","gc":"gecis","pt":"pit","sh":"hava"}
def sec_ses(page,ses):
    b=page.locator("#sekme-hafta .h-cz[data-key='%s']"%ses)
    if b.count() and b.get_attribute("aria-pressed")!="true": b.click(); page.wait_for_timeout(100)
def gec(page,tab):
    page.locator("#sekme-hafta [data-act='psek'][data-v='%s']"%tab).click(); page.wait_for_timeout(50); page.clock.run_for(6000); page.wait_for_timeout(300)
def sekmeler(page,ses):
    sec_ses(page,ses); return page.locator("#sekme-hafta .v3-sek").all_inner_texts()
def bir_kutu(page): return page.locator(".h-dp .so,.h-dp .ta,.h-dp .gc,.h-dp .pt,.h-dp .sh").count()

NOW="2026-10-12T10:00:00Z"
def hava(sk, n=60, yagmur=False, nullair=False):
    r=[]
    for i in range(n):
        o={"session_key":sk,"meeting_key":2000,"date":"2026-10-11T12:%02d:%02d+00:00"%(i%60,0) if i<60 else "2026-10-11T13:%02d:00+00:00"%(i%60),
           "air_temperature":29.8-i*0.02,"track_temperature":41.2-i*0.1,"humidity":74+i//10,"pressure":1010.5,"rainfall":(1 if (yagmur and i>=n-3) else 0),"wind_direction":136,"wind_speed":3.2 if i else 2.0}
        if nullair: o["air_temperature"]=None
        r.append(o)
    r[n//2]["wind_speed"]=6.4
    return r
def hc(d): return [c for c in d.of_cagri[getattr(d,"ofbase",0):] if c.startswith("weather")]
def hazir(p,w=1100,mod="ok",veri=True):
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.sonuc[("17","results")]=yaris(); d.sonuc[("17","sprint")]=yaris(sprint=True); d.of_res[2]=of_sq(); d.of_res[1]=of_fp()
    d.of_hava={1:hava(1,30),2:hava(2,30,nullair=True),3:hava(3,30),5:hava(5,60,yagmur=True)} if veri else {}; d.of_hava_mod=mod
    page,errs,br=ac2(p,d,NOW,w); page.clock.run_for(20000); page.wait_for_timeout(400); return d,page,errs,br
def kutu(page,ad): return page.locator(".sh[data-seans='%s']"%ad)
def ac_h(page,ad):
    sec_ses(page,ad); gec(page,TABK["sh"]); return kutu(page,ad)
with sync_playwright() as p:
    d,page,errs,br=hazir(p)
    kontrol("H0 açmadan weather çağrısı YOK (lazy)", len(hc(d))==0, hc(d))
    kontrol("H1 tamamlanmış seanslarda HAVA sekmesi var (FP/SQ/Sprint/Q/Race)", all("HAVA" in sekmeler(page,s) for s in ("FirstPractice","SprintQualifying","Sprint","Qualifying","Race")))
    k=ac_h(page,"Race"); tx=k.inner_text().replace("\n"," | ")
    kontrol("H2 Race: açınca tam 1 çağrı, session_key=5", len(hc(d))==1 and "session_key=5" in hc(d)[0], hc(d))
    kontrol("H3 Başlangıç ve Bitiş ölçümleri (saat ile)", "BAŞLANGIÇ" in tx and "BİTİŞ" in tx and "Hava 29.8°C" in tx and "Pist 41.2°C" in tx and "Nem %74" in tx and "Rüzgâr 2.0 m/s · 136°" in tx, tx)
    kontrol("H4 bitiş: son ölçüm değerleri", "Hava 28.6°C" in tx and "Yağış: Var" in tx and "Yağış: Yok" in tx, tx)
    kontrol("H5 seans boyunca: min–max hava/pist, en yüksek rüzgâr 6.4 m/s, yağış kaydı 3/60", "En yüksek rüzgâr 6.4 m/s" in tx and "Hava 28.6°C – 29.8°C" in tx and "Pist 35.3°C – 41.2°C" in tx and "Yağış kaydı var (3 / 60 ölçüm)" in tx, tx)
    kontrol("H6 Open-Meteo ayrımı notu + kaynak", "Seans içi OpenF1 ölçümleri (gerçekleşen)" in tx and "Open-Meteo" in tx and "değildir" in tx and "Kaynak: OpenF1 / Weather" in tx, tx)
    kontrol("H7 rüzgâr birimi tek: yalnız m/s (km/sa yok)", "m/s" in tx and "km/sa" not in tx and "km/s " not in tx)
    kontrol("H8 nedensel yorum yok", not any(x in tx.lower() for x in ("nedeniyle","bozdu","aşındı","dengesiz","strateji")))
    kontrol("H9 mevcut Open-Meteo hava kartı etkilenmedi (5 seans kartı grid'de, tek detay paneli)", page.locator(".h-cz").count()==5 and page.locator(".h-seans").count()==1)
    gec(page,"sonuc"); gec(page,TABK["sh"]); page.wait_for_timeout(200)
    kontrol("H10 kapat/aç: çift fetch yok", len(hc(d))==1, hc(d))
    page.evaluate("document.dispatchEvent(new Event('f1-feed-guncel'))"); page.wait_for_timeout(200)
    kontrol("H11 yeniden çizimde açık kalır", kutu(page,"Race").locator(".sh-olcum").count()>=2)
    ks=ac_h(page,"SprintQualifying"); t2=ks.inner_text().replace("\n"," | ")
    kontrol("H12 SQ: ayrı session_key=2; air temperature null → 'Hava' satırı yok (uydurma yok)", any("session_key=2" in c for c in hc(d)) and len(hc(d))==2 and not __import__("re").search(r"Hava \d", t2) and "Pist" in t2, t2)
    ac_h(page,"Sprint"); ac_h(page,"FirstPractice")
    kontrol("H13 her seans için ayrı tek çağrı (3,1)", len(hc(d))==4 and len(set(hc(d)))==4, hc(d))
    kq=ac_h(page,"Qualifying")
    kontrol("H14 veri olmayan seans (Q): 'Seans hava verisi henüz yayımlanmadı.' (boş kart değil)", "Seans hava verisi henüz yayımlanmadı." in kq.inner_text(), kq.inner_text())
    ls=page.evaluate("Object.keys(localStorage).filter(k=>k.includes('hv-')&&!k.includes('oturum')).map(k=>[k,localStorage.getItem(k).length])")
    kontrol("H15 cache: hv-… ayrı namespace, yalnız özet (her kayıt < 8 KB), ham seri yok", len(ls)==4 and all(n<8000 for _,n in ls) and not any(("rc-" in k or "laps-" in k or "ovt-" in k or "pit-" in k) for k,_ in ls), ls)
    kontrol("H16 localStorage'da ham dakikalık seri yok", not page.evaluate("Object.keys(localStorage).filter(k=>k.includes('hv-')).some(k=>localStorage.getItem(k).includes('track_temperature')||localStorage.getItem(k).includes('\"s\":['))"))
    ob=len(d.of_cagri); page.clock.run_for(5*60*1000); page.wait_for_timeout(300)
    kontrol("H17 5 dk boşta yeni OpenF1 çağrısı yok (polling yok)", len(d.of_cagri)==ob, len(d.of_cagri)-ob)
    kontrol("H18 hata yok", not errs, errs)
    for tema in ("koyu","acik"):
        page.evaluate("t=>document.documentElement.setAttribute('data-tema',t)",tema); sec_ses(page,"Race"); gec(page,"hava")
        kontrol("H19 tema "+tema, page.evaluate("document.documentElement.getAttribute('data-tema')")==tema and kutu(page,"Race").locator(".sh-olcum").first.is_visible())
    page.reload(); page.clock.run_for(8000); page.wait_for_timeout(300); page.evaluate("sekmeAc('hafta')"); page.clock.run_for(20000); page.wait_for_timeout(300)
    n0=len(hc(d)); k=ac_h(page,"Race")
    kontrol("H20 sayfa yenilenince özet önbellekten: yeni çağrı yok", len(hc(d))==n0 and kutu(page,"Race").locator(".sh-olcum").count()>=2 and "Yağış kaydı var (3 / 60 ölçüm)" in k.inner_text(), (n0,hc(d)))
    br.close()
    d,page,errs,br=hazir(p,mod="abort"); k=ac_h(page,"Race"); t=k.inner_text()
    kontrol("H21 ağ hatası: ulaşılamıyor (yayımlanmadı DEĞİL) + yeniden dene", "OpenF1 hava verisine şu anda ulaşılamıyor." in t and "henüz yayımlanmadı" not in t and k.locator(".sh-btn").count()==1, t); br.close()
    d,page,errs,br=hazir(p,veri=False); k=ac_h(page,"Race"); t=k.inner_text()
    kontrol("H22 veri boş: 'Seans hava verisi henüz yayımlanmadı.'", "Seans hava verisi henüz yayımlanmadı." in t and "ulaşılamıyor" not in t, t); br.close()
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.of_hava={5:hava(5)}
    page,errs,br=ac2(p,d,"2026-10-11T12:30:00Z",1100)
    kontrol("H23 canlı yarışta bölüm YOK, çağrı yok", kutu(page,"Race").count()==0 and len(hc(d))==0); br.close()
    for w in (390,1100):
        d,page,errs,br=hazir(p,w=w); k=ac_h(page,"Race")
        tas=page.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
        kontrol("H24 %dpx: yatay taşma yok, içerik görünür"%w, not tas and k.locator(".sh-olcum").count()>=3, (tas,k.locator(".sh-olcum").count())); br.close()
print("\n%d/%d"%(sum(SONUC),len(SONUC))); sys.exit(0 if all(SONUC) else 1)
