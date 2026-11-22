import sys
sys.path.insert(0,"/home/claude/f1-takip/testler/state")
from state_ui_lib import *
from playwright.sync_api import sync_playwright
NOW="2026-10-12T10:00:00Z"
def pit(sk, n=24):
    # SENTETİK. RUS(2) 2.31, NOR(4) 2.44, HAM(3) 2.51 en kısa; sonuncu: VER(6) tur 38 stop 2.72 lane 21.4
    r=[]
    for i in range(n-1):
        dn=7+(i%14)
        r.append({"session_key":sk,"meeting_key":2000,"date":"2026-10-11T12:%02d:%02d+00:00"%(10+i,5),"driver_number":dn,"lap_number":8+i,"lane_duration":21.0+(i%5)*0.3,"stop_duration":3.0+(i%9)*0.1})
    if n<10: r.append({"session_key":sk,"meeting_key":2000,"date":"2026-10-11T13:30:00+00:00","driver_number":6,"lap_number":38,"lane_duration":21.4,"stop_duration":2.72}); return r
    r[0].update({"driver_number":2,"stop_duration":2.31}); r[1].update({"driver_number":4,"stop_duration":2.44}); r[2].update({"driver_number":3,"stop_duration":2.51})
    r[3].update({"stop_duration":None}); r[4].update({"lane_duration":None})          # eksik stop / eksik lane
    r[5].pop("stop_duration"); r[6].pop("lane_duration")                              # alan hiç yok
    r[7].update({"lap_number":None})                                                  # tur yok
    r.append({"session_key":sk,"meeting_key":2000,"date":"2026-10-11T13:30:00+00:00","driver_number":6,"lap_number":38,"lane_duration":21.4,"stop_duration":2.72})
    r.append(dict(r[0]))   # duplicate
    return r
def pc(d): return [c for c in d.of_cagri[getattr(d,"ofbase",0):] if c.startswith("pit")]
def hazir(p,w=1100,mod="ok",veri=True):
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.sonuc[("17","results")]=yaris(); d.sonuc[("17","sprint")]=yaris(sprint=True); d.of_res[2]=of_sq()
    d.of_pit={3:pit(3,6),5:pit(5),1:pit(1)} if veri else {}; d.of_pit_mod=mod
    page,errs,br=ac2(p,d,NOW,w); page.clock.run_for(20000); page.wait_for_timeout(400); return d,page,errs,br
def kutu(page,ad): return page.locator(".pt[data-seans='%s']"%ad)
def ac_p(page,ad):
    k=kutu(page,ad); k.locator(".pt-ac").click(); page.wait_for_timeout(50); page.clock.run_for(6000); page.wait_for_timeout(300); return k
with sync_playwright() as p:
    d,page,errs,br=hazir(p)
    kontrol("T0 açmadan pit çağrısı YOK (lazy)", len(pc(d))==0, pc(d))
    kontrol("T1 yalnız Sprint ve Race kartında 'Pit Stoplar' var", page.locator(".pt").count()==2 and kutu(page,"Race").count()==1 and kutu(page,"Sprint").count()==1 and kutu(page,"Qualifying").count()==0 and kutu(page,"SprintQualifying").count()==0 and kutu(page,"FirstPractice").count()==0, page.locator(".pt").count())
    k=ac_p(page,"Race"); tx=k.inner_text().replace("\n"," | ")
    kontrol("T2 Race: açınca tam 1 çağrı, session_key=5", len(pc(d))==1 and "session_key=5" in pc(d)[0], pc(d))
    kontrol("T3 'Toplam: 24 pit kaydı' (duplicate dedupe)", "Toplam: 24 pit kaydı" in tx, tx[:120])
    pil=k.locator(".pt-pilot"); pt=[pil.nth(i).inner_text().replace("\n"," ") for i in range(pil.count())]
    kontrol("T4 en kısa stop: RUS 2.31, NOR 2.44, HAM 2.51 sn", len(pt)==3 and "RUS" in pt[0] and "2.31 sn" in pt[0] and "NOR" in pt[1] and "2.44 sn" in pt[1] and "HAM" in pt[2] and "2.51 sn" in pt[2], pt)
    kontrol("T5 etiket 'EN KISA STOP SÜRESİ' ve 'SON PİT STOPLAR'", "EN KISA STOP SÜRESİ" in tx and "SON PİT STOPLAR" in tx, tx)
    son=k.locator(".pt-sat"); s0=[son.nth(i).inner_text().replace("\n"," ") for i in range(son.count())]
    kontrol("T6 ilk görünüm 3 son pit; sonuncu: Tur 38 · VER Stop: 2.72 sn Pit lane: 21.4 sn", son.count()==3 and "Tur 38" in s0[2] and "VER" in s0[2] and "Stop: 2.72 sn" in s0[2] and "Pit lane: 21.4 sn" in s0[2], s0)
    kontrol("T7 kaynak + açıklama (stop ≠ pit lane)", "Kaynak: OpenF1 / Pit" in tx and "Stop = pit kutusunda durulan süre" in tx and "Pit lane = pit lane'de geçen toplam süre" in tx)
    kontrol("T8 'Tüm pit stopları göster (24)'", "Tüm pit stopları göster (24)" in tx, tx[-250:])
    k.locator("[data-pt-act=tumu]").click(); page.wait_for_timeout(100)
    kontrol("T9 tüm kayıtlar: 24 satır", k.locator(".pt-sat").count()==24, k.locator(".pt-sat").count())
    al=[k.locator(".pt-sat").nth(i).inner_text().replace("\n"," ") for i in range(24)]
    kontrol("T10 eksik stop → 'Stop süresi yok'; eksik lane → 'Pit lane süresi yok' (uydurma süre yok)", sum("Stop süresi yok" in x for x in al)==2 and sum("Pit lane süresi yok" in x for x in al)==2, [x for x in al if "yok" in x])
    kontrol("T11 tur yoksa saat gösterilir (Tur etiketi yok)", any(x.startswith("15:") or x.startswith("16:") for x in al) and sum(x.startswith("Tur ") for x in al)==23, al[:10])
    k.locator(".pt-ac").click(); k.locator(".pt-ac").click(); page.wait_for_timeout(200)
    kontrol("T12 kapat/aç: çift fetch yok", len(pc(d))==1, pc(d))
    page.evaluate("document.dispatchEvent(new Event('f1-feed-guncel'))"); page.wait_for_timeout(200)
    kontrol("T13 yeniden çizimde açık kalır", kutu(page,"Race").locator(".pt-pilot").count()==3)
    ks=ac_p(page,"Sprint")
    kontrol("T14 Sprint: ayrı session_key=3, Toplam 6", any("session_key=3" in c for c in pc(d)) and len(pc(d))==2 and "Toplam: 6 pit kaydı" in ks.inner_text(), (pc(d),ks.inner_text()[:80]))
    kontrol("T15 Race Control + Laps + Geçişler + Pit birlikte, ayrı kutular", all(page.locator(s+"[data-seans='Race']").count()==1 for s in (".so",".ta",".gc",".pt")))
    ls=page.evaluate("Object.keys(localStorage).filter(k=>k.includes('pit-')&&!k.includes('oturum')).map(k=>[k,localStorage.getItem(k).length])")
    kontrol("T16 cache: pit-… ayrı namespace, seans başına < 60 KB", len(ls)==2 and all(n<60000 for _,n in ls) and not any(("rc-" in k or "laps-" in k or "ovt-" in k) for k,_ in ls), ls)
    ob=len(d.of_cagri); page.clock.run_for(5*60*1000); page.wait_for_timeout(300)
    kontrol("T17 5 dk boşta yeni OpenF1 çağrısı yok (polling yok)", len(d.of_cagri)==ob, len(d.of_cagri)-ob)
    kontrol("T18 hata yok", not errs, errs)
    for tema in ("koyu","acik"):
        page.evaluate("t=>document.documentElement.setAttribute('data-tema',t)",tema)
        kontrol("T19 tema "+tema, page.evaluate("document.documentElement.getAttribute('data-tema')")==tema and kutu(page,"Race").locator(".pt-pilot").first.is_visible())
    page.reload(); page.clock.run_for(8000); page.wait_for_timeout(300); page.evaluate("sekmeAc('hafta')"); page.clock.run_for(20000); page.wait_for_timeout(300)
    n0=len(pc(d)); ac_p(page,"Race")
    kontrol("T20 sayfa yenilenince önbellekten: yeni çağrı yok", len(pc(d))==n0 and kutu(page,"Race").locator(".pt-pilot").count()==3, (n0,pc(d)))
    br.close()
    d,page,errs,br=hazir(p,mod="abort"); k=ac_p(page,"Race"); t=k.inner_text()
    kontrol("T21 ağ hatası: ulaşılamıyor (yayımlanmadı DEĞİL) + yeniden dene", "OpenF1 pit verisine şu anda ulaşılamıyor." in t and "henüz yayımlanmadı" not in t and k.locator(".pt-btn").count()==1, t); br.close()
    d,page,errs,br=hazir(p,veri=False); k=ac_p(page,"Race"); t=k.inner_text()
    kontrol("T22 veri boş: 'Pit verisi henüz yayımlanmadı.'", "Pit verisi henüz yayımlanmadı." in t and "ulaşılamıyor" not in t, t); br.close()
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.of_pit={5:pit(5)}
    page,errs,br=ac2(p,d,"2026-10-11T12:30:00Z",1100)
    kontrol("T23 canlı yarışta 'Pit Stoplar' YOK, çağrı yok", kutu(page,"Race").count()==0 and len(pc(d))==0); br.close()
    for w in (390,1100):
        d,page,errs,br=hazir(p,w=w); k=ac_p(page,"Race"); k.locator("[data-pt-act=tumu]").click(); page.wait_for_timeout(100)
        tas=page.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
        kontrol("T24 %dpx: yatay taşma yok, 24 satır"%w, not tas and k.locator(".pt-sat").count()==24, (tas,k.locator(".pt-sat").count())); br.close()
print("\n%d/%d"%(sum(SONUC),len(SONUC))); sys.exit(0 if all(SONUC) else 1)
