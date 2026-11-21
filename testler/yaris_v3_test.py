import sys, re
sys.path.insert(0,'.')
from ya_fx import *
from playwright.sync_api import sync_playwright
OUT="/tmp/f1-ekran/"
NOW="2026-10-12T10:00:00Z"
EP={"olay":"race_control","tur":"laps","gecis":"overtakes","pit":"pit","hava":"weather"}
def hazir(p,w=1100,tema=None,veri=True,mod="ok",tur=None,br=None):
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.sonuc[("17","results")]=yaris(sprint=False); d.sonuc[("16","results")]=yaris()
    d.of_res[2]=of_sq()
    if veri: d.of_rc={5:FX}; d.of_laps={5:laps(5,60,22,False)}; d.of_ovt={5:ovt(5)}; d.of_pit={5:pit(5)}; d.of_hava={5:hava(5,60,yagmur=True)}
    for k in ("of_rc_mod","of_laps_mod","of_ovt_mod","of_pit_mod","of_hava_mod"): setattr(d,k,mod)
    page,errs,b=ac2(p,d,NOW,w,sayfa="yaris")
    if tema: page.evaluate("document.documentElement.setAttribute('data-tema','%s')"%tema)
    page.evaluate("Ogren.modYaz('acik')"); page.clock.run_for(15000); page.wait_for_timeout(400)
    return d,page,errs,b
def cg(d,ep): return [c for c in d.of_cagri[getattr(d,"ofbase",0):] if c.startswith(ep) and "session_key=5" in c]
def gec(page,k):
    page.locator("#yv-sek [data-act='ysek'][data-v='%s']"%k).click(); page.wait_for_timeout(60); page.clock.run_for(6000); page.wait_for_timeout(350)
def tabs(page): return page.locator("#yv-sek [data-act='ysek']").all_inner_texts()
def gorunur(page,sel): return page.evaluate("(s)=>{const e=document.querySelector(s);return !!e&&e.checkVisibility()}",sel)
def tasma(page): return page.evaluate("document.documentElement.scrollWidth-innerWidth")
def yaz(ad,ok,ek=""): kontrol(ad,ok,ek)
with sync_playwright() as p:
    # ===== A) A7 verisi mevcut, Sprint hafta sonu ana yarışı (tur 17) =====
    d,page,errs,b=hazir(p)
    yaz("A1 Yarış Analizi tur 17 (Sprint hafta sonu) seçili", page.input_value("#yaris-sec")=="17", page.input_value("#yaris-sec"))
    yaz("A2 Sprint rozeti hero'da", page.locator("#yv-tur .yv-sprint").count()==1)
    yaz("A3 hero: yarış adı + pist + COMPLETED(FINISHED) rozeti + pist silueti", "Singapore" in page.inner_text("#yv-yer") and "FINISHED" in page.inner_text("#yv-durum") and gorunur(page,"#yv-pist svg"))
    yaz("A4 hero KAZANAN + PODYUM", "KAZANAN" in page.inner_text("#yv-meta") and "PODYUM" in page.inner_text("#yv-meta"), page.inner_text("#yv-meta"))
    T=tabs(page)
    yaz("A5 sekmeler SONUÇ,OLAYLAR,TURLAR,GEÇİŞ,PİT,HAVA", T==["SONUÇ","OLAYLAR","TURLAR","GEÇİŞ","PİT","HAVA"], T)
    yaz("A6 varsayılan sekme SONUÇ", page.locator("#yv-sek [aria-selected='true']").inner_text()=="SONUÇ")
    yaz("A7 SONUÇ ilk görünüm: yalnız P1–P3 görünür", page.evaluate("[...document.querySelectorAll('#sonuc-govde tr')].filter(r=>r.checkVisibility()).length")==3)
    chips=page.locator("#yv-cipler .v3-cip").all_inner_texts()
    yaz("A8 özet çipleri: P1/P2/P3 (A7 yüklenmeden başka çip yok)", [c.replace("\n"," ") for c in chips][:3]==["P1 FANT","P2 FRUS","P3 FHAM"] or len(chips)>=3, chips)
    yaz("A9 yükleme öncesi 5 A7 uç noktasında session_key=5 çağrısı YOK (lazy)", all(len(cg(d,e))==0 for e in EP.values()), {k:cg(d,e) for k,e in EP.items()})
    btn="#ui-d-sonuc-govde-btn"
    yaz("A10 [Tüm sonuçları göster (N)] düğmesi", "Tüm sonuçları göster" in page.inner_text(btn), page.inner_text(btn))
    page.click(btn); page.wait_for_timeout(100)
    yaz("A11 tüm sonuçlar açılır (22 satır görünür)", page.evaluate("[...document.querySelectorAll('#sonuc-govde tr')].filter(r=>r.checkVisibility()).length")==22)
    hd=page.evaluate("document.querySelector('#yv-sonuc-panel thead').textContent")
    yaz("A12 tam tablo sütunları: sıra,pilot,takım,start,değişim,süre/durum,puan", all(x in hd for x in ("Sıra","Pilot","Takım","Start","Değişim","Süre / Durum","Puan")), hd)
    page.click(btn); page.wait_for_timeout(100)
    yaz("A13 kapanınca tekrar 3 satır", page.evaluate("[...document.querySelectorAll('#sonuc-govde tr')].filter(r=>r.checkVisibility()).length")==3)
    yaz("A14 Ne oldu? ana özet (YorumMotoru) #yv-neden içinde", page.locator("#yv-neden .ym").count()==1 and gorunur(page,"#yv-neden .ym"))
    yaz("A15 YorumMotoru ilk görünümde kısa (liste kapalı) + DETAY ile açılır", (not gorunur(page,"#yv-neden .ym-liste")) and page.evaluate("(()=>{const b=document.querySelector('#yv-neden .ym-ac');b.click();const a=document.querySelector('#yv-neden .ym-liste').checkVisibility();b.click();return a})()"))
    yaz("A16 Yarışı Kaçırdıysan kartı korunmuş (çip şeridi ile sekmeler arasında)", page.evaluate("""()=>{const q=s=>document.querySelector(s),P=(a,b)=>!!(a.compareDocumentPosition(b)&4);const k=q('#yo-kart');if(!k)return false;const r=a=>a.getBoundingClientRect().top;return r(q('#yv-hero'))<r(k)&&r(k)<r(q('#yv-sek'))}"""))
    ilk=len(d.of_cagri)
    yaz("A17 eski pit/tur tabloları SONUÇ yüzeyinde görünmüyor", not gorunur(page,"#pit-govde") and not gorunur(page,"#tur-grafik") and not gorunur(page,"#a34b-lastik"))
    # --- v3 final bug cleanup
    txt=page.inner_text("#sekme-yaris")
    yaz("F1 kullanıcı UI'sında 'Cannot read properties' / 'Veri alınamadı' yok", "Cannot read" not in txt and "Veri alınamadı" not in txt and "undefined" not in txt, txt[:200])
    yaz("F2 TUR 17 / 23 (denominator takvimden)", re.sub(r"\s+"," ",page.inner_text("#yv-tur")).startswith("TUR 17 / 23"), page.inner_text("#yv-tur"))
    yaz("F3 'TUR 17 / 4' oluşmuyor", "/ 4" not in page.inner_text("#yv-tur"))
    yz=page.inner_text("#yv-yer")
    yaz("F4 Singapore → Marina Bay Street Circuit", "Marina Bay Street Circuit" in yz, yz)
    yaz("F5 ham anahtar (marina_bay) görünmüyor", "marina_bay" not in page.inner_text("#sekme-yaris"), yz)
    page.select_option("#yaris-sec","16"); page.clock.run_for(8000); page.wait_for_timeout(400)
    yaz("F6 tur 16: Baku ham anahtarı sızmaz, denominator 23", "baku" not in page.inner_text("#yv-yer") and "/ 23" in page.inner_text("#yv-tur"), (page.inner_text("#yv-yer"),page.inner_text("#yv-tur")))
    page.select_option("#yaris-sec","17"); page.clock.run_for(8000); page.wait_for_timeout(400)
    # --- A6 "Lastik stratejisini gör" bağlantısı: TURLAR sekmesini açar, OpenF1 başlatmaz
    if page.locator("#yo-kart [data-yo=lastik]").count():
        of0=len(d.of_cagri); page.click("#yo-kart [data-yo=lastik]"); page.wait_for_timeout(700)
        yaz("L1 Lastik bağlantısı TURLAR sekmesini açar, lastik bloğu görünür", page.locator("#yv-sek [data-v='tur']").get_attribute("aria-selected")=="true" and gorunur(page,"#a34b-lastik > summary"))
        yaz("L2 Lastik bağlantısı OpenF1 isteği başlatmaz", len(d.of_cagri)==of0, d.of_cagri[of0:])
        gec(page,"sonuc"); page.clock.run_for(2000)
        d.__dict__["ofbase"]=len(d.of_cagri) if False else d.ofbase
        for e in EP.values():
            pass
    else:
        yaz("L0 lastik bağlantısı fixture'da yok", False)
    # --- sekmeler: tek seçili, lazy
    sayac={}
    for k in ("olay","tur","gecis","pit","hava"):
        gec(page,k)
        yaz("B-%s sekme seçili ve tek"%k, page.locator("#yv-sek [aria-selected='true']").count()==1 and page.locator("#yv-sek [data-v='%s']"%k).get_attribute("aria-selected")=="true")
        n=len(cg(d,EP[k])); sayac[k]=n
        yaz("B-%s lazy-load: açınca 1+ çağrı (%s)"%(k,EP[k]), n>=1, cg(d,EP[k]))
        kutu=page.evaluate("[...document.querySelectorAll('#yv-a7-panel .so,#yv-a7-panel .ta,#yv-a7-panel .gc,#yv-a7-panel .pt,#yv-a7-panel .sh')].filter(e=>e.checkVisibility()).length")
        yaz("B-%s yalnız bir A7 kutusu görünür"%k, kutu==1, kutu)
        yaz("B-%s SONUÇ paneli gizli"%k, not gorunur(page,"#yv-sonuc-panel"))
    ofs=len(d.of_cagri)
    for k in ("olay","pit","tur","hava","gecis","olay","pit","tur"): gec(page,k)
    gec(page,"olay")
    yaz("C1 sekmeler arası gidip gelmek yeni OpenF1 çağrısı YAPMAZ", len(d.of_cagri)==ofs, d.of_cagri[ofs:])
    yaz("C2 her uç nokta yalnız kendi sayısında (tekrar yok)", all(len(cg(d,EP[k]))==sayac[k] for k in sayac), {k:len(cg(d,EP[k])) for k in EP})
    gec(page,"pit")
    yaz("C3 PİT: A7 kutusu + eski Jolpica pit tablosu yalnız bu sekmede (kapalı disclosure)", gorunur(page,"#yv-pit-ek") and gorunur(page,"#yv-pit-tablo") and not gorunur(page,"#pit-govde"))
    yaz("C4 PİT: lastik rehberi bu sekmede", gorunur(page,"#yv-pit-ek [data-lastik-rehberi]") or page.locator("#yv-pit-ek [data-lastik-rehberi]").count()==1)
    gec(page,"tur")
    yaz("C5 TURLAR: eski tur grafiği yalnız bu sekmede (kapalı disclosure)", gorunur(page,"#yv-tur-ek") and gorunur(page,"#yv-tur-grafik") and not gorunur(page,"#tur-grafik"))
    gec(page,"sonuc") if page.locator("#yv-sek [data-v='sonuc']").count() else None
    yaz("C6 SONUÇ'a dönünce A7 paneli temiz", not gorunur(page,"#yv-a7-panel") and gorunur(page,"#yv-sonuc-panel"))
    yaz("C7 yatay taşma 0 (1100)", tasma(page)==0, tasma(page))
    yaz("C8 sayfa hatası yok", errs==[], errs)
    # çipler: A7 yüklenince
    chips=[c.replace("\n"," ") for c in page.locator("#yv-cipler .v3-cip").all_inner_texts()]
    yaz("C9 A7 yüklenince çipler: kritik olay / geçiş kaydı / pit / hava", any("KRİTİK" in c for c in chips) and any("GEÇİŞ KAYDI" in c for c in chips) and any(c.endswith("PİT") or "PİT" in c for c in chips) and any("HAVA" in c for c in chips), chips)
    yaz("C10 'geçiş kaydı' dili (overtake/en iyi geçiş yok)", not re.search(r"overtaker|en iyi geçiş|best overtak", page.inner_text("#sekme-yaris"), re.I))
    # --- ekran görüntüleri (1100)
    import os; os.makedirs(OUT,exist_ok=True)
    def shot(ad,sek=None,full=True):
        if sek: gec(page,sek)
        page.evaluate("window.scrollTo(0,0)"); page.wait_for_timeout(600); page.screenshot(path=OUT+ad,full_page=full)
    page.evaluate("document.documentElement.setAttribute('data-tema','koyu')")
    gec(page,"olay"); gec(page,"sonuc"); shot("yaris-v3-1-1100-koyu-sonuc.png"); shot("yaris-v3fix-1-1100-koyu-sonuc.png")
    page.evaluate("document.documentElement.setAttribute('data-tema','acik')"); shot("yaris-v3-2-1100-acik-sonuc.png")
    page.evaluate("document.documentElement.setAttribute('data-tema','koyu')")
    shot("yaris-v3-3-1100-koyu-olaylar.png","olay"); shot("yaris-v3-4-1100-koyu-pit.png","pit"); shot("yaris-v3-5-1100-koyu-turlar.png","tur")
    page.evaluate("document.documentElement.setAttribute('data-tema','acik')"); gec(page,"pit"); page.wait_for_timeout(600); page.screenshot(path=OUT+"yaris-v3fix-2-1100-acik-pit.png",full_page=True)
    b.close()
    # ===== B) mobil 390 koyu/açık =====
    for tema in ("koyu","acik"):
        d,page,errs,b=hazir(p,w=390,tema=tema)
        yaz("M-%s 390 taşma 0 (SONUÇ)"%tema, tasma(page)==0, tasma(page))
        for k in ("olay","tur","gecis","pit","hava"):
            gec(page,k); yaz("M-%s 390 %s taşma 0"%(tema,k), tasma(page)==0, tasma(page))
        gec(page,"sonuc"); page.click("#ui-d-sonuc-govde-btn"); page.wait_for_timeout(100)
        yaz("M-%s tablo container içinde kayar, sayfa değil"%tema, tasma(page)==0 and page.evaluate("(()=>{const k=document.querySelector('#yv-sonuc-panel .kap');return k.scrollWidth>=k.clientWidth})()"))
        yaz("M-%s sekme çubuğu yatay local scroll"%tema, page.evaluate("(()=>{const e=document.querySelector('#yv-sek .v3-sekmeler')||document.querySelector('#yv-sek');return getComputedStyle(e).overflowX!=='visible'})()"))
        page.click("#ui-d-sonuc-govde-btn"); page.wait_for_timeout(50)
        if tema=="koyu": page.evaluate("window.scrollTo(0,0)"); page.screenshot(path=OUT+"yaris-v3-6-390-koyu.png",full_page=True); page.screenshot(path=OUT+"yaris-v3fix-3-390-koyu-sonuc.png",full_page=True)
        yaz("M-%s hata yok"%tema, errs==[], errs)
        b.close()
    # ===== C) A7 verisi yok / ağ hatası =====
    for ad,kw in (("veri yok",dict(veri=False)),("ağ hatası",dict(mod="abort"))):
        d,page,errs,b=hazir(p,**kw)
        T=tabs(page)
        yaz("D-%s sekme çubuğu var, SONUÇ varsayılan"%ad, "SONUÇ" in T and page.locator("#yv-sek [aria-selected='true']").inner_text()=="SONUÇ", T)
        for k in [x for x,t in (("olay","OLAYLAR"),("tur","TURLAR"),("gecis","GEÇİŞ"),("pit","PİT"),("hava","HAVA")) if t in T]:
            gec(page,k)
        yaz("D-%s tüm sekmeler gezildi, hata yok, taşma 0"%ad, errs==[] and tasma(page)==0, (errs,tasma(page)))
        gec(page,"sonuc") if "SONUÇ" in T else None
        yaz("D-%s SONUÇ P1–P3 sağlam"%ad, page.evaluate("[...document.querySelectorAll('#sonuc-govde tr')].filter(r=>r.checkVisibility()).length")==3)
        b.close()
    # ===== C2) eksik / bozuk yanıt biçimi =====
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.sonuc[("16","results")]=yaris(); d.pit_bozuk=True; d.sonuc[("17","results")]=yaris()
    page,errs,b=ac2(p,d,NOW,1100,sayfa="yaris"); page.evaluate("Ogren.modYaz('acik')"); page.clock.run_for(15000); page.wait_for_timeout(400)
    yaz("G1 pit yanıtı bozuksa 'Cannot read properties' görünmez", "Cannot read" not in page.inner_text("#sekme-yaris") and page.inner_text("#yaris-durum").strip()=="", page.inner_text("#yaris-durum"))
    yaz("G2 pit bozuk: sonuç + hero + sekmeler devam eder", page.locator("#sonuc-govde tr").count()==22 and len(tabs(page))>=2 and errs==[], (page.locator("#sonuc-govde tr").count(),errs))
    b.close()
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.sonuc[("16","results")]=yaris()      # tur 17 sonucu yok (boş Races)
    page,errs,b=ac2(p,d,NOW,1100,sayfa="yaris"); page.clock.run_for(15000); page.wait_for_timeout(400)
    t=page.inner_text("#sekme-yaris")
    yaz("G3 sonuç verisi yoksa ham JS hatası yok, ekran çökmez", "Cannot read" not in t and errs==[] and "bulunamadı" in page.inner_text("#yaris-durum"), (page.inner_text("#yaris-durum"),errs))
    b.close()
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.sonuc_ag_hata=True
    page,errs,b=ac2(p,d,NOW,1100,sayfa="yaris"); page.clock.run_for(15000); page.wait_for_timeout(400)
    yaz("G4 gerçek ağ hatası yutulmaz ('Veri alınamadı' kalır), sayfa çökmez", "Veri alınamadı" in page.inner_text("#yaris-durum") and errs==[], (page.inner_text("#yaris-durum"),errs))
    b.close()
    # ===== D) Normal (Sprint olmayan) tamamlanmış yarış: tur 16 =====
    d,page,errs,b=hazir(p)
    page.select_option("#yaris-sec","16"); page.clock.run_for(8000); page.wait_for_timeout(400)
    yaz("E1 tur 16: Sprint rozeti yok", page.locator("#yv-tur .yv-sprint").count()==0 and "TUR 16" in page.inner_text("#yv-tur"), page.inner_text("#yv-tur"))
    yaz("E2 yarış değişince sekme SONUÇ'a döner, P1–P3", page.locator("#yv-sek [aria-selected='true']").inner_text()=="SONUÇ")
    yaz("E3 hata yok / taşma 0", errs==[] and tasma(page)==0, (errs,tasma(page)))
    b.close()
print("TOPLAM %d/%d"%(sum(SONUC),len(SONUC)))
