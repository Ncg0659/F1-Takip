import re
import sys, re
sys.path.insert(0,'.')
exec(open('nav_v3_test.py').read().split("with sync_playwright")[0])
RES[17]=[row(1,"ANT","Antonelli","Mercedes",1),row(2,"RUS","Russell","Mercedes",2),row(3,"VER","Verstappen","Red Bull",2),row(4,"NOR","Norris","McLaren",6)]
SHOT="/tmp/f1-ekran/favori/"
import os; os.makedirs(SHOT,exist_ok=True)
def fav(pg,id):
    pg.evaluate("(i)=>{const s=document.getElementById('favori-sec');s.value=i;s.dispatchEvent(new Event('change'))}",id); ilerle(pg,2)
def isl(pg): return pg.evaluate("(document.getElementById('fv-bugun')||{}).innerText||''")
def mk(pg): return pg.evaluate("[...document.querySelectorAll('[data-fav]')].map(e=>(e.tagName+'|'+(e.closest('tbody,ul,ol,section,div[id]')||{}).id+'|'+e.textContent))")
def kirmizi(c):
    m=re.findall(r"[\d.]+",c); 
    if len(m)<3: return False
    r,g,b=[float(x) for x in m[:3]]; a=float(m[3]) if len(m)>3 else 1
    return a>0.02 and r>g+60 and r>b+60
def stil(pg,sel,prop): return pg.evaluate("(a)=>{const e=document.querySelector(a[0]);return e?getComputedStyle(e)[a[1]]:''}",[sel,prop])
def ac(p,saat,w=1100,tema="koyu"):
    pg,errs,c,b=yeni(p,saat,w=w,tema=tema); ilerle(pg,5); flag(pg); tikla(pg,"nav-bugun"); ilerle(pg,6); return pg,errs,c,b
with sync_playwright() as p:
    # ===== 0) kaynak =====
    js_=open('/home/claude/f1-takip/favori-v1.js').read(); css_=open('/home/claude/f1-takip/favori-v1.css').read(); ix=open('/home/claude/f1-takip/index.html').read()
    kontrol("0.1 favori-v1.js: fetch/XHR/WebSocket/setInterval/setTimeout YOK, localStorage YAZIMI YOK", not re.search(r"\bfetch\s*\(|XMLHttpRequest|WebSocket|setInterval|setTimeout|localStorage\.(setItem|removeItem)|\.clear\(",js_))
    kontrol("0.2 eşleme KOD'dan: familyName/textContent-includes ile isim eşlemesi yok", "familyName" not in js_.replace("d.familyName","") and "indexOf(pilot" not in js_)
    kontrol("0.3 index.html: eski isim-eşlemeli favoriVurgula + kırmızı tr.favori kaldırıldı", "tr.textContent.indexOf" not in ix and "tr.favori td { background:rgba(212,22,28" not in ix)
    kontrol("0.4 css: --vurgu (kırmızı) ve glow (box-shadow blur) kullanılmıyor", "--vurgu" not in css_ and not re.search(r"box-shadow:[^;]*\d+px \d+px \d+px",css_) and "text-shadow" not in css_)
    # ===== 1) FAVORİ YOK =====
    for saat,ad in [("2026-10-06T10:00:00Z","B"),("2026-10-09T05:00:00Z","A"),("2026-10-11T18:00:00Z","C")]:
        pg,errs,c,b=ac(p,saat)
        kontrol("1.%s favori yok: BUGÜN kişisel blok yok, ★ işareti yok, [data-fav] yok, tr.favori yok"%ad, pg.locator("#fv-bugun").count()==0 and pg.locator("#fv-sezon").count()==0 and pg.locator("[data-fav]").count()==0 and pg.locator("tr.favori").count()==0, mk(pg))
        kontrol("1.%s favori yok: top bar '★ Favori seç' korunur"%ad, "Favori seç" in pg.inner_text("#nv-fav"), pg.inner_text("#nv-fav"))
        kontrol("1.%s favori yok: BUGÜN metninde favori kişisel blok izi yok"%ad, "Şampiyonada P" not in pg.inner_text("#sekme-bugun"))
        b.close()
    # ===== 2) BUGÜN normal mod (B), NOR =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); n0=len(c.net)
    fav(pg,"norris")
    kontrol("2.1 chip: ★ NOR", "NOR" in pg.inner_text("#nv-fav"), pg.inner_text("#nv-fav"))
    t=isl(pg); kontrol("2.2 BUGÜN B: 'NOR · Şampiyonada P3 · 150 puan'", "NOR" in t and "Şampiyonada P3 · 150 puan" in t and "X Norris" in t, t)
    kontrol("2.3 blok BUGÜN hero'dan SONRA (ikincil), hero'dan kısa", pg.evaluate("(()=>{const h=document.querySelector('#bg-kok .bg-hero').getBoundingClientRect(),f=document.getElementById('fv-bugun').getBoundingClientRect();return f.top>=h.bottom-1&&f.height<h.height*0.6})()"))
    kontrol("2.4 blok kompakt: ≤3 satır, aria-label", pg.locator("#fv-bugun p").count()<=3 and pg.get_attribute("#fv-bugun","aria-label")=="Favori pilot özeti")
    kontrol("2.5 BUGÜN ŞAMPİYONA P1–P3: yalnız NOR satırı işaretli (ANT/RUS değil)", pg.evaluate("[...document.querySelectorAll('#bg-kok .bg-std li')].map(l=>l.hasAttribute('data-fav'))")==[False,False,True], pg.evaluate("[...document.querySelectorAll('#bg-kok .bg-std li')].map(l=>l.hasAttribute('data-fav'))"))
    kontrol("2.6 state rengiyle karışmaz: blok çizgisi/★/kod kırmızı değil", not kirmizi(stil(pg,"#fv-bugun","borderLeftColor")) and not kirmizi(stil(pg,"#fv-bugun .fv-y","color")) and not kirmizi(stil(pg,"#fv-bugun .fv-kod","borderTopColor")))
    kontrol("2.7 hero etiketi (SIRADAKİ YARIŞ/ton) favoriden etkilenmedi", M_ if (M_:=None) else pg.evaluate("document.querySelector('#bg-kok [data-mod]').dataset.mod")=="B")
    PT=re.compile(r"/(results|qualifying|pitstops)/\?limit=100&offset=|/\d+/pitstops/\?limit=100|/(19\d\d|20[01]\d|202[0-5])/driverstandings/$")   # Prediction UI ve geçmiş şampiyonlar taramasının (favoriden bağımsız, zamanlamaya bağlı) istekleri sayılmaz
    sayN=lambda cc,n: len([u for u in cc.net[n:] if not PT.search(u)])
    ilerle(pg,3); ek=sayN(c,n0)
    pg2,e2,c2,b2=ac(p,"2026-10-06T10:00:00Z"); m0=len(c2.net); ilerle(pg2,5); ek2=sayN(c2,m0); b2.close()
    kontrol("2.8 favori seçimi yeni ağ isteği üretmedi (aynı süre favorisiz kontrolle aynı: %d == %d)"%(ek,ek2), ek==ek2 and len(c.of)==0, (ek,ek2))
    pg.screenshot(path=SHOT+"01-bugun-normal-nor-1100-koyu.png")
    # favori değişimi / kaldırma
    fav(pg,"verstappen"); t=isl(pg); kontrol("2.9 favori VER: blok VER P4 · 140 puan; NOR işareti kalmadı", "VER" in t and "P4 · 140 puan" in t and pg.evaluate("[...document.querySelectorAll('[data-fav]')].every(e=>!/NOR/.test(e.textContent))"), t)
    kontrol("2.10 VER P4 → BUGÜN ŞAMPİYONA P1–P3'te işaretli satır yok", pg.evaluate("document.querySelectorAll('#bg-kok .bg-std li[data-fav]').length")==0)
    fav(pg,""); kontrol("2.11 favori kaldırılınca blok + tüm işaretler temizlenir", pg.locator("#fv-bugun").count()==0 and pg.locator("[data-fav]").count()==0 and pg.locator("tr.favori").count()==0 and pg.locator("#fv-sezon").count()==0)
    kontrol("2.12 hata yok", not errs, errs); b.close()
    # ===== 3) SEZON: puan durumu =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); fav(pg,"norris"); tikla(pg,"nav-sezon"); ilerle(pg,4)
    kontrol("3.1 puan durumu: yalnız NOR satırı işaretli (tr.favori=1)", pg.evaluate("[...document.querySelectorAll('#pilot-govde tr.favori')].map(t=>t.textContent)").__len__()==1 and "Norris" in pg.inner_text("#pilot-govde tr.favori"))
    kontrol("3.2 diğer pilot satırları yanlış işaretlenmedi", pg.evaluate("[...document.querySelectorAll('#pilot-govde tr')].filter(t=>t.hasAttribute('data-fav')&&!/Norris/.test(t.textContent)).length")==0)
    kontrol("3.3 satır tint'i kırmızı değil", not kirmizi(stil(pg,"#pilot-govde tr.favori td","backgroundColor")) and not kirmizi(stil(pg,"#pilot-govde tr.favori td:first-child","boxShadow")), stil(pg,"#pilot-govde tr.favori td","backgroundColor"))
    kontrol("3.4 satır yüksekliği/hizası bozulmadı (diğer satırlara ±3px)", pg.evaluate("(()=>{const r=[...document.querySelectorAll('#pilot-govde tr')].map(t=>t.getBoundingClientRect().height).filter(x=>x>0);const f=document.querySelector('#pilot-govde tr.favori').getBoundingClientRect().height;return Math.max.apply(null,r.map(x=>Math.abs(x-f)))<=3})()"))
    ozet=pg.inner_text("#fv-sezon") if pg.locator("#fv-sezon").count() else ""
    kontrol("3.5 şampiyona özeti: NOR · P3 · 150 puan · 'Lidere 140 puan' (negatif sayı yok)", "NOR" in ozet and "P3" in ozet and "150" in ozet and "Lidere 140 puan" in ozet and "−" not in ozet and "Lider farkı" not in ozet, ozet)
    kontrol("3.6 özet tablodan ÖNCE, tek satır wrap'li kompakt", pg.evaluate("(()=>{const o=document.getElementById('fv-sezon'),k=document.querySelector('#pilot-govde').closest('.kap');return o.nextElementSibling===k&&o.getBoundingClientRect().height<60})()"))
    kontrol("3.7 daralmış listede favori satırı görünür (ui-final kuralı korundu)", pg.evaluate("(()=>{const r=document.querySelector('#pilot-govde tr.favori');return !!r&&r.checkVisibility()})()"))
    kontrol("3.8 ★ işareti satırda (pilot hücresi ::after)", pg.evaluate("getComputedStyle(document.querySelector('#pilot-govde tr.favori .pilot'),'::after').content")=='"★"')
    kontrol("3.9 yatay taşma 0 (1100)", tasma(pg)==0, tasma(pg))
    pg.screenshot(path=SHOT+"03-sezon-standings-nor-1100-koyu.png",full_page=False)
    # lider favori: farkı yok
    fav(pg,"antonelli"); ozet=pg.inner_text("#fv-sezon"); kontrol("3.10 lider favori: 'Şampiyona lideri', negatif sayı yok", "P1" in ozet and "−" not in ozet and "Şampiyona lideri" in ozet and "Lidere" not in ozet, ozet)
    kontrol("3.11 hata yok", not errs, errs); b.close()
    # ===== 4) YARIŞ SONUCU / ANALİZ =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); fav(pg,"norris"); tikla(pg,"nav-analiz"); ilerle(pg,6)
    kontrol("4.1 yarış sonucu: yalnız NOR satırı işaretli", pg.evaluate("[...document.querySelectorAll('#sonuc-govde tr[data-fav]')].map(t=>t.textContent)").__len__()==1 and "Norris" in pg.inner_text("#sonuc-govde tr[data-fav]"), mk(pg))
    kontrol("4.2 başka pilot yanlış işaretlenmedi (sonuç tablosu)", pg.evaluate("[...document.querySelectorAll('#sonuc-govde tr')].filter(t=>t.hasAttribute('data-fav')&&!/Norris/.test(t.textContent)).length")==0)
    kontrol("4.3 Analiz: sonuç satırı kırmızı değil + yatay taşma 0", not kirmizi(stil(pg,"#sonuc-govde tr[data-fav] td","backgroundColor")) and tasma(pg)==0)
    kontrol("4.4 diğer pilotlar gizlenmedi (sonuç satırı sayısı değişmedi)", pg.locator("#sonuc-govde tr").count()==11, pg.locator("#sonuc-govde tr").count())
    pg.screenshot(path=SHOT+"04-yaris-sonucu-nor-1100-koyu.png")
    sec(pg,15); ilerle(pg,3); fav(pg,"russell")
    kontrol("4.5 favori bu yarış sonucunda yok (RUS, tur 15) → sonuç tablosunda hiç işaret yok", pg.evaluate("document.querySelectorAll('#sonuc-govde tr[data-fav]').length")==0, mk(pg))
    kontrol("4.6 hata yok", not errs, errs); b.close()
    # ===== 5) BUGÜN aktif hafta sonu (A) ve post-race (C) =====
    pg,errs,c,b=ac(p,"2026-10-09T05:00:00Z"); fav(pg,"norris"); t=isl(pg)
    kontrol("5.1 BUGÜN A: P3 · 150 puan + 'Sıradaki seans: Antrenman 1 · 11:30'", "P3 · 150 puan" in t and "Sıradaki seans: Antrenman 1 · 11:30" in t, t)
    kontrol("5.2 A: hero modu/etiketi değişmedi (UPCOMING), blok LIVE/state rengi değil", pg.evaluate("document.querySelector('#bg-kok [data-mod]').dataset.mod")=="A" and not kirmizi(stil(pg,"#fv-bugun","borderLeftColor")))
    kontrol("5.3 A: uydurma 'son seans sonucu / pozisyon' yok", "Son tamamlanan" not in t and "Yarış sonucu" not in t, t)
    kontrol("5.4 hata yok", not errs, errs); pg.screenshot(path=SHOT+"02-bugun-aktif-hafta-nor-1100-koyu.png"); b.close()
    R17=RES[17]; RES[17]=[r for r in R17 if r["Driver"]["code"]!="NOR"]
    pg,errs,c,b=ac(p,"2026-10-11T18:00:00Z"); fav(pg,"norris"); ilerle(pg,6); t=isl(pg)
    kontrol("5.5 BUGÜN C: favori yarış sonucunda yoksa yalnız şampiyona satırı (sonuç UYDURULMAZ)", "P3 · 150 puan" in t and "Yarış sonucu" not in t, t)
    b.close(); RES[17]=R17
    pg,errs,c,b=ac(p,"2026-10-11T18:00:00Z"); fav(pg,"norris"); ilerle(pg,6); t=isl(pg)
    kontrol("5.6 C: 'Yarış sonucu: P4 · +2 pozisyon' (grid 6 → P4)", "Yarış sonucu: P4 · +2 pozisyon" in t, t)
    pg.screenshot(path=SHOT+"09-bugun-postrace-nor-1100-koyu.png")
    fav(pg,"verstappen"); t=isl(pg)
    kontrol("5.7 C: VER → 'Yarış sonucu: P3 · −1 pozisyon' (grid 2 → P3)", "Yarış sonucu: P3 · −1 pozisyon" in t, t)
    kontrol("5.8 C: podyum satırında yalnız VER işaretli", pg.evaluate("[...document.querySelectorAll('#bg-kok .bg-pod li')].map(l=>l.hasAttribute('data-fav'))") in ([False,False,True],[],), pg.evaluate("[...document.querySelectorAll('#bg-kok .bg-pod li')].map(l=>l.hasAttribute('data-fav'))"))
    kontrol("5.9 hata yok", not errs, errs); b.close()
    # ===== 6) HAFTA / GÜN / profil =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); fav(pg,"norris"); tikla(pg,"nav-haftasonu"); ilerle(pg,6)
    ham=pg.evaluate("[...document.querySelectorAll('#sekme-hafta [data-fav]')].map(e=>e.textContent)")
    kontrol("6.1 HAFTA: işaretli öğeler yalnız NOR içerir (varsa)", all("NOR" in x for x in ham), ham)
    kontrol("6.2 HAFTA: seans gridinde favori işareti yok (grid navigasyon kalır)", pg.evaluate("document.querySelectorAll('#sekme-hafta .h-seans [data-fav], #sekme-hafta .h-grid [data-fav], #sekme-hafta [role=tablist] [data-fav]').length")==0)
    kontrol("6.3 HAFTA: yatay taşma 0", tasma(pg)==0, tasma(pg))
    kontrol("6.4 hata yok", not errs, errs); b.close()
    # profil: pilot profili ★ FAVORİ
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); fav(pg,"norris")
    ok=pg.evaluate("(()=>{try{return ProfilPilot.ac('norris')}catch(e){return 'hata:'+e.message}})()"); ilerle(pg,4)
    kontrol("6.5 pilot profili (favori): panel data-fav, başlıkta ★ FAVORİ (yeni buton yok)", pg.evaluate("document.getElementById('dp-panel')&&document.getElementById('dp-panel').getAttribute('data-fav')")=="1" and pg.evaluate("getComputedStyle(document.querySelector('#dp-panel .dp-baslik'),'::after').content")=='"★ FAVORİ"' and pg.locator("#dp-panel button:has-text('Favoriden çıkar')").count()==0, ok)
    pg.evaluate("ProfilPilot.ac('verstappen')"); ilerle(pg,4)
    kontrol("6.6 başka pilot profili: ★ FAVORİ yok", pg.evaluate("document.getElementById('dp-panel').hasAttribute('data-fav')")==False)
    kontrol("6.7 hata yok", not errs, errs); b.close()
    # ===== 7) MOBİL 390 =====
    for tema in ("koyu","acik"):
        pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=390,tema=tema)
        pg.screenshot(path=SHOT+"06-bugun-favori-yok-390-%s.png"%tema) if tema=="koyu" else None
        fav(pg,"norris"); ilerle(pg,2)
        kontrol("7.%s BUGÜN 390: blok görünür, yatay taşma 0"%tema, vis(pg,"#fv-bugun") and tasma(pg)==0, tasma(pg))
        kontrol("7.%s blok kompakt (≤120px)"%tema, pg.evaluate("document.getElementById('fv-bugun').getBoundingClientRect().height")<=120, pg.evaluate("document.getElementById('fv-bugun').getBoundingClientRect().height"))
        if tema=="koyu": pg.screenshot(path=SHOT+"07-bugun-favori-var-390-koyu.png")
        tikla(pg,"nav-sezon"); ilerle(pg,3)
        W=lambda: pg.evaluate("document.querySelector('#pilot-govde').closest('table').getBoundingClientRect().width")
        w1=W(); fav(pg,""); w0=W(); fav(pg,"norris"); ilerle(pg,2)
        kontrol("7.%s SEZON 390: ★ tablo genişliğini DEĞİŞTİRMEZ (Δ≤0.5px) (sütun düzeni aynı), sayfa taşması 0"%tema, tasma(pg)==0 and abs(w1-w0)<=0.5 and pg.evaluate("document.querySelectorAll('#pilot-govde tr:first-child td').length")==5, (w0,w1,tasma(pg)))
        tikla(pg,"nav-analiz"); ilerle(pg,6)
        kontrol("7.%s ANALİZ 390: yatay taşma 0 + NOR işaretli"%tema, tasma(pg)==0 and pg.locator("#sonuc-govde tr[data-fav]").count()==1, tasma(pg))
        if tema=="acik":
            pg.screenshot(path=SHOT+"05-analiz-favori-390-acik.png")
        kontrol("7.%s top bar chip Faz 2 yapısı aynı (★ NOR, panel kapalı)"%tema, "NOR" in pg.inner_text("#nv-fav") and pg.evaluate("document.getElementById('nv-fav-pop').hidden"))
        kontrol("7.%s hata yok"%tema, not errs, errs); b.close()
    # ===== 8) 1100 açık =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",tema="acik"); fav(pg,"norris"); tikla(pg,"nav-sezon"); ilerle(pg,3)
    kontrol("8.1 açık tema: tint/çizgi kırmızı değil, taşma 0", not kirmizi(stil(pg,"#pilot-govde tr.favori td","backgroundColor")) and not kirmizi(stil(pg,"#fv-sezon","borderLeftColor")) and tasma(pg)==0)
    pg.screenshot(path=SHOT+"08-sezon-1100-acik.png"); b.close()
    # ===== 8b) top bar ★ nötr (dark/light) =====
    for tema in ("koyu","acik"):
        pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",tema=tema); fav(pg,"norris")
        cl=stil(pg,"#nv-fav .nv-yildiz","color"); vr=pg.evaluate("getComputedStyle(document.querySelector('.bg-kod')||document.body).getPropertyValue('--vurgu')")
        kontrol("8b.%s top bar favori ★ kırmızı değil (state kırmızısıyla karışmaz)"%tema, not kirmizi(cl), cl)
        kontrol("8b.%s chip 'NOR' görünür, davranış aynı (panel kapalı, aria-haspopup)"%tema, "NOR" in pg.inner_text("#nv-fav") and pg.get_attribute("#nv-fav","aria-haspopup")=="true" and pg.evaluate("document.getElementById('nv-fav-pop').hidden"))
        if tema=="koyu": pg.screenshot(path=SHOT+"10-topbar-favori-1100-koyu.png",clip={"x":0,"y":0,"width":1100,"height":120})
        b.close()
    # ===== 8c) LIVE kırmızısı ≠ favori =====
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z"); fav(pg,"norris")
    kontrol("8c LIVE hero etiketi kırmızı, favori ★/çizgi/tint kırmızı değil", pg.evaluate("document.querySelector('#bg-kok .bg-kod')!=null") and not kirmizi(stil(pg,"#nv-fav .nv-yildiz","color")) and not kirmizi(stil(pg,"#fv-bugun .fv-y","color")) and not kirmizi(stil(pg,"#fv-bugun","borderLeftColor")), stil(pg,"#bg-kok .bg-kod","color"))
    b.close()
    # ===== 9) ağ =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); n0=len(c.net); fav(pg,"norris"); tikla(pg,"nav-sezon"); ilerle(pg,5); fav(pg,"verstappen"); fav(pg,"")
    kontrol("9.1 favori seç/değiştir/kaldır: yeni openf1 isteği yok", len(c.of)==0, c.of[:3])
    kontrol("9.2 hata yok", not errs, errs); b.close()
L.bitir() if hasattr(L,'bitir') else None
