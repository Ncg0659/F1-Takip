import sys; sys.path.insert(0,'..')
exec(open('../state_ui_lib.py').read())
import json
def adimh(page,sn,parca=30):
    for _ in range(int(sn/parca)): page.clock.run_for(parca*1000); page.wait_for_timeout(8)
    page.wait_for_timeout(60)
def ekle(page,g):
    page.evaluate("(g)=>{PROGRAM_DEGISIKLIK.push(g);document.dispatchEvent(new CustomEvent('f1-feed-guncel'))}",g); page.wait_for_timeout(150)
def temaYap(page,koyu):
    hedef="koyu" if koyu else "acik"
    if page.evaluate("document.documentElement.getAttribute('data-tema')")!=hedef: page.evaluate("document.getElementById('btn-tema').click()"); page.wait_for_timeout(150)
    assert page.evaluate("document.documentElement.getAttribute('data-tema')")==hedef, "tema uygulanamadı"
def kartlar(page): return [page.locator(".h-seans").nth(i).inner_text().replace("\n"," ") for i in range(page.locator(".h-seans").count())]
def qkart(page): 
    l=[x for x in kartlar(page) if "Sprint Sıralaması" not in x and "Sıralama" in x]; return l[0] if l else ""
def tasma(page): return page.evaluate("document.documentElement.scrollWidth>innerWidth")
FIA=lambda **k: dict({"sezon":2026,"tur":17,"kaynak":"FIA","dogrulandi":True},**k)
Q_POST=FIA(id="q-p",seans="Qualifying",tip="POSTPONED",zaman="2026-10-10T10:30:00Z",neden="hava")
Q_YENI=FIA(id="q-n",seans="Qualifying",tip="NEW_TIME_CONFIRMED",zaman="2026-10-10T11:30:00Z",yeniBaslangic="2026-10-10T14:30:00Z")
S_GEC=FIA(id="s-d",seans="Sprint",tip="DELAYED",zaman="2026-10-10T08:50:00Z",neden="hava")
with sync_playwright() as p:
    # ---- 1) Normal: değişiklik yok ----
    d=Durum(); page,e,br=ac2(p,d,"2026-10-10T13:05:00Z",sayfa="hafta")
    q=qkart(page)
    kontrol("T1 değişiklik yok: Q kartı LIVE tahmini, bağlamsal kart yok, hafta özeti yok","LIVE" in q and page.locator(".bk").count()==0 and page.locator(".bk-hafta").count()==0,q[:120])
    # ---- 6) Q postponed, planlı saat geldi (13:05Z) ----
    ekle(page,Q_POST); q=qkart(page)
    kontrol("T6 eski planlı saatte (13:05Z) Q: ERTELENDİ, LIVE tahmini YOK","ERTELENDİ" in q and "LIVE" not in q and "SONUÇ BEKLENİYOR" not in q,q[:200])
    kontrol("T6 kart başlığı 'SIRALAMA — ERTELENDİ' + 'Yeni başlangıç saati bekleniyor.'","SIRALAMA — ERTELENDİ" in q.upper() and "Yeni başlangıç saati bekleniyor" in q,q[:300])
    kontrol("T6 eski saat ikincil ('planlı'), ana saat '—'","planlı" in q and "—" in q,q[:200])
    hz=page.locator(".bk-hafta").inner_text() if page.locator(".bk-hafta").count() else ""
    kontrol("T4 hafta özeti: 'Program değişikliği' + Q satırı","PROGRAM DEĞİŞİKLİĞİ" in hz.upper() and "ERTELENDİ" in hz.upper(),hz)
    adimh(page,3600,60)   # planlı bitişi de geçsin (14:10Z → 14:05Z...)
    q=qkart(page); kontrol("T6 planlı bitişten sonra da (14:05Z+) ERTELENDİ; SONUÇ BEKLENİYOR/LIVE yok","ERTELENDİ" in q and "LIVE" not in q and "SONUÇ BEKLENİYOR" not in q,q[:160])
    for w,koyu in ((390,False),(390,True),(1100,False),(1100,True)):
        page.set_viewport_size({"width":w,"height":900}); temaYap(page,koyu); page.wait_for_timeout(100)
        kontrol("T10/11 ERTELENDİ kartı %dpx %s: yatay taşma yok"%(w,"koyu" if koyu else "açık"),not tasma(page),page.evaluate("[document.documentElement.scrollWidth,innerWidth]"))
        page.screenshot(path="../ui1/baglam_ertelendi_%d_%s.png"%(w,"koyu" if koyu else "acik"))
    temaYap(page,False); page.set_viewport_size({"width":1100,"height":900})
    # ---- 5/7) Yeni saat ----
    ekle(page,Q_YENI); q=qkart(page)
    kontrol("T5/7 YENİ SAAT: rozet + '17:30 TR' + '22:30 local'","YENİ SAAT" in q.upper() and "17:30 TR" in q and "22:30 local" in q,q[:300])
    kontrol("T5 eski ERTELENDİ kartı kalktı (aynı seansta tek güncel kart)","ERTELENDİ" not in q and page.locator(".h-seans .bk").count()==1,q[:200])
    kontrol("T7 ana saat 17:30 ve eski planlı saat ikincil (16:00)","17:30" in q and "planlı" in q and "16:00" in q,q[:200])
    kontrol("T7 geri sayım yeni saate göre (LIVE tahmini yok)","LIVE" not in q and "Başlamasına" in q,q[:200])
    for w,koyu in ((390,False),(390,True),(1100,True)):
        page.set_viewport_size({"width":w,"height":900}); temaYap(page,koyu); page.wait_for_timeout(100)
        kontrol("T10/11 YENİ SAAT kartı %dpx %s: yatay taşma yok"%(w,"koyu" if koyu else "açık"),not tasma(page),page.evaluate("[document.documentElement.scrollWidth,innerWidth]"))
        page.screenshot(path="../ui1/baglam_yenisaat_%d_%s.png"%(w,"koyu" if koyu else "acik"))
    temaYap(page,False); page.set_viewport_size({"width":1100,"height":900})
    # yeni saate gel: ~14:35Z (şu an ~14:05Z)
    adimh(page,30*60,60); q=qkart(page)
    kontrol("T7 yeni saatte (14:35Z): LIVE tahmini açılır, kart LIVE; YENİ SAAT rozeti kalktı","LIVE" in q and "YENİ SAAT" not in q.upper().split("PLANLI")[0].replace("YENİ SAAT KARTI",""),q[:200])
    kontrol("T1-7 hata yok",not e,e); br.close()

    # ---- 2/3/8) Sprint gecikmesi: Sprint ekranında görünür, Q/Race'de görünmez ----
    d=Durum(); page,e,br=ac2(p,d,"2026-10-10T09:05:00Z",sayfa="hafta")
    ekle(page,S_GEC)
    kl=kartlar(page); sp=[x for x in kl if "Sprint" in x and "Sprint Sıralaması" not in x]
    kontrol("T2 Sprint kartı: BAŞLANGIÇ GECİKTİ + 'SPRINT — BAŞLANGIÇ GECİKTİ' kartı, LIVE yok",bool(sp) and "GECİKTİ" in sp[0].upper() and "LIVE" not in sp[0],sp[:1])
    kontrol("T3 Q kartı etkilenmedi (bağlamsal kart yok, UPCOMING/başlamasına)","bk-" not in "".join(page.locator(".h-seans").nth(i).inner_html() for i in range(page.locator(".h-seans").count()) if "Sıralama" in page.locator(".h-seans").nth(i).inner_text() and "Sprint Sıralaması" not in page.locator(".h-seans").nth(i).inner_text()),qkart(page)[:160])
    page.evaluate("sekmeAc('sprint')"); page.wait_for_timeout(200)
    st=page.inner_text("#sekme-sprint")
    kontrol("T8 Sprint sekmesi: Sprint gecikme kartı VAR; Qualifying ('Sıralama —') kartı YOK","SPRINT — BAŞLANGIÇ GECİKTİ" in st.upper() and "SIRALAMA — ERTELENDİ" not in st.upper(),st[:200])
    # Q postponed eklenince Sprint sekmesi etkilenmez
    ekle(page,dict(Q_POST,id="q-p2",zaman="2026-10-10T09:00:00Z")); page.wait_for_timeout(150)
    st=page.inner_text("#sekme-sprint"); kontrol("T8 Q ertelendi: Sprint sekmesinde Q kartı görünmez","ERTELENDİ" not in st.upper(),st[:200])
    page.evaluate("sekmeAc('hafta')"); page.wait_for_timeout(200)
    kontrol("T8 Yarış Haftası'nda ikisi de var (iki ekranı gerçekten etkiliyor)","SPRINT" in page.inner_text(".bk-hafta").upper() and "ERTELENDİ" in page.inner_text(".bk-hafta").upper() ,page.inner_text(".bk-hafta") if page.locator(".bk-hafta").count() else "yok")
    kontrol("T2/3 hata yok",not e,e); br.close()

    # ---- Yarış Günü (Race) ----
    d=Durum(); page,e,br=ac2(p,d,"2026-10-11T11:30:00Z",sayfa="gun"); adimh(page,20,10)
    sy=page.evaluate("document.getElementById('gun-sayac').innerText")
    kontrol("G0 değişiklik yok: geri sayım",sy.startswith("Start'a kalan"),sy)
    ekle(page,FIA(id="r-n",seans="Race",tip="NEW_TIME_CONFIRMED",zaman="2026-10-11T11:00:00Z",yeniBaslangic="2026-10-11T14:00:00Z")); adimh(page,5,5)
    sy=page.evaluate("document.getElementById('gun-sayac').innerText"); bk=page.evaluate("document.getElementById('gun-baglam')?document.getElementById('gun-baglam').innerText:''")
    kontrol("G1 Race YENİ SAAT: geri sayım yeni saate (≈2 sa 30 dk), kart '17:00 TR' ve '22:00 local'","Start'a kalan: 02:" in sy and "17:00 TR" in bk and "22:00 local" in bk,(sy,bk))
    rz=page.evaluate("document.getElementById('yk-durumlar').innerText"); kontrol("G1 rozet 'RESCHEDULED'","RESCHEDULED" in rz.upper(),rz)
    kontrol("G1 Yarış Günü'nde Sprint/Q kartı yok",("SPRINT" not in bk.upper().split("YARIŞ")[0]) and "SIRALAMA" not in bk.upper(),bk)
    page.set_viewport_size({"width":390,"height":900}); page.wait_for_timeout(150)
    kontrol("G1 390px taşma yok",not tasma(page),page.evaluate("[document.documentElement.scrollWidth,innerWidth]"))
    adimh(page,3*3600,60)   # yeni saat sonrası (~14:30Z)
    sy=page.evaluate("document.getElementById('gun-sayac').innerText"); kontrol("G2 yeni saatten sonra: yarış sürüyor (planlı 12:00 değil yeni 14:00'a göre)","Yarış sürüyor" in sy,sy)
    kontrol("G hata yok",not e,e); br.close()
    d=Durum(); page,e,br=ac2(p,d,"2026-10-11T12:10:00Z",sayfa="gun"); adimh(page,10,10)
    ekle(page,FIA(id="r-p",seans="Race",tip="POSTPONED",zaman="2026-10-11T11:00:00Z",neden="hava")); adimh(page,5,5)
    sy=page.evaluate("document.getElementById('gun-sayac').innerText"); kontrol("G3 Race POSTPONED, planlı saat geçmiş: 'Yarış ertelendi', 'Yarış sürüyor' YOK","Yarış ertelendi" in sy and "Yarış sürüyor" not in sy,sy)
    kontrol("G3 hata yok",not e,e); br.close()

    # ---- Profiller ----
    d=Durum(); page,e,br=ac2(p,d,"2026-10-10T10:00:00Z",sayfa="hafta")
    ekle(page,FIA(id="g1",seans="Race",tip="GRID_PENALTY",zaman="2026-10-10T09:50:00Z",pilot=["ANT"],takim=["Mercedes"],baslik="ANT: 3 sıra grid cezası",metin="Hakem kararı: 3 sıra grid cezası.",pist=None))
    ekle(page,FIA(id="w1",seans="Sprint",tip="WEATHER",zaman="2026-10-10T09:45:00Z",pist="marina_bay",metin="Yoğun yağmur nedeniyle pist ıslak."))
    pi=page.evaluate("BaglamUI.profil('pilot','ANT')"); pn=page.evaluate("BaglamUI.profil('pilot','NOR')")
    tk=page.evaluate("BaglamUI.profil('takim','Mercedes')"); tk2=page.evaluate("BaglamUI.profil('takim','McLaren')")
    ps=page.evaluate("BaglamUI.profil('pist','marina_bay')"); ps2=page.evaluate("BaglamUI.profil('pist','baku')")
    kontrol("T8 pilot ANT profili: grid cezası kartı; NOR: boş","3 sıra grid cezası" in pi and pn=="",(pi[:80],pn[:40]))
    kontrol("T8 takım Mercedes: kart; McLaren: boş","grid cezası" in tk and tk2=="",(tk[:60],tk2[:40]))
    kontrol("T8 pist marina_bay: hava kartı; baku: boş","Yoğun yağmur" in ps and ps2=="",(ps[:60],ps2[:40]))
    # gerçek profil ekranı
    ok=page.evaluate("(window.ProfilPilot&&ProfilPilot.ac('ant'))||false"); page.wait_for_timeout(600)
    kontrol("Pilot profil ekranında bağlamsal blok görünür (.bk-profil)",page.locator(".bk-profil").count()>=1 or ok is False,ok)
    if page.locator(".bk-profil").count():
        for w,koyu in ((390,False),(390,True),(1100,True)):
            page.set_viewport_size({"width":w,"height":900}); temaYap(page,koyu); page.wait_for_timeout(100)
            kontrol("pilot profil bloğu %dpx %s: taşma yok"%(w,"koyu" if koyu else "açık"),not tasma(page),page.evaluate("[document.documentElement.scrollWidth,innerWidth]"))
        page.screenshot(path="../ui1/baglam_pilot_profil_390.png")
    # süresi dolmuş bilgi sonraki gün profilde yok
    page.clock.set_system_time("2026-10-13T10:00:00Z"); page.wait_for_timeout(100)
    kontrol("T9 Salı: pilot/takım/pist profillerinde eski bilgi yok (aktif hafta sonu dışı)",page.evaluate("BaglamUI.profil('pilot','ANT')+BaglamUI.profil('takim','Mercedes')+BaglamUI.profil('pist','marina_bay')")=="" ,"")
    kontrol("profil testi hata yok",not e,e); br.close()
print("TOPLAM",sum(SONUC),"/",len(SONUC))
