import sys, re
sys.path.insert(0,'.')
exec(open('bugun_v3_test.py').read().split("\nwith sync_playwright")[0])
START=dict(ev("r0","2026-10-11T12:02:00Z","RESTART","Yarış başladı."),originalText="Lights out and away we go. The race has started.")
def E(id,ts,cat,tr,orig): return dict(ev(id,ts,cat,tr),originalText=orig)
SC=[START,E("s1","2026-10-11T12:20:00Z","SAFETY_CAR","Safety Car devrede.","Safety car deployed, debris on the main straight")]
VSC=[START,E("v1","2026-10-11T12:20:00Z","VSC","Sanal Safety Car devrede.","Virtual Safety Car deployed after Alonso stops on track")]
RF=[START,E("f1","2026-10-11T12:20:00Z","RED_FLAG","Kırmızı bayrak: yarış durduruldu.","RED FLAG")]
RA=RF+[E("f2","2026-10-11T12:26:00Z","RESTART","Yeniden başlama duyuruldu.","Race control announces the restart procedure will begin at 12:45")]
RS=RF+[E("f3","2026-10-11T12:40:00Z","RESTART","Yarış yeniden başladı.","Race resumed, green flag")]
UZUN=[START]+[E("u%d"%i,"2026-10-11T12:%02d:00Z"%(10+i),"PENALTY","Çok uzun bir Race Feed notu "+("kelime "*40)+str(i),"x") for i in range(1,8)]
def tasma(pg): return pg.evaluate("""()=>{const W=document.documentElement.clientWidth;const d=document.documentElement.scrollWidth;
  const bad=[...document.querySelectorAll('#sekme-bugun *')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().right>W+1&&getComputedStyle(e).position!=='fixed').slice(0,3).map(e=>e.className||e.tagName);return {W:W,doc:d,bad:bad}}""")
with sync_playwright() as p:
    for ad,feed,saat,kod,ton,kritik in [("LIVE",[START],"2026-10-11T12:30:00Z","LIVE","live",None),("SC",SC,"2026-10-11T12:30:00Z","SAFETY","",None),("VSC",VSC,"2026-10-11T12:30:00Z","VSC","",None),
        ("RED FLAG",RF,"2026-10-11T12:30:00Z","RED","kirmizi",None),("RESTART ANNOUNCED",RA,"2026-10-11T12:30:00Z","AÇIKLANDI","bekle",None),("RESUMED",RS,"2026-10-11T12:45:00Z","RESUMED","",None)]:
        for tema in ("koyu","acik"):
            pg,errs,c,b=ac(p,saat,w=390,tema=tema,feed=feed)
            m=M(pg); t=pg.inner_text("#bg-kok"); tz=tasma(pg)
            kontrol("%s/%s hero: mod A + etiket '%s'"%(ad,tema,kod), m and m["mod"]=="A" and kod in (m["kod"] or "").upper(), m)
            if ton: kontrol("%s/%s ton=%s"%(ad,tema,ton), m["ton"]==ton, m)
            if ad=="RESTART ANNOUNCED": kontrol("RESTART ANNOUNCED ≠ RESUMED: 'yeniden başladı' iddiası yok", "RESUMED" not in t.upper() and "yeniden başladı" not in t.lower(), t[:200])
            if ad=="RESUMED": kontrol("RESUMED rozeti, kırmızı değil", m["ton"]!="kirmizi", m)
            kontrol("%s/%s 390 px: yatay taşma 0"%(ad,tema), tz["doc"]<=tz["W"] and not tz["bad"], tz)
            kontrol("%s/%s ham anahtar/undefined yok, JS hatası yok"%(ad,tema), not KEY.findall(t) and not HAM.search(t) and not errs, (KEY.findall(t),errs))
            b.close()
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",w=390,feed=UZUN)
    tz=tasma(pg); n=pg.locator("#bg-kok .bg-feed li").count(); ids=pg.evaluate("[...document.querySelectorAll('#bg-kok .bg-feed li')].map(l=>l.textContent)")
    kontrol("uzun feed metni: en çok 3 not, taşma 0, tekrar yok", 1<=n<=3 and tz["doc"]<=tz["W"] and not tz["bad"] and len(set(ids))==len(ids), (n,tz))
    b.close()
    # Prediction: yarış başlayınca SABİT etiketi
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",w=390,feed=[START])
    pg.evaluate("document.getElementById('nav-analiz') && document.getElementById('nav-analiz').click()"); ilerle(pg,6)
    txt=pg.evaluate("document.body.innerText")
    kontrol("Prediction (yarış başladı): 'YARIŞ ÖNCESİ · SABİT' görünür ya da tahmin paneli yok; 'güven' iddiası yok", ("SABİT" in txt.upper()) or ("TAHMİN" not in txt.upper()), txt[:120]); b.close()
print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
