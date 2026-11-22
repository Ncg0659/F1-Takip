# Race Feed v1 — BUGÜN: son 5 önemli not + TÜMÜNÜ GÖSTER (EN etiketi, tekrar yok); HAFTA SONU / Yarış Günü: 5 not + TÜMÜNÜ GÖSTER.
import sys, re
sys.path.insert(0,'.')
exec(open('bugun_v3_test.py').read().split("\nwith sync_playwright")[0])
def E(id,ts,cat,tr,**k): return dict(ev(id,ts,cat,tr),originalText=k.pop("orig","x"),**k)
FEED=[dict(ev("r0","2026-10-11T12:02:00Z","RESTART","Yarış başladı."),originalText="Lights out")]
for i in range(1,8):   # 7 önemli (Türkçe) not
    FEED.append(E("p%d"%i,"2026-10-11T12:%02d:00Z"%(5+i*2),"PENALTY" if i%2 else "PIT","Önemli not %d"%i))
FEED.append(E("en1","2026-10-11T12:21:00Z","INCIDENT","Contact at turn four between two midfield cars, no action",translationFallback=True,orig="Contact at turn four between two midfield cars, no action"))
FEED.append(E("en2","2026-10-11T12:22:00Z","TECHNICAL","Gearbox issue reported for car 23",translationFallback=True,orig="Gearbox issue reported for car 23"))
FEED.append(E("p7b","2026-10-11T12:19:30Z","PENALTY","Önemli not 7"))                          # p7 ile aynı metin, 5 dk içinde → tekrar
FEED.append(E("p1","2026-10-11T12:07:00Z","PENALTY","Önemli not 1"))                              # aynı kimlik → tekrar
FEED.append(dict(E("u1","2026-10-11T12:23:00Z","PENALTY","Belirsiz not"),status="unconfirmed"))    # doğrulanmamış → hiç gösterilmez
LI="[...document.querySelectorAll('#bg-kok .bg-feed li')].map(l=>l.textContent)"
with sync_playwright() as p:
    for w,tema in ((390,"koyu"),(1100,"acik")):
        pg,errs,c,b=ac(p,"2026-10-11T12:40:00Z",w=w,tema=tema,feed=FEED)
        k=pg.evaluate(LI); d=pg.locator("#bg-kok [data-feed-hepsi]")
        kontrol("F1 %d/%s kapalı: son 5 önemli not, en yeni üstte"%(w,tema), len(k)==5 and "Önemli not 7" in k[0] and all("Önemli not" in x or "Yarış" in x for x in k), k)
        kontrol("F2 %d/%s kapalı: ham İngilizce yok, EN etiketi yok"%(w,tema), not any("Contact" in x or "Gearbox" in x for x in k) and pg.locator("#bg-kok .bg-feed-en").count()==0, k)
        kontrol("F3 %d/%s 'TÜMÜNÜ GÖSTER' düğmesi var (aria-expanded=false)"%(w,tema), d.count()==1 and d.inner_text().strip()=="TÜMÜNÜ GÖSTER" and d.get_attribute("aria-expanded")=="false")
        d.click(); ilerle(pg,1)
        t=pg.evaluate(LI); d=pg.locator("#bg-kok [data-feed-hepsi]")
        kontrol("F4 %d/%s açık: tüm notlar (8 Türkçe + 2 EN = 10), tekrar yok"%(w,tema), len(t)==10 and len(set(t))==10 and sum(1 for x in t if "Önemli not 7" in x)==1 and sum(1 for x in t if "Önemli not 1" in x)==1, t)
        kontrol("F5 %d/%s açık: çevirisi olmayan not özgün metniyle + EN etiketi"%(w,tema), pg.locator("#bg-kok .bg-feed-en").count()==2 and any("EN Contact at turn four" in x for x in t), t)
        kontrol("F6 %d/%s doğrulanmamış not hiçbir durumda yok"%(w,tema), not any("Belirsiz" in x for x in k+t))
        kontrol("F7 %d/%s düğme 'DARALT' (aria-expanded=true), odakta"%(w,tema), d.inner_text().strip()=="DARALT" and d.get_attribute("aria-expanded")=="true" and pg.evaluate("document.activeElement && document.activeElement.hasAttribute('data-feed-hepsi')"))
        ilerle(pg,4); kontrol("F8 %d/%s saat ilerlerken açık kalır"%(w,tema), len(pg.evaluate(LI))==10)
        kontrol("F9 %d/%s yatay taşma 0"%(w,tema), pg.evaluate("document.documentElement.scrollWidth")<=w)
        d.click(); ilerle(pg,1)
        kontrol("F10 %d/%s DARALT → yine 5 not"%(w,tema), len(pg.evaluate(LI))==5)
        kontrol("F11 %d/%s hata yok"%(w,tema), not errs, errs); b.close()
    # az not: düğme yok
    pg,errs,c,b=ac(p,"2026-10-11T12:40:00Z",w=390,feed=FEED[:3])
    kontrol("F12 not sayısı ≤5 ve gizli not yok → düğme yok", pg.locator("#bg-kok [data-feed-hepsi]").count()==0 and len(pg.evaluate(LI))==3); b.close()
    # HAFTA SONU / Yarış Günü
    pg,errs,c,b=ac(p,"2026-10-11T12:40:00Z",w=390,feed=FEED)
    pg.evaluate("sekmeAc('gun')"); ilerle(pg,6)
    n=pg.locator("#gun-notlar .tl-oge").count(); dg=pg.locator("#gun-notlar [data-gun-feed]")
    kontrol("F13 Yarış Günü Race Feed: 5 önemli not + 'TÜMÜNÜ GÖSTER'", n==5 and dg.count()==1 and dg.inner_text().strip()=="TÜMÜNÜ GÖSTER", (n, dg.count() and dg.inner_text()))
    dg.click(); ilerle(pg,2)
    kontrol("F14 Yarış Günü açık: tüm notlar, EN etiketi görünür", pg.locator("#gun-notlar .tl-oge").count()>5 and pg.locator("#gun-notlar .tl-oge .rozet", has_text="EN").count()>=1, pg.locator("#gun-notlar .tl-oge").count())
    kontrol("F15 Yarış Günü taşma 0, hata yok", pg.evaluate("document.documentElement.scrollWidth")<=390 and not errs, errs); b.close()
print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
