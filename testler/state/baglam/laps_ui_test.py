import sys, json, time
sys.path.insert(0,"/home/claude/f1-takip/testler/state")
from state_ui_lib import *
from playwright.sync_api import sync_playwright
NOW="2026-10-12T10:00:00Z"
def laps(sk, nl=15, nd=22, seg=True):
    r=[]
    for d in range(1,nd+1):
        for l in range(1,nl+1):
            dur=None if (d==5 and l==3) else round(90+d*0.05+(l%5)*0.1,3)
            if d==22: dur=None
            x={"session_key":sk,"meeting_key":2000,"driver_number":d,"lap_number":l,"lap_duration":dur,"duration_sector_1":28.4+d*0.01,"duration_sector_2":30.1,"duration_sector_3":None if (d==6) else 31.5,
               "i1_speed":300,"i2_speed":280,"st_speed":None if d==7 else 290+d,"is_pit_out_lap":l==1,**({"segments_sector_1":[2048,2049],"segments_sector_2":[2048],"segments_sector_3":[2051]} if seg else {}),"date_start":"2026-10-09T12:%02d:00+00:00"%(30+l%20)}
            r.append(x)
    return r
def lc(d): return [c for c in d.of_cagri[getattr(d,"ofbase",0):] if c.startswith("laps")]
def hazir(p,w=1100,mod="ok",veri=True):
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.sonuc[("17","results")]=yaris(); d.of_res[2]=of_sq()
    d.of_laps={2:laps(2),4:laps(4),1:laps(1,10,20),5:laps(5,60,22,False),9:laps(9)} if veri else {}; d.of_laps_mod=mod
    page,errs,br=ac2(p,d,NOW,w); page.clock.run_for(20000); page.wait_for_timeout(400); return d,page,errs,br
def kutu(page,ad): return page.locator(".ta[data-seans='%s']"%ad)
def ac_ta(page,ad):
    k=kutu(page,ad); k.locator(".ta-ac").click(); page.wait_for_timeout(50); page.clock.run_for(6000); page.wait_for_timeout(300); return k
with sync_playwright() as p:
    d,page,errs,br=hazir(p)
    kontrol("A0 açmadan laps çağrısı YOK (lazy)", len(lc(d))==0, lc(d))
    kontrol("A1 tamamlanmış kartlarda 'Tur Analizi' var (FP/SQ/Q/Sprint/Race)", page.locator(".ta-ac").count()>=4, page.locator(".ta-ac").count())
    k=ac_ta(page,"SprintQualifying"); tx=k.inner_text().replace("\n"," | ")
    kontrol("A2 açınca tam 1 laps çağrısı, session_key=2", len(lc(d))==1 and "session_key=2" in lc(d)[0], lc(d))
    kontrol("A3 ilk görünüm 3 pilot", k.locator(".ta-sat").count()==3, k.locator(".ta-sat").count())
    kontrol("A4 en hızlı tur, S1/S2/S3, speed trap, süreli tur görünür", "1:30.0" in tx and "S1" in tx and "S2" in tx and "S3" in tx and "Speed trap" in tx and "süreli tur" in tx, tx[:300])
    kontrol("A5 pilot kodu (ANT) gösterilir", "ANT" in tx, tx[:200])
    kontrol("A6 SQ'da faz etiketi üretilmez; açıklama notu var", "SQ1" not in tx and "SQ2" not in tx and "ayrımı yapılmaz" in tx and "Kaynak: OpenF1 / Laps" in tx, tx)
    kontrol("A7 'Tüm pilotları göster (22)' ", "Tüm pilotları göster (22)" in tx, tx[-120:])
    k.locator("[data-ta-act=tumu]").click(); page.wait_for_timeout(100)
    kontrol("A8 tümü: 22 satır", k.locator(".ta-sat").count()==22, k.locator(".ta-sat").count())
    t22=k.locator(".ta-sat").nth(21).inner_text().replace("\n"," ")
    kontrol("A9 süresiz pilot: '—' ve 'Süreli tur yok' (uydurma yok)", "—" in t22 and "Süreli tur yok" in t22, t22)
    t6=[k.locator(".ta-sat").nth(i).inner_text().replace("\n"," ") for i in range(22)]
    kontrol("A10 sektör3 eksik pilot '—' gösterir; speed trap eksik '—'", any("S3 —" in x for x in t6) and any("Speed trap —" in x for x in t6), t6[:3])
    kontrol("A11 DOM: ham tur satırı basılmadı (≤ 22 pilot satırı)", page.locator(".ta-sat").count()<=22 and page.locator(".ta-liste li").count()<=22)
    k.locator(".ta-ac").click(); k.locator(".ta-ac").click(); page.wait_for_timeout(200)
    kontrol("A12 kapat/aç: çift fetch yok", len(lc(d))==1, lc(d))
    page.evaluate("document.dispatchEvent(new Event('f1-feed-guncel'))"); page.wait_for_timeout(200)
    kontrol("A13 yeniden çizimde blok açık kalır", kutu(page,"SprintQualifying").locator(".ta-sat").count()>0)
    # Race Control ile birlikte çalışır: ayrı kutular, ayrı cache anahtarları
    kontrol("A14 Seans Olayları ve Tur Analizi birlikte, ayrı kutu", page.locator(".so[data-seans='SprintQualifying']").count()==1 and kutu(page,"SprintQualifying").count()==1)
    ls=page.evaluate("Object.keys(localStorage).filter(k=>k.includes('laps-')||k.includes('rc-'))")
    kontrol("A15 cache namespace: laps-… ayrı (rc-… ile çakışmaz)", any("laps-2026-r17-SprintQualifying" in k for k in ls) and not any(k.endswith("rc-2026-r17-SprintQualifying") and "laps" in k for k in ls), ls)
    # FP1 farklı session_key + izolasyon
    k1=ac_ta(page,"FirstPractice"); t1=k1.inner_text()
    kontrol("A16 FP1: ayrı session_key=1, farklı pilot sayısı (20)", any("session_key=1" in c for c in lc(d)) and "Tüm pilotları göster (20)" in t1, (lc(d),t1[-100:]))
    # Race: büyük veri
    t0=time.time(); kr=ac_ta(page,"Race"); dt=time.time()-t0
    kontrol("A17 Race 22×60 tur: özet 3 satır, DOM küçük", kr.locator(".ta-sat").count()==3 and page.locator(".ta-sat").count()<=3+22+3, kr.locator(".ta-sat").count())
    sz=page.evaluate("Object.keys(localStorage).filter(k=>k.includes('laps-')&&!k.includes('oturum')).map(k=>[k,localStorage.getItem(k).length])")
    kontrol("A18 localStorage laps kayıtları < 200 KB/seans, toplam < 600 KB", all(n<200000 for _,n in sz) and sum(n for _,n in sz)<600000, sz)
    # polling
    ob=len(d.of_cagri); jb=len(d.cagri); page.clock.run_for(5*60*1000); page.wait_for_timeout(300)
    kontrol("A19 5 dk boşta: yeni OpenF1/laps çağrısı yok", len(d.of_cagri)==ob and len(lc(d))==3, (len(d.of_cagri)-ob,lc(d)))
    kontrol("A20 hata yok", not errs, errs)
    for tema in ("koyu","acik"):
        page.evaluate("t=>document.documentElement.setAttribute('data-tema',t)",tema)
        kontrol("A21 tema "+tema+" + görünür", page.evaluate("document.documentElement.getAttribute('data-tema')")==tema and kutu(page,"SprintQualifying").locator(".ta-sat").first.is_visible())
    # reload: cache'ten, ağ yok
    page.reload(); page.clock.run_for(8000); page.wait_for_timeout(300); page.evaluate("sekmeAc('hafta')"); page.clock.run_for(3000); page.wait_for_timeout(300)
    n0=len(lc(d)); ac_ta(page,"SprintQualifying")
    kontrol("A22 sayfa yenilenince önbellekten: yeni laps çağrısı yok", len(lc(d))==n0 and kutu(page,"SprintQualifying").locator(".ta-sat").count()==3, (n0,lc(d)))
    br.close()
    d,page,errs,br=hazir(p,mod="abort"); k=ac_ta(page,"SprintQualifying"); t=k.inner_text()
    kontrol("A23 ağ hatası: ulaşılamıyor mesajı (yayımlanmadı DEĞİL) + yeniden dene", "OpenF1 tur verisine şu anda ulaşılamıyor." in t and "henüz yayımlanmadı" not in t and k.locator(".ta-btn").count()==1, t); br.close()
    d,page,errs,br=hazir(p,veri=False); k=ac_ta(page,"SprintQualifying"); t=k.inner_text()
    kontrol("A24 veri hazır değil: 'Tur verisi henüz yayımlanmadı.'", "Tur verisi henüz yayımlanmadı." in t and "ulaşılamıyor" not in t, t); br.close()
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.of_laps={2:laps(2)}
    page,errs,br=ac2(p,d,"2026-10-09T12:40:00Z",1100)
    kontrol("A25 canlı seansta Tur Analizi YOK, laps çağrısı yok", kutu(page,"SprintQualifying").count()==0 and len(lc(d))==0); br.close()
    for w in (390,1100):
        d,page,errs,br=hazir(p,w=w); k=ac_ta(page,"Qualifying"); k.locator("[data-ta-act=tumu]").click(); page.wait_for_timeout(100)
        tas=page.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
        kontrol("A26 %dpx: yatay taşma yok, 22 satır"%w, not tas and k.locator(".ta-sat").count()==22, (tas,k.locator(".ta-sat").count())); br.close()
print("\n%d/%d"%(sum(SONUC),len(SONUC))); sys.exit(0 if all(SONUC) else 1)
