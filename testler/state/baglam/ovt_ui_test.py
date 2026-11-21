import sys, json
sys.path.insert(0,"/home/claude/f1-takip/testler/state")
from state_ui_lib import *
from playwright.sync_api import sync_playwright
NOW="2026-10-12T10:00:00Z"
def ovt(sk, n=37):
    # HAM(3) 6, VER(6) 5, NOR(4) 4 geçiş; kalanı dağılım. Deterministik, SENTETİK.
    a=[3]*6+[6]*5+[4]*4+[(i%15)+7 for i in range(n-15)]
    r=[]
    for i,x in enumerate(a):
        r.append({"session_key":sk,"meeting_key":2000,"date":"2026-10-11T12:%02d:%02d+00:00"%(5+i//2,(i%2)*20),"overtaking_driver_number":x,"overtaken_driver_number":((x+i)%20)+1 if ((x+i)%20)+1!=x else 2,"position":max(1,15-i%14)})
    r.append(dict(r[0]))   # duplicate
    return r
def oc(d): return [c for c in d.of_cagri[getattr(d,"ofbase",0):] if c.startswith("overtakes")]
def hazir(p,w=1100,mod="ok",veri=True,ek=None):
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.sonuc[("17","results")]=yaris(); d.sonuc[("17","sprint")]=yaris(sprint=True); d.of_res[2]=of_sq()
    d.of_ovt={3:ovt(3,20),5:ovt(5),1:ovt(1)} if veri else {}; d.of_ovt_mod=mod
    page,errs,br=ac2(p,d,NOW,w); page.clock.run_for(20000); page.wait_for_timeout(400); return d,page,errs,br
def kutu(page,ad): return page.locator(".gc[data-seans='%s']"%ad)
def ac_g(page,ad):
    k=kutu(page,ad); k.locator(".gc-ac").click(); page.wait_for_timeout(50); page.clock.run_for(6000); page.wait_for_timeout(300); return k
with sync_playwright() as p:
    d,page,errs,br=hazir(p)
    kontrol("G0 açmadan overtakes çağrısı YOK (lazy)", len(oc(d))==0, oc(d))
    kontrol("G1 yalnız Sprint ve Race kartında 'Geçişler' var (FP/SQ/Q'da yok)", page.locator(".gc").count()==2 and kutu(page,"Race").count()==1 and kutu(page,"Sprint").count()==1 and kutu(page,"Qualifying").count()==0 and kutu(page,"SprintQualifying").count()==0 and kutu(page,"FirstPractice").count()==0, page.locator(".gc").count())
    k=ac_g(page,"Race"); tx=k.inner_text().replace("\n"," | ")
    kontrol("G2 Race: açınca tam 1 çağrı, session_key=5", len(oc(d))==1 and "session_key=5" in oc(d)[0], oc(d))
    kontrol("G3 toplam 37 (duplicate dedupe)", "Toplam: 37 geçiş kaydı" in tx and "EN ÇOK GEÇİŞ KAYDI" in tx and "EN ÇOK GEÇİŞ YAPAN" not in tx and "kez geçildi" not in tx, tx[:200])
    pil=k.locator(".gc-pilot"); 
    kontrol("G4 ilk 3 pilot: HAM 6, VER 5, NOR 4 + tam ad", pil.count()==3 and "HAM" in pil.nth(0).inner_text() and "6 geçiş kaydı" in pil.nth(0).inner_text() and "VER" in pil.nth(1).inner_text() and "5 geçiş kaydı" in pil.nth(1).inner_text() and "NOR" in pil.nth(2).inner_text() and "4 geçiş kaydı" in pil.nth(2).inner_text() and "GHAM FHAM" in pil.nth(0).inner_text(), [pil.nth(i).inner_text() for i in range(pil.count())])
    kontrol("G5 ilk görünüm: 3 son geçiş (kronolojik), 'kritik' kelimesi yok", k.locator(".gc-sat").count()==3 and "ritik" not in tx and "SON GEÇİŞLER" in tx, (k.locator(".gc-sat").count(), tx))
    kontrol("G6 satır biçimi 'XXX → YYY' + P'e yükseldi; tur yok → saat", "→" in tx and "yükseldi" in tx and "Tur " not in tx, tx)
    kontrol("G7 kaynak + belge uyarısı", "Kaynak: OpenF1 / Overtakes" in tx and "pit ve ceza kaynaklı" in tx)
    kontrol("G8 'Tüm geçişleri göster (37)'", "Tüm geçişleri göster (37)" in tx, tx[-250:])
    k.locator("[data-gc-act=tumu]").click(); page.wait_for_timeout(100)
    kontrol("G9 tüm geçişler: 37 satır", k.locator(".gc-sat").count()==37, k.locator(".gc-sat").count())
    k.locator(".gc-ac").click(); k.locator(".gc-ac").click(); page.wait_for_timeout(200)
    kontrol("G10 kapat/aç: çift fetch yok", len(oc(d))==1, oc(d))
    page.evaluate("document.dispatchEvent(new Event('f1-feed-guncel'))"); page.wait_for_timeout(200)
    kontrol("G11 yeniden çizimde açık kalır", kutu(page,"Race").locator(".gc-pilot").count()==3)
    ks=ac_g(page,"Sprint")
    kontrol("G12 Sprint: ayrı session_key=3, Toplam 20", any("session_key=3" in c for c in oc(d)) and len(oc(d))==2 and "Toplam: 20" in ks.inner_text(), (oc(d),ks.inner_text()[:80]))
    kontrol("G13 Race Control + Laps + Geçişler birlikte (ayrı kutular)", page.locator(".so[data-seans='Race']").count()==1 and page.locator(".ta[data-seans='Race']").count()==1 and kutu(page,"Race").count()==1)
    ls=page.evaluate("Object.keys(localStorage).filter(k=>k.includes('ovt-')&&!k.includes('oturum')).map(k=>[k,localStorage.getItem(k).length])")
    kontrol("G14 cache: ovt-… ayrı namespace, seans başına < 100 KB", len(ls)==2 and all(n<100000 for _,n in ls) and not any("rc-" in k or "laps-" in k for k,_ in ls), ls)
    ob=len(d.of_cagri); page.clock.run_for(5*60*1000); page.wait_for_timeout(300)
    kontrol("G15 5 dk boşta yeni OpenF1 çağrısı yok (polling yok)", len(d.of_cagri)==ob, len(d.of_cagri)-ob)
    kontrol("G16 hata yok", not errs, errs)
    for tema in ("koyu","acik"):
        page.evaluate("t=>document.documentElement.setAttribute('data-tema',t)",tema)
        kontrol("G17 tema "+tema, page.evaluate("document.documentElement.getAttribute('data-tema')")==tema and kutu(page,"Race").locator(".gc-pilot").first.is_visible())
    page.reload(); page.clock.run_for(8000); page.wait_for_timeout(300); page.evaluate("sekmeAc('hafta')"); page.clock.run_for(20000); page.wait_for_timeout(300)
    n0=len(oc(d)); ac_g(page,"Race")
    kontrol("G18 sayfa yenilenince önbellekten: yeni çağrı yok", len(oc(d))==n0 and kutu(page,"Race").locator(".gc-pilot").count()==3, (n0,oc(d)))
    br.close()
    d,page,errs,br=hazir(p,mod="abort"); k=ac_g(page,"Race"); t=k.inner_text()
    kontrol("G19 ağ hatası: ulaşılamıyor (yayımlanmadı DEĞİL) + yeniden dene", "OpenF1 geçiş verisine şu anda ulaşılamıyor." in t and "henüz yayımlanmadı" not in t and k.locator(".gc-btn").count()==1, t); br.close()
    d,page,errs,br=hazir(p,veri=False); k=ac_g(page,"Race"); t=k.inner_text()
    kontrol("G20 veri boş: 'Geçiş verisi henüz yayımlanmadı.'", "Geçiş verisi henüz yayımlanmadı." in t and "ulaşılamıyor" not in t, t); br.close()
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.of_ovt={5:ovt(5)}
    page,errs,br=ac2(p,d,"2026-10-11T12:30:00Z",1100)
    kontrol("G21 canlı yarışta 'Geçişler' YOK, çağrı yok", kutu(page,"Race").count()==0 and len(oc(d))==0); br.close()
    for w in (390,1100):
        d,page,errs,br=hazir(p,w=w); k=ac_g(page,"Race"); k.locator("[data-gc-act=tumu]").click(); page.wait_for_timeout(100)
        tas=page.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
        kontrol("G22 %dpx: yatay taşma yok, 37 satır"%w, not tas and k.locator(".gc-sat").count()==37, (tas,k.locator(".gc-sat").count())); br.close()
print("\n%d/%d"%(sum(SONUC),len(SONUC))); sys.exit(0 if all(SONUC) else 1)
