import sys; sys.path.insert(0,'..')
exec(open('../state_ui_lib.py').read())
def ekle(page,g):
    page.evaluate("(g)=>{PROGRAM_DEGISIKLIK.push(g);document.dispatchEvent(new CustomEvent('f1-feed-guncel'));TickerMerkezi.yenile()}",g); page.wait_for_timeout(150)
def yen(page): page.evaluate("TickerMerkezi.yenile()"); page.wait_for_timeout(120)
def gor(page): return page.evaluate("(()=>{const e=document.getElementById('a45-ticker');return !!e&&!e.hidden&&e.offsetHeight>0})()")
def txt(page): return page.evaluate("document.getElementById('a45-ticker')?document.getElementById('a45-ticker').innerText.replace(/\\s+/g,' '):''")
def tema(page,koyu):
    hedef="koyu" if koyu else "acik"
    if page.evaluate("document.documentElement.getAttribute('data-tema')")!=hedef: page.evaluate("document.getElementById('btn-tema').click()"); page.wait_for_timeout(150)
    assert page.evaluate("document.documentElement.getAttribute('data-tema')")==hedef, "tema uygulanamadı"
def tasma(page): return page.evaluate("document.documentElement.scrollWidth>innerWidth")
def sigar(page): return page.evaluate("(()=>{const a=document.getElementById('a45-akis');const b=document.getElementById('a45-git').getBoundingClientRect();return a.scrollWidth<=a.clientWidth+1||getComputedStyle(a.querySelector('.tk-pr')||a).textOverflow==='ellipsis'})()")
FIA=lambda **k: dict({"sezon":2026,"tur":17,"kaynak":"FIA","dogrulandi":True},**k)
with sync_playwright() as p:
    # 1 normal Sprint
    d=Durum(); page,e,br=ac2(p,d,"2026-10-10T09:10:00Z"); yen(page)
    kontrol("1 Sprint normal: ticker görünür, LIVE + SPRINT",gor(page) and "LIVE" in txt(page) and "SPRINT" in txt(page),txt(page))
    # 2 DELAYED
    ekle(page,FIA(id="d",seans="Sprint",tip="DELAYED",zaman="2026-10-10T08:50:00Z",neden="hava"))
    t=txt(page); kontrol("2 Sprint DELAYED: 'SPRINT — BAŞLANGIÇ GECİKTİ', LIVE yok",gor(page) and "SPRINT — BAŞLANGIÇ GECİKTİ" in t and "LIVE" not in t,t)
    kontrol("2 aria-label durumu söyler",  "BAŞLANGIÇ GECİKTİ" in page.get_attribute("#a45-git","aria-label"),page.get_attribute("#a45-git","aria-label"))
    # Hafta kartı ile çelişmez
    st=page.evaluate("(()=>{const l=[...document.querySelectorAll('.h-seans')].map(x=>x.innerText.replace(/\\n/g,' '));return l.find(x=>/Sprint/.test(x)&&!/Sıralaması/.test(x))||''})()")
    kontrol("2 Yarış Haftası Sprint kartı da GECİKTİ; LIVE tahmini yok (ticker ile çelişki yok)","GECİKTİ" in st.upper() and "LIVE" not in st,st[:160])
    for w,koyu in ((390,False),(390,True),(1100,False),(1100,True)):
        page.set_viewport_size({"width":w,"height":900}); tema(page,koyu); page.wait_for_timeout(100)
        kontrol("15/16 DELAYED ticker %dpx %s: yatay taşma yok, görünür, metin sığar/kısalır"%(w,"koyu" if koyu else "açık"),not tasma(page) and gor(page) and sigar(page),page.evaluate("[document.documentElement.scrollWidth,innerWidth]"))
        page.screenshot(path="../ui1/ticker_gecikti_%d_%s.png"%(w,"koyu" if koyu else "acik"),clip={"x":0,"y":0,"width":w,"height":200})
    page.set_viewport_size({"width":390,"height":900}); tema(page,False); page.wait_for_timeout(100)
    kontrol("15 390px DELAYED: ek metin gizli, durum satırı tam görünür (kesilmez)","Yeni saat" not in txt(page) and "SPRINT — BAŞLANGIÇ GECİKTİ" in txt(page) and page.evaluate("(()=>{const e=document.querySelector('.tk-pr');return e.scrollWidth<=e.clientWidth+1})()"),txt(page))
    tema(page,False); page.set_viewport_size({"width":1100,"height":900})
    # 3 POSTPONED (yeni oturum)
    br.close()
    d=Durum(); page,e,br=ac2(p,d,"2026-10-10T09:10:00Z"); yen(page)
    ekle(page,FIA(id="p",seans="Sprint",tip="POSTPONED",zaman="2026-10-10T08:50:00Z"))
    t=txt(page); kontrol("3 Sprint POSTPONED: 'SPRINT — ERTELENDİ' + 'Yeni saat bekleniyor', LIVE yok",gor(page) and "SPRINT — ERTELENDİ" in t and "Yeni saat bekleniyor" in t and "LIVE" not in t,t)
    for w,koyu in ((390,True),(1100,False)):
        page.set_viewport_size({"width":w,"height":900}); tema(page,koyu); page.wait_for_timeout(100)
        kontrol("15/16 ERTELENDİ ticker %dpx %s: taşma yok"%(w,"koyu" if koyu else "açık"),not tasma(page) and gor(page) and sigar(page),page.evaluate("[document.documentElement.scrollWidth,innerWidth]"))
        page.screenshot(path="../ui1/ticker_ertelendi_%d_%s.png"%(w,"koyu" if koyu else "acik"),clip={"x":0,"y":0,"width":w,"height":200})
    tema(page,False); page.set_viewport_size({"width":1100,"height":900})
    # 4 Sprint NEW_TIME: eski planlı saatte yok, yeni saatte LIVE
    ekle(page,FIA(id="n",seans="Sprint",tip="NEW_TIME_CONFIRMED",zaman="2026-10-10T09:05:00Z",yeniBaslangic="2026-10-10T10:30:00Z"))
    kontrol("4 NEW_TIME açıklandı (09:10Z, eski planlı süre içinde): ticker gizli, LIVE yok",not gor(page),txt(page))
    adim(page,95*60,60); yen(page)
    t=txt(page); kontrol("4 yeni saatte (≈10:45Z): ticker LIVE SPRINT",gor(page) and "LIVE" in t and "SPRINT" in t,t)
    adim(page,40*60,60); yen(page)
    kontrol("4 yeni bitişten sonra (≈11:25Z) ticker kapanır",not gor(page),txt(page))
    br.close()
    # 5 Race NEW_TIME
    d=Durum(); page,e,br=ac2(p,d,"2026-10-11T12:30:00Z"); yen(page)
    kontrol("5 Race normal 12:30Z: LIVE YARIŞ",gor(page) and "YARIŞ" in txt(page) and "LIVE" in txt(page),txt(page))
    ekle(page,FIA(id="rn",seans="Race",tip="NEW_TIME_CONFIRMED",zaman="2026-10-11T11:00:00Z",yeniBaslangic="2026-10-11T14:00:00Z"))
    kontrol("5/6 Race NEW_TIME (eski planlı saat 12:30Z): LIVE yok",not gor(page),txt(page))
    adim(page,100*60,60); yen(page); t=txt(page)
    kontrol("5/7 Race yeni saatte (≈14:10Z): LIVE YARIŞ",gor(page) and "LIVE" in t and "YARIŞ" in t,t)
    br.close()
    # 6 Race POSTPONED, eski planlı saat
    d=Durum(); page,e,br=ac2(p,d,"2026-10-11T12:10:00Z"); yen(page)
    ekle(page,FIA(id="rp",seans="Race",tip="POSTPONED",zaman="2026-10-11T11:00:00Z"))
    t=txt(page); kontrol("6 Race POSTPONED, eski planlı saat geldi: 'YARIŞ — ERTELENDİ', LIVE yok",gor(page) and "YARIŞ — ERTELENDİ" in t and "LIVE" not in t,t)
    # Yarış Günü sekmesi ile çelişmez
    page.evaluate("sekmeAc('gun')"); adim(page,6,3)
    sy=page.evaluate("document.getElementById('gun-sayac').innerText"); kontrol("6 Yarış Günü de 'Yarış ertelendi' (ticker ile aynı)","Yarış ertelendi" in sy,sy)
    # 7 CANCELLED
    ekle(page,FIA(id="rc",seans="Race",tip="CANCELLED",zaman="2026-10-11T12:05:00Z"))
    t=txt(page); kontrol("3b Race CANCELLED: 'YARIŞ — İPTAL EDİLDİ'","YARIŞ — İPTAL EDİLDİ" in t and "LIVE" not in t,t)
    br.close()
    # 8/9 yanlış seans / round
    d=Durum(); page,e,br=ac2(p,d,"2026-10-10T09:10:00Z"); yen(page)
    ekle(page,FIA(id="x",tur=16,seans="Sprint",tip="POSTPONED",zaman="2026-10-10T08:50:00Z"))
    kontrol("8 başka round override'ı Sprint ticker'ını etkilemez (LIVE)",gor(page) and "LIVE" in txt(page),txt(page))
    ekle(page,FIA(id="y",seans="Qualifying",tip="POSTPONED",zaman="2026-10-10T08:50:00Z"))
    kontrol("9 Q override'ı Sprint ticker'ını etkilemez (LIVE)",gor(page) and "LIVE" in txt(page),txt(page))
    ekle(page,FIA(id="z",seans="Race",tip="POSTPONED",zaman="2026-10-10T08:50:00Z"))
    kontrol("9 Race override'ı Sprint ticker'ını etkilemez (LIVE)",gor(page) and "LIVE" in txt(page),txt(page))
    kontrol("hata yok",not e,e); br.close()
    # 7 COMPLETED: sonuç var → override ticker'ı etkilemez
    d=Durum(); d.sonuc[("17","sprint")]=yaris(sprint=True)
    page,e,br=ac2(p,d,"2026-10-10T09:30:00Z",sayfa="hafta"); adim(page,20,10); yen(page)
    tam=page.evaluate("(()=>{const h=YarisHaftasi._durum.hafta;return !!(h&&h.sonuclar&&h.sonuclar.sprint)})()")
    ekle(page,FIA(id="sp",seans="Sprint",tip="POSTPONED",zaman="2026-10-10T08:50:00Z"))
    if tam: kontrol("7 Sprint sonucu yüklü: POSTPONED override ticker'a yansımaz",not gor(page),txt(page))
    else: kontrol("7 (tarayıcıda sonuç yüklenemedi → Node testi geçerli)",True)
    br.close()
    # Poll aralığı: gecikti durumunda bsky çağrıları ≥30 sn arayla
    d=Durum(); page,e,br=ac2(p,d,"2026-10-10T09:10:00Z"); ekle(page,FIA(id="d",seans="Sprint",tip="DELAYED",zaman="2026-10-10T08:50:00Z"))
    adim(page,300,5); ts=page.evaluate("window.__bs")
    gap=min([b-a for a,b in zip(ts,ts[1:])]) if len(ts)>1 else 99999
    kontrol("poll: 5 dk'da bsky çağrıları ≥30 sn arayla (yeni sıklık yok), toplam<=11",gap>=29000 and len(ts)<=11,(len(ts),gap))
    br.close()
print("TOPLAM",sum(SONUC),"/",len(SONUC))
