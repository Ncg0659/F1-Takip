import sys, re
sys.path.insert(0,'.')
exec(open('nav_v3_test.py').read().split("with sync_playwright")[0])
OUT="/tmp/f1-ekran/"
KEY=re.compile(r"\b[a-z0-9]+(?:_[a-z0-9]+)+\b")
HAM=re.compile(r"undefined|NaN|Cannot read|\[object|null\b")
def R(pg,sel): return pg.evaluate("(s)=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height,v:e.checkVisibility()}}",sel)
def M(pg): return pg.evaluate("(()=>{const e=document.querySelector('#bg-kok [data-mod]');return e?{mod:e.dataset.mod,ton:e.dataset.ton,kod:(e.querySelector('.bg-kod')||{}).textContent,ad:(e.querySelector('.bg-ad')||{}).textContent}:null})()")
def cta(pg): return pg.evaluate("[...document.querySelectorAll('#bg-kok .bg-btn')].map(b=>b.dataset.git)")
def temiz(pg,ad):
    t=pg.evaluate("document.getElementById('sekme-bugun').textContent")
    kontrol(ad+": ham anahtar / undefined / NaN yok", not KEY.findall(t) and not HAM.search(t), (KEY.findall(t),HAM.findall(t)))
def ac(p,saat,w=1100,tema="koyu",feed=None,bekle=8,sonuc17=False):
    pg,errs,c,b=yeni(p,saat,w=w,tema=tema)
    pg.route(re.compile(r"api\.jolpi\.ca/ergast/f1/2026/17/(qualifying|sprint|results)"),lambda r: r.fulfill(status=200,content_type="application/json",headers={"access-control-allow-origin":"*"},body='{"MRData":{"RaceTable":{"Races":[]}}}'))   # fixture'da tur 17 sonucu yok: boş yanıt (gerçek API'de de henüz yok)
    ilerle(pg,5)
    if feed: pg.evaluate("""(o)=>localStorage.setItem('f1-feed-v1-2026-17', JSON.stringify({olaylar:o,gorulen:{},enYeniPost:null,motorSurum:RaceFeed.MOTOR_SURUM}))""",feed)
    flag(pg); tikla(pg,"nav-bugun"); ilerle(pg,bekle)
    return pg,errs,c,b
def ev(id,ts,cat,tr): return {"id":id,"timestamp":ts,"category":cat,"priority":"high","textTr":tr,"sourceUrl":"https://x","sourceName":"Test","drivers":[]}
def nav(pg,mod=None):
    kontrol("  BUGÜN nav aktif, ctx gizli, yalnız sekme-bugun açık", aktif(pg)==["nav-bugun"] and not ctxg(pg) and sekme(pg)==["sekme-bugun"], (aktif(pg),sekme(pg)))
with sync_playwright() as p:
    # ===== 0) mod seçimi deterministik (saf; aynı sayfada farklı saatler) =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z")
    TAB=[("2026-10-06T10:00:00Z","B"),("2026-10-08T21:00:00Z","A"),("2026-10-09T05:00:00Z","A"),("2026-10-10T09:10:00Z","A"),("2026-10-11T12:30:00Z","A"),("2026-10-11T18:00:00Z","C"),("2026-10-12T22:00:00Z","C"),("2026-10-13T04:00:00Z","B")]
    for t,bek in TAB:
        pg.clock.set_system_time(t)
        m=pg.evaluate("()=>BugunV3.modBelirle(Date.now()).mod")
        kontrol("0 mod tablosu %s → %s"%(t,bek), m==bek, m)
    pg.clock.set_system_time('2026-10-13T04:00:00Z'); yr=pg.evaluate("BugunV3.modBelirle(Date.now()).y.round")
    kontrol("0 sıradaki yarış (B, 13 Eki): tur 17 değil, tur 18", yr=="18", yr)
    src=open('/home/claude/f1-takip/bugun-v3.js').read()
    kontrol("0 bugun-v3.js: fetch / XHR / WebSocket / setInterval / setTimeout / localStorage yazımı YOK", not re.search(r"\bfetch\s*\(|XMLHttpRequest|WebSocket|setInterval|setTimeout|localStorage\.setItem|requestAnimationFrame",src))
    b.close()
    # ===== A) hafta sonu değil (MOD B) =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); n0=len(c.net)
    m=M(pg); kontrol("A1 mod B: SIRADAKİ YARIŞ + Singapore Grand Prix", m and m["mod"]=="B" and m["kod"]=="SIRADAKİ YARIŞ" and "Singapore" in m["ad"], m)
    hero=pg.evaluate("document.querySelector('#bg-kok .bg-hero').textContent")
    kontrol("A2 hero: tur, pist/şehir, tarih, sayaç kutuları, gerçek pist svg", "TUR 17" in hero and "Marina Bay Street Circuit" in hero and "11 EKİ" in hero.upper().replace("İ","İ") and pg.locator("#bg-kok .bg-kutu").count()==4 and vis(pg,"#bg-kok svg.bg-pist"), hero[:200])
    s0=pg.inner_text("#bg-kok .bg-kutu:last-child .bg-sayi"); ilerle(pg,3); s1=pg.inner_text("#bg-kok .bg-kutu:last-child .bg-sayi")
    kontrol("A3 sayaç mevcut saat tetikleriyle akıyor (sn değişir)", s0!=s1, (s0,s1))
    kontrol("A4 ŞAMPİYONA: P1–P3 pilot satırı (3 satır)", pg.locator("#bg-kok .bg-std li").count()==3 and "ANT" in pg.inner_text("#bg-kok .bg-sampiyona"), pg.inner_text("#bg-kok .bg-sampiyona"))
    kontrol("A5 CTA: [SEZONA GİT] [HAFTA SONU'NA GİT]", cta(pg)==["sezon","hafta"] and "SEZONA GİT" in pg.inner_text("#bg-kok .bg-cta"))
    nav(pg); temiz(pg,"A6 B modu")
    kontrol("A7 gereksiz içerik yok (Bilmen gereken 5 şey / tam tablo / A7 tablo)", not vis(pg,"#sekme-bugun table") and "BİLMEN" not in pg.inner_text("#sekme-bugun").upper())
    kontrol("A8 BUGÜN kendisi ağ isteği yapmadı (açıldıktan sonra yeni istek yok; OpenF1/A7 yok)", len(c.of)==0, (len(c.net)-n0, c.of[:3]))
    pg.click("#bg-kok [data-git='hafta']"); ilerle(pg,4)
    kontrol("A9 HAFTA SONU'NA GİT → sekme-hafta, HAFTA SONU/HAFTA vurgusu", sekme(pg)==["sekme-hafta"] and aktif(pg)==["nav-haftasonu"] and ctxa(pg)==["ctx-hafta"], (sekme(pg),aktif(pg),ctxa(pg)))
    tikla(pg,"nav-bugun"); pg.click("#bg-kok [data-git='sezon']"); ilerle(pg,4)
    kontrol("A10 SEZONA GİT → sekme-sezon, SEZON vurgusu", sekme(pg)==["sekme-sezon"] and aktif(pg)==["nav-sezon"] and not ctxg(pg))
    # I) standings yok
    tikla(pg,"nav-bugun"); ilerle(pg,2); pg.evaluate("sezonPilotlar=[]; BugunV3.ciz()"); ilerle(pg,2)
    kontrol("I1 standings yok → ŞAMPİYONA bloğu yok, hero+CTA duruyor", pg.locator("#bg-kok .bg-sampiyona").count()==0 and pg.locator("#bg-kok .bg-hero").count()==1 and cta(pg)==["sezon","hafta"])
    temiz(pg,"I2 standings yok"); kontrol("A11 hata yok", not errs, errs); b.close()
    # ===== B) hafta sonu aktif (UPCOMING) =====
    pg,errs,c,b=ac(p,"2026-10-09T05:00:00Z")
    m=M(pg); kontrol("B1 mod A UPCOMING", m and m["mod"]=="A" and m["kod"]=="UPCOMING", m)
    kontrol("B2 sıradaki seans (Antrenman 1) + TR saat + geri sayım", "ANTRENMAN 1" in pg.inner_text("#bg-kok .bg-ses").upper() and "11:30" in pg.inner_text("#bg-kok .bg-ses") and "TR" in pg.inner_text("#bg-kok .bg-ses") and re.search(r"\d+ dk",pg.inner_text("#bg-kok .bg-ses-sayac")), pg.inner_text("#bg-kok .bg-ses"))
    t0=pg.inner_text("#bg-kok .bg-ses-sayac"); ilerle(pg,3); kontrol("B3 sayaç akıyor", t0!=pg.inner_text("#bg-kok .bg-ses-sayac"), t0)
    kontrol("B4 5 seanslık kompakt zaman şeridi (Sprint hafta sonu)", pg.locator("#bg-kok .bg-z").count()==5)
    kontrol("B5 kritik durum yok, feed yok (store boş) → blok üretilmedi", pg.locator("#bg-kok .bg-kritik").count()==0 and pg.locator("#bg-kok .bg-feed").count()==0)
    kontrol("B6 CTA: HAFTA SONU'NA GİT → hafta", cta(pg)==["hafta"])
    nav(pg); temiz(pg,"B7"); pg.click("#bg-kok [data-git]"); ilerle(pg,4)
    kontrol("B8 CTA tıklanınca sekme-hafta + vurgu", sekme(pg)==["sekme-hafta"] and aktif(pg)==["nav-haftasonu"], sekme(pg)); b.close()
    # ===== C) Sprint hafta sonu =====
    pg,errs,c,b=ac(p,"2026-10-10T07:00:00Z")
    kontrol("C1 Sprint hafta sonu: SPRINT rozeti, sıradaki seans Sprint, CTA → sprint", pg.locator("#bg-kok .bg-sprint").count()==1 and "SPRINT" in pg.inner_text("#bg-kok .bg-ses-ad").upper() and cta(pg)==["sprint"], (cta(pg),pg.inner_text("#bg-kok .bg-ses")))
    pg.click("#bg-kok [data-git]"); ilerle(pg,4)
    kontrol("C2 CTA → sekme-sprint, HAFTA SONU vurgusu", sekme(pg)==["sekme-sprint"] and aktif(pg)==["nav-haftasonu"], (sekme(pg),aktif(pg))); b.close()
    pg,errs,c,b=ac(p,"2026-10-10T09:10:00Z")
    m=M(pg); kontrol("C3 Sprint (feed yok): mod A, LIVE TAHMİNİ, ŞU AN SPRINT, CTA sprint", m["mod"]=="A" and m["kod"]=="LIVE TAHMİNİ" and "ŞU AN" in pg.inner_text("#bg-kok .bg-ses") and "SPRINT" in pg.inner_text("#bg-kok .bg-ses-ad").upper() and cta(pg)==["sprint"], (m,cta(pg)))
    kontrol("C4 canlı seans zaman şeridinde vurgulu", pg.locator("#bg-kok .bg-z-canli").count()==1); b.close()
    # ===== D) Yarış LIVE (+ H: Race Feed) =====
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z")
    m=M(pg); kontrol("D1 Yarış (feed yok): mod A, LIVE TAHMİNİ, CTA → gun", m["mod"]=="A" and m["kod"]=="LIVE TAHMİNİ" and m["ton"]=="bekle" and cta(pg)==["gun"], (m,cta(pg)))
    kontrol("H1 Race Feed yok → feed bloğu yok", pg.locator("#bg-kok .bg-feed").count()==0)
    temiz(pg,"D3"); pg.screenshot(path=OUT+"bugun-3.png")
    pg.click("#bg-kok [data-git]"); ilerle(pg,4)
    kontrol("D4 CTA → sekme-gun, HAFTA SONU/GÜN vurgusu", sekme(pg)==["sekme-gun"] and aktif(pg)==["nav-haftasonu"] and ctxa(pg)==["ctx-gun"], (sekme(pg),aktif(pg),ctxa(pg))); b.close()
    FEED=[ev("e1","2026-10-11T12:10:00Z","PENALTY","5 saniye zaman cezası: Verstappen."),ev("e2","2026-10-11T12:15:00Z","SAFETY_CAR","Safety Car devrede."),ev("e3","2026-10-11T12:20:00Z","PIT","Norris pit yaptı."),ev("e4","2026-10-11T12:25:00Z","WEATHER","Pistte yağmur başladı.")]
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",feed=FEED)
    n=pg.locator("#bg-kok .bg-feed li").count(); kontrol("H2 Race Feed deposu var → en çok 5 not", 1<=n<=5, n)
    ts=pg.evaluate("[...document.querySelectorAll('#bg-kok .bg-feed li time')].map(t=>t.textContent)")
    kontrol("H3 feed notları en yeni üstte (saat azalan), Türkçe metin", n>=1 and ts==sorted(ts,reverse=True) and "yağmur" in pg.inner_text("#bg-kok .bg-feed").lower(), (ts,pg.inner_text("#bg-kok .bg-feed")))
    temiz(pg,"H4"); b.close()
    # ===== E) RED FLAG / DELAYED =====
    RF=[dict(ev("r0","2026-10-11T12:02:00Z","RESTART","Yarış başladı."),originalText="Lights out and away we go. The race has started."),dict(ev("r1","2026-10-11T12:20:00Z","RED_FLAG","Kırmızı bayrak: yarış durduruldu."),originalText="RED FLAG")]
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",feed=RF)
    m=M(pg); kontrol("E1 RED FLAG: mod A, kırmızı ton, etiket RED FLAG", m["mod"]=="A" and m["ton"]=="kirmizi" and "RED" in m["kod"].upper(), m)
    kontrol("E2 KRİTİK DURUM tek satır (yeniden başlama bekleniyor)", pg.locator("#bg-kok .bg-kritik").count()==1 and "Yeniden başlama" in pg.inner_text("#bg-kok .bg-kritik"), pg.locator("#bg-kok .bg-kritik").all_inner_texts())
    kontrol("E3 CTA hâlâ gun", cta(pg)==["gun"]); temiz(pg,"E4"); pg.screenshot(path=OUT+"bugun-3b.png"); b.close()
    pg,errs,c,b=ac(p,"2026-10-11T11:30:00Z")
    pg.evaluate("FeedCanli.tickerOturum=()=>({oturum:'Race',tur:17,ad:'Singapore Grand Prix',raceKey:'2026-17',bas:Date.now()+1800000,bit:Date.now()+9000000,durum:'gecikti',yeniSaat:false}); BugunV3.ciz()"); ilerle(pg,2)
    m=M(pg); kontrol("E5 DELAYED: mod A, KRİTİK satırı 'gecikti', CTA gun", m["mod"]=="A" and pg.locator("#bg-kok .bg-kritik").count()==1 and "gecik" in pg.inner_text("#bg-kok .bg-kritik").lower() and cta(pg)==["gun"], (m,pg.locator("#bg-kok .bg-kritik").all_inner_texts()))
    temiz(pg,"E6"); b.close()
    # ===== F) yarış yeni tamamlandı (sonuç var) =====
    pg,errs,c,b=ac(p,"2026-10-04T12:00:00Z",bekle=20)
    m=M(pg); kontrol("F1 mod C: YARIŞ TAMAMLANDI, Bahrain GP", m["mod"]=="C" and m["kod"]=="YARIŞ TAMAMLANDI" and m["ton"]=="bitti", m)
    kontrol("F2 podyum P1–P3 (3 satır) + gerçek pist svg", pg.locator("#bg-kok .bg-pod-s").count()==3 and vis(pg,"#bg-kok svg.bg-pist"), pg.locator("#bg-kok .bg-pod-s").count())
    kontrol("F3 NE OLDU? YorumMotoru'ndan tek kısa cümle", pg.locator("#bg-kok .bg-cumle").count()==1 and 8<len(pg.inner_text("#bg-kok .bg-cumle"))<200, pg.locator("#bg-kok .bg-cumle").all_inner_texts())
    kontrol("F4 CTA: YARIŞ ANALİZİNE GİT → yaris", cta(pg)==["yaris"]); temiz(pg,"F5"); nav(pg)
    pg.screenshot(path=OUT+"bugun-4.png")
    pg.click("#bg-kok [data-git]"); ilerle(pg,5)
    kontrol("F6 CTA → sekme-yaris, ANALİZ/YARIŞ vurgusu", sekme(pg)==["sekme-yaris"] and aktif(pg)==["nav-analiz"] and ctxa(pg)==["ctx-yaris"], (sekme(pg),aktif(pg)))
    kontrol("F7 hata yok", not errs, errs); b.close()
    # ===== G) sonuç verisi yok =====
    pg,errs,c,b=ac(p,"2026-10-11T15:00:00Z",bekle=20)
    m=M(pg); kontrol("G1 sonuç yok: mod C, SONUÇLAR BEKLENİYOR, podyum gösterilmez", m["mod"]=="C" and "BEKLENİYOR" in m["kod"] and pg.locator("#bg-kok .bg-pod").count()==0 and pg.locator("#bg-kok .bg-cumle").count()==0, m)
    kontrol("G2 CTA yine yaris", cta(pg)==["yaris"]); temiz(pg,"G3"); kontrol("G4 hata yok", not errs, errs); b.close()
    # ===== FINAL STATE CLEANUP: LIVE doğruluğu / yarış bitişi / hero altı tek blok =====
    LV=[RF[0]]   # yalnız "yarış başladı" → Race Feed doğrulamalı gerçek LIVE
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",feed=LV)
    m=M(pg); t=pg.inner_text("#bg-kok")
    kontrol("FX1 gerçek LIVE (Race Feed doğruladı): düz LIVE, kırmızı ton, tahmin ifadesi yok", m["mod"]=="A" and m["kod"]=="LIVE" and m["ton"]=="live" and "TAHMİN" not in t.upper() and "SAATE GÖRE" not in t.upper() and "saat tabanlı" not in t, (m,t[:200]))
    kontrol("FX1b gerçek LIVE seans satırı: DEVAM EDİYOR", "DEVAM EDİYOR" in t, t[:200]); temiz(pg,"FX1c"); pg.screenshot(path=OUT+"bugun-f1.png"); b.close()
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z")
    m=M(pg); t=pg.inner_text("#bg-kok")
    kontrol("FX2 tahmini LIVE (feed yok): 'LIVE TAHMİNİ', kırmızı değil (bekle tonu), düz LIVE yok", m["mod"]=="A" and m["kod"]=="LIVE TAHMİNİ" and m["ton"]=="bekle", m)
    kontrol("FX2b seans satırı 'SAATE GÖRE SÜRÜYOR OLMALI'; eski 'saat tabanlı' dipnotu yok; DEVAM EDİYOR iddiası yok", "SAATE GÖRE SÜRÜYOR OLMALI" in t and "saat tabanlı" not in t and "DEVAM EDİYOR" not in t, t[:250])
    kontrol("FX2c feed yok → boş feed kartı yok", pg.locator("#bg-kok .bg-feed").count()==0); temiz(pg,"FX2d"); pg.screenshot(path=OUT+"bugun-f2.png"); b.close()
    pg,errs,c,b=ac(p,"2026-10-10T09:10:00Z",feed=None)
    m=M(pg); kontrol("FX3 tahmini LIVE (Sprint, feed yok) da dürüst etiket", m["kod"]=="LIVE TAHMİNİ" and m["ton"]=="bekle", m); b.close()
    # RED FLAG: planlı 120 dk geçse de yarış sonuç/COMPLETED olmadan C'ye düşmez
    pg,errs,c,b=ac(p,"2026-10-11T14:30:00Z",feed=RF)
    m=M(pg); kontrol("FX4 RED FLAG + start+150 dk (sonuç yok): hâlâ mod A, kırmızı, COMPLETED değil", m["mod"]=="A" and m["ton"]=="kirmizi" and "TAMAMLANDI" not in pg.inner_text("#bg-kok"), m); b.close()
    # yarış 120 dk'yı geçti, doğrulanmış LIVE feed var, completed yok → A (uzamış)
    pg,errs,c,b=ac(p,"2026-10-11T14:30:00Z",feed=LV)
    m=M(pg); kontrol("FX5 120 dk geçti + feed LIVE + sonuç yok: erken COMPLETED yok → mod A, LIVE (uzamış notu)", m["mod"]=="A" and m["kod"]=="LIVE" and "Planlı bitiş geçti" in pg.inner_text("#bg-kok .bg-kritik"), (m,pg.locator("#bg-kok .bg-kritik").all_inner_texts())); b.close()
    # 120 dk geçti, feed yok, sonuç yok → yalnız FALLBACK: C ama 'TAMAMLANDI' iddiası yok
    pg,errs,c,b=ac(p,"2026-10-11T14:30:00Z")
    m=M(pg); kontrol("FX6 120 dk geçti + feed/sonuç yok: fallback mod C, 'YARIŞ TAMAMLANDI' DEĞİL (SONUÇLAR BEKLENİYOR)", m["mod"]=="C" and "BEKLENİYOR" in m["kod"], m); b.close()
    # sonuç VAR → planlı bitişi beklemeden / feed durumundan bağımsız C (a/b önceliği)
    pg,errs,c,b=ac(p,"2026-10-04T09:30:00Z",bekle=20)
    m=M(pg); kontrol("FX7 sonuç var (tur 16): mod C, YARIŞ TAMAMLANDI, podyum", m["mod"]=="C" and m["kod"]=="YARIŞ TAMAMLANDI" and pg.locator("#bg-kok .bg-pod-s").count()==3, m); b.close()
    # completed state ekran görüntüsü + hero altı tek secondary blok
    pg,errs,c,b=ac(p,"2026-10-04T12:00:00Z",bekle=20)
    sec=pg.evaluate("[...document.querySelectorAll('#bg-kok > section, #bg-kok > div')].map(e=>(['bg-hero','bg-feed','bg-ne','bg-sampiyona','bg-cta'].find(c=>e.classList.contains(c))||e.className))")
    kontrol("FX8 completed: hero + tek secondary (NE OLDU?) + CTA; boş kart yok", sec==["bg-hero","bg-ne","bg-cta"] and pg.locator("#bg-kok .bg-blok:empty").count()==0, sec); pg.screenshot(path=OUT+"bugun-f3.png"); b.close()
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",feed=FEED)
    sec=pg.evaluate("[...document.querySelectorAll('#bg-kok > section, #bg-kok > div')].map(e=>(['bg-hero','bg-feed','bg-ne','bg-sampiyona','bg-cta'].find(c=>e.classList.contains(c))||e.className))")
    kontrol("FX9 aktif + feed var: hero + tek secondary (RACE FEED) + CTA; kritik satırı hero İÇİNDE", sec==["bg-hero","bg-feed","bg-cta"], sec); b.close()
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z")
    sec=pg.evaluate("[...document.querySelectorAll('#bg-kok > section, #bg-kok > div')].map(e=>(['bg-hero','bg-feed','bg-ne','bg-sampiyona','bg-cta'].find(c=>e.classList.contains(c))||e.className))")
    kontrol("FX10 normal: hero + tek secondary (ŞAMPİYONA) + CTA", sec==["bg-hero","bg-sampiyona","bg-cta"] or sec==["bg-hero","bg-cta"], sec); b.close()
    # veri yok → boş kart yok
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); pg.evaluate("BugunKaynak=()=>({sezon:2026,yarislar:sezonYarislar,pilotlar:[],secYaris:gunYarisiSec,zaman:yarisZamani}); BugunV3.ciz()"); ilerle(pg,2)
    kontrol("FX11 standings yok → şampiyona bloğu çizilmez, boş kart yok", pg.locator("#bg-kok .bg-sampiyona").count()==0 and pg.locator("#bg-kok .bg-blok:empty").count()==0); b.close()
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",w=390,feed=None)
    kontrol("FX12 390 tahmini LIVE: etiket görünür, taşma 0, CTA bottom nav üstünde", "LIVE TAHMİNİ" in pg.inner_text("#bg-kok") and tasma(pg)==0 and R(pg,"#bg-kok .bg-cta")["b"]<=R(pg,"#nav-v3")["t"]+1, tasma(pg)); pg.screenshot(path=OUT+"bugun-f4.png"); b.close()
    for w in (1100,390):
        for tema in ("koyu","acik"):
            for ad,saat_,fd in (("gercek-LIVE","2026-10-11T12:30:00Z",LV),("tahmini-LIVE","2026-10-11T12:30:00Z",None),("RED","2026-10-11T14:30:00Z",RF)):
                pg,errs,c,b=ac(p,saat_,w=w,tema=tema,feed=fd); K="FV[%d %s %s] "%(w,tema,ad)
                kontrol(K+"taşma 0 + hata yok", tasma(pg)==0 and not errs, (tasma(pg),errs)); b.close()
    # ===== YENİ SHELL AÇILIŞI: BUGÜN ana ekran =====
    pg,errs,c,b=yeni(p,"2026-10-06T10:00:00Z",tema="koyu"); ilerle(pg,3)
    pg.evaluate("localStorage.setItem('f1-nav','v3')"); pg.reload(); ilerle(pg,10)
    kontrol("N1 v3 bayrağıyla açılışta ana ekran BUGÜN", sekme(pg)==["sekme-bugun"] and aktif(pg)==["nav-bugun"] and not ctxg(pg) and M(pg) is not None, (sekme(pg),aktif(pg)))
    pg.evaluate("localStorage.removeItem('f1-nav')"); pg.reload(); ilerle(pg,6)
    kontrol("N2 normal açılış (NAV v3 default): açılış BUGÜN, yeni shell görünür, eski nav gizli", sekme(pg)==["sekme-bugun"] and vis(pg,"#nav-v3") and not vis(pg,"#btn-sezon"), sekme(pg))
    kontrol("N3 hata yok", not errs, errs); b.close()
    # ===== GÖRÜNÜM: 1100/390 × dark/light, taşma, ilk bilgi bottom nav üstünde =====
    for w in (1100,390):
        for tema in ("koyu","acik"):
            for ad,saat_,bek in (("B","2026-10-06T10:00:00Z",8),("A-LIVE","2026-10-11T12:30:00Z",8),("C","2026-10-04T12:00:00Z",20)):
                pg,errs,c,b=ac(p,saat_,w=w,tema=tema,bekle=bek)
                K="V[%d %s %s] "%(w,tema,ad)
                kontrol(K+"yatay taşma 0", tasma(pg)==0, tasma(pg))
                if w==390:
                    nv=R(pg,"#nav-v3"); cb=R(pg,"#bg-kok .bg-cta"); ba=R(pg,"#bg-kok .bg-ad")
                    kontrol(K+"hero adı ve CTA bottom nav ÜSTÜNDE görünür", ba["b"]<=nv["t"] and cb["b"]<=nv["t"]+1, (ba["b"],cb["b"],nv["t"]))
                    if ad=="B" and tema=="koyu": pg.screenshot(path=OUT+"bugun-5.png")
                    if ad=="A-LIVE" and tema=="koyu": pg.screenshot(path=OUT+"bugun-6.png")
                    if ad=="C" and tema=="acik": pg.screenshot(path=OUT+"bugun-7.png")
                else:
                    if ad=="B" and tema=="koyu": pg.screenshot(path=OUT+"bugun-1.png")
                    if ad=="A-LIVE" and tema=="koyu": pass
                kontrol(K+"kart içi taşma yok (hero/podyum/CTA yatay sığar)", pg.evaluate("[...document.querySelectorAll('#bg-kok *')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().right>innerWidth+1).length")==0)
                kontrol(K+"hata yok", not errs, errs); b.close()
    pg,errs,c,b=ac(p,"2026-10-09T05:00:00Z"); pg.screenshot(path=OUT+"bugun-2.png"); b.close()
print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
