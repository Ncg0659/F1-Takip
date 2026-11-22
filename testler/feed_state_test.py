# Race Feed ↔ race-state çelişki denetimi (BUGÜN hero + Race Feed aynı şeyi söylemeli). Yeni feed kaynağı yok; fixture olaylar.
import sys
sys.path.insert(0,'.')
exec(open('bugun_v3_test.py').read().split("\nwith sync_playwright")[0])
def E(id,ts,cat,tr,o="x",**k): return dict(ev(id,ts,cat,tr),originalText=o,**k)
ST=E("r0","2026-10-11T12:02:00Z","RESTART","Yarış başladı.","Lights out and away we go")
RF=E("f1","2026-10-11T12:20:00Z","RED_FLAG","Kırmızı bayrak: yarış durduruldu.","RED FLAG")
LI="[...document.querySelectorAll('#bg-kok .bg-feed li')].map(l=>l.textContent)"
S=[
 ("E1 doğrulanmamış RED FLAG: durum LIVE kalır, not gösterilmez", [ST,dict(RF,status="unconfirmed")], lambda m,l: m["kod"]=="LIVE" and m["ton"]=="live" and not any("Kırmızı" in x for x in l)),
 ("E2 sıra dışı zaman damgası: son olay RED FLAG → RED FLAG", [ST,E("x1","2026-10-11T12:15:00Z","RESTART","Yarış yeniden başladı.","Race resumed, green flag"),RF], lambda m,l: m["kod"]=="RED FLAG" and m["ton"]=="kirmizi" and "Kırmızı" in l[0]),
 ("E3 sıralamadaki RED FLAG yarış durumunu etkilemez (feed yok → LIVE TAHMİNİ)", [E("q1","2026-10-10T14:20:00Z","RED_FLAG","Kırmızı bayrak (sıralama).","RED FLAG")], lambda m,l: m["kod"]=="LIVE TAHMİNİ" and m["ton"]=="bekle"),
 ("E4 aynı RED FLAG iki kez: tek not, RED FLAG", [ST,RF,E("f1b","2026-10-11T12:20:30Z","RED_FLAG","Kırmızı bayrak: yarış durduruldu.","RED FLAG")], lambda m,l: m["kod"]=="RED FLAG" and sum(1 for x in l if "Kırmızı" in x)==1),
 ("E5 feed yok: LIVE TAHMİNİ (düz LIVE değil, kırmızı değil)", [], lambda m,l: m["kod"]=="LIVE TAHMİNİ" and m["ton"]=="bekle" and not l),
 ("E6 duyuru → devam: RESUMED, feed'de ikisi de ayrı", [ST,RF,E("a1","2026-10-11T12:24:00Z","RESTART","Yeniden başlama duyuruldu.","Race will restart at 12:28"),E("a2","2026-10-11T12:28:00Z","RESTART","Yarış yeniden başladı.","Race resumed")], lambda m,l: m["kod"]=="RESUMED" and m["ton"]!="kirmizi" and "yeniden başladı" in l[0] and any("duyuruldu" in x for x in l)),
 ("E7 yalnız duyuru: RESTART ANNOUNCED (RESUMED değil)", [ST,RF,E("a1","2026-10-11T12:24:00Z","RESTART","Yeniden başlama duyuruldu.","Race will restart at 12:40")], lambda m,l: "AÇIKLANDI" in m["kod"] and "RESUMED" not in m["kod"] and m["ton"]=="bekle"),
 ("E8 gelecekteki olay (saat henüz gelmedi) durumu değiştirmez", [ST,E("z1","2026-10-11T13:40:00Z","RED_FLAG","Kırmızı bayrak.","RED FLAG")], lambda m,l: m["kod"]=="LIVE"),
 ("E9 SC ardından 'SC bu tur pite giriyor': kırmızı değil", [ST,E("s1","2026-10-11T12:18:00Z","SAFETY_CAR","Safety Car devrede.","Safety car deployed"),E("s2","2026-10-11T12:24:00Z","SAFETY_CAR","Safety Car bu tur pite giriyor.","SAFETY CAR IN THIS LAP")], lambda m,l: m["ton"]!="kirmizi"),
]
with sync_playwright() as p:
    for ad,f,kos in S:
        pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",w=390,feed=f)
        m=M(pg); l=pg.evaluate(LI)
        kontrol(ad, bool(m) and m["mod"]=="A" and kos(m,l), (m,l[:3]))
        kontrol(ad[:2]+" taşma 0, hata yok", pg.evaluate("document.documentElement.scrollWidth")<=390 and not errs, errs); b.close()
print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
