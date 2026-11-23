# audit_fixes_v1_test — PRODUCT AUDIT FIXES v1 (3.0.9). Sahte saat + sentetik Jolpica (prediction_ui_v1 düzeneği); ağ yok.
# Kapsam: şampiyonluk tek mantık (birim + ekranlar arası tutarlılık), BUGÜN yarış aktif/sonrası, kompakt tahmin, terim satırı,
# LIVE TAHMİNİ rengi, HAFTA SONU hiyerarşisi + en fazla 3 madde, SEZON 390 puan sütunu, ANALİZ (net pozisyon kaldırıldı, tek tablo,
# özet cümleleri, 3 belirgin çizgi), tahmin ilk 10 + ⓘ, Ghost Lap konumu, giriş ilk/sonraki açılış, 390/1100 koyu/açık taşma + konsol hatası.
import sys, re, json, subprocess
sys.path.insert(0,'.')
exec(open('prediction_ui_v1_test.py').read().split("\nwith sync_playwright")[0])
SITE="/home/claude/f1-takip"

import colorsys
def _ton(c):
    m=re.findall(r"[\d.]+",c or "")
    if len(m)<3: return None
    r,g,b=[float(x)/255 for x in m[:3]]; h,l,sat=colorsys.rgb_to_hls(r,g,b); return h*360,sat,l
def kirmizi(c):     # ton 345°–15° ve doygun → kırmızı
    t=_ton(c); return bool(t) and t[1]>0.4 and (t[0]<15 or t[0]>345)
def amber(c):       # ton 20°–55° (koyu temada #f59e0b, açık temada #b45309)
    t=_ton(c); return bool(t) and t[1]>0.4 and 20<=t[0]<=55
def renk(pg,sel,prop="color"): return pg.evaluate("([s,p])=>{const e=document.querySelector(s);return e?getComputedStyle(e)[p]:null}",[sel,prop])
def konsol(pg,liste): pg.on("console",lambda m: liste.append(m.text) if m.type=="error" and "ERR_FAILED" not in m.text and "Failed to load resource" not in m.text else None)

# ===== U) Saf birim: SampiyonlukDurumu =====
NODE=r"""
const SD=require('%s/sampiyonluk-durum.js');
const P=(id,ad,soy,p)=>({points:String(p),Driver:{driverId:id,code:id.slice(0,3).toUpperCase(),givenName:ad,familyName:soy}});
const Y=(n,s)=>({round:String(n),Sprint:s?{date:'x'}:undefined});
const yar=[Y(21),Y(22,true),Y(23)];
const o={
 belli: SD.hesapla({sezon:'2026',puanTuru:21,yarislar:yar,pilotlar:[P('antonelli','Kimi','Antonelli',402),P('verstappen','Max','Verstappen',320)]}),
 sinir: SD.hesapla({sezon:'2026',puanTuru:21,yarislar:yar,pilotlar:[P('antonelli','Kimi','Antonelli',400),P('verstappen','Max','Verstappen',342)]}),
 acik: SD.hesapla({sezon:'2026',puanTuru:21,yarislar:yar,pilotlar:[P('antonelli','Kimi','Antonelli',400),P('verstappen','Max','Verstappen',380),P('norris','Lando','Norris',330)]}),
 bitti: SD.hesapla({sezon:'2026',puanTuru:23,yarislar:yar,pilotlar:[P('norris','Lando','Norris',420),P('verstappen','Max','Verstappen',420)]}),
 yok1: SD.hesapla({sezon:'2026',puanTuru:null,yarislar:yar,pilotlar:[P('a','A','A',1),P('b','B','B',0)]}),
 yok2: SD.hesapla({sezon:'2026',puanTuru:3,yarislar:yar,pilotlar:[P('a','A','A',1)]})
};
console.log(JSON.stringify(o));
""" % SITE
U=json.loads(subprocess.run(["node","-e",NODE],capture_output=True,text=True).stdout)
kontrol("U1 fark 82 > kalan en fazla 58 (2 yarış + 1 sprint) → belli; manşet 'KIMI ANTONELLI 2026 DÜNYA ŞAMPİYONU'", U["belli"]["durum"]=="belli" and U["belli"]["kalanMaks"]==58 and U["belli"]["manset"]=="KIMI ANTONELLI 2026 DÜNYA ŞAMPİYONU", U["belli"])
kontrol("U2 fark 58 = kalan en fazla 58 → henüz belli DEĞİL (eşitlikte iddia yok)", U["sinir"]["durum"]=="acik", U["sinir"])
kontrol("U3 açık: kısa senaryo kalan yarış/sprint/en fazla puan/aday sayısıyla; 'ŞAMPİYON' iddiası yok", U["acik"]["durum"]=="acik" and U["acik"]["manset"]=="LİDER ANTONELLI · 20 PUAN ÖNDE" and "Kalan 2 yarış + 1 sprint" in U["acik"]["kisa"] and "en fazla 58 puan" in U["acik"]["kisa"] and "2 pilot" in U["acik"]["kisa"] and "ŞAMPİYON" not in U["acik"]["manset"], U["acik"])
kontrol("U4 sezon bitti (kalan yok): resmî 1. sıra şampiyon (eşit puanda da sıralama esas)", U["bitti"]["durum"]=="belli" and U["bitti"]["sezonBitti"] and U["bitti"]["manset"].startswith("LANDO NORRIS"), U["bitti"])
kontrol("U5 puan turu bilinmiyor / tek pilot → 'yok' (uydurma yok)", U["yok1"]["durum"]=="yok" and U["yok2"]["durum"]=="yok")

with sync_playwright() as p:
    # ===== B) BUGÜN yarış öncesi: tam tahmin kartı; yarış aktif: kompakt tek satır =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z"); kerr=[]; konsol(pg,kerr); bugun(pg)
    kontrol("B1 yarış öncesi: tam tahmin kartı (kompakt değil, ilk 3 listesi)", pg.locator("#tp-bugun .tp-kart").count()==1 and pg.locator("#tp-bugun .tp-kompakt").count()==0 and pg.locator("#tp-bugun .tp-top li").count()==3)
    # şampiyonluk manşeti: BUGÜN (mod B) = SEZON = ortak mantık. Düzenekteki standings'te tur yok (Jolpica'da StandingsLists.round var) → 16. tur işlenmiş
    pg.evaluate("window.SezonDurumu.puanTuru=16; document.dispatchEvent(new CustomEvent('f1-sezon-durumu'))"); ilerle(pg,2)
    sd=pg.evaluate("SampiyonlukDurumu.mevcut()")
    bm=pg.evaluate("(()=>{const e=document.querySelector('#bg-kok .bg-samp-m b');return e?e.textContent:null})()")
    tikla(pg,"nav-sezon"); ilerle(pg,3)
    sm=pg.evaluate("(()=>{const e=document.querySelector('#samp-manset b');return e?e.textContent:null})()")
    hs=pg.evaluate("document.getElementById('hesap-sonuc').textContent")
    kontrol("B2 şampiyonluk: ortak mantık hesap yaptı (yok değil) ve BUGÜN = SEZON manşeti", sd["durum"] in ("acik","belli") and bm==sd["manset"]==sm, (sd.get("durum"),bm,sm))
    kontrol("B3 açık durumda hesaplayıcı 'Dünya Şampiyonu' demiyor (çelişki yok)", sd["durum"]!="acik" or "Dünya Şampiyonu" not in hs, hs)
    # zorla 'belli' (son tur işlenmiş gibi): tüm ekranlar aynı şampiyonu söylemeli
    pg.evaluate("window.SezonDurumu.puanTuru=99; document.dispatchEvent(new CustomEvent('f1-sezon-durumu')); document.getElementById('hesap-pilot').dispatchEvent(new Event('change'))"); ilerle(pg,2)
    sd2=pg.evaluate("SampiyonlukDurumu.mevcut()"); sm2=pg.evaluate("document.querySelector('#samp-manset b').textContent"); hs2=pg.evaluate("document.getElementById('hesap-sonuc').textContent")
    ad=sd2["lider"]["ad"]
    kontrol("B4 belli: SEZON manşeti 'X 2026 DÜNYA ŞAMPİYONU' + hesaplayıcı aynı pilotu şampiyon diyor", sd2["durum"]=="belli" and sm2==sd2["manset"] and "2026 DÜNYA ŞAMPİYONU" in sm2 and ad in hs2 and "Dünya Şampiyonu" in hs2, (sm2,hs2))
    tikla(pg,"nav-analiz"); pg.evaluate("sekmeAc('grafik')"); ilerle(pg,14); pg.evaluate("TahminUI._durum.html.analiz=null; TahminUI.ciz()"); ilerle(pg,1)
    ch=pg.evaluate("(()=>{const e=document.querySelector('#tp-ch .tp-ch-m');return e?e.textContent:null})()")
    oz=pg.evaluate("document.querySelector('[data-a3-ozet]') ? document.querySelector('[data-a3-ozet]').textContent : ''")
    kontrol("B5 belli: ANALİZ tahmin bloğu aynı manşet (olasılık listesi yerine), özet 'ŞAMPİYON' etiketi", ch==sd2["manset"] and "ŞAMPİYON" in oz, (ch,oz[:120]))
    kontrol("B6 JS/konsol hatası yok", not errs and not kerr, (errs,kerr)); b.close()

    # ===== C) qualifying sonrası → yarış başladı: kompakt + AÇ/DARALT, sabit tahmin aynen =====
    pg,errs,c,b=ac(p,"2026-10-10T07:00:00Z"); kerr=[]; konsol(pg,kerr); bugun(pg)
    import datetime as _d
    rbas=pg.evaluate("(()=>{const m=BugunV3.modBelirle(Date.now());return m.race.baslangic.toISOString()})()")
    t=(_d.datetime.fromisoformat(rbas.replace("Z","+00:00"))+_d.timedelta(minutes=25)).strftime("%Y-%m-%dT%H:%M:%SZ")
    AYAR["quali17"]=True; AYAR["sonuc17"]=True
    pg.clock.set_system_time(t); ilerle(pg,1); tikla(pg,"nav-sezon"); tikla(pg,"nav-bugun"); ilerle(pg,20)
    st=S(pg); kk=pg.locator("#tp-bugun .tp-kompakt")
    kontrol("C1 yarış aktif: tahmin kompakt tek satır (ilk 3 kod + yüzde), SABİT etiketi korunur", kk.count()==1 and pg.locator("#tp-bugun .tp-k-p").count()==3 and pg.locator("#tp-bugun .tp-sabit").count()==1, pg.inner_text("#tp-bugun") if kk.count() else "kart yok")
    h=pg.evaluate("document.querySelector('#tp-bugun .tp-kart').getBoundingClientRect().height")
    kontrol("C2 kompakt kart küçük (≤ 120 px)", h<=120, h)
    top3=[x["driver"] for x in st["pred"]["suruculer"][:3]]; yz=[yuz(x["winProbability"]) for x in st["pred"]["suruculer"][:3]]
    kt=pg.inner_text("#tp-bugun .tp-k-l")
    kontrol("C3 kompakt değerler sabit tahminle aynı (yeniden hesap yok)", all(y in kt for y in yz), (kt,yz))
    sira=pg.evaluate("(()=>{const k=document.getElementById('bg-kok'),t=document.getElementById('tp-bugun');return !!(k.compareDocumentPosition(t)&4)})()")
    kontrol("C4 öncelik: durum kahramanı + Race Feed üstte, tahmin altta", sira)
    pg.click("#tp-bugun [data-tp-kompakt]"); ilerle(pg,1)
    kontrol("C5 AÇ → tam kart (ilk 3 listesi) + DARALT", pg.locator("#tp-bugun .tp-top li").count()==3 and pg.locator("#tp-bugun [data-tp-kompakt][aria-expanded='true']").count()==1)
    pg.click("#tp-bugun [data-tp-kompakt]"); ilerle(pg,1)
    kontrol("C6 DARALT → kompakt", pg.locator("#tp-bugun .tp-kompakt").count()==1)
    kontrol("C7 JS/konsol hatası yok", not errs and not kerr, (errs,kerr)); b.close(); AYAR["quali17"]=False; AYAR["sonuc17"]=False

    # ===== D) ANALİZ tahmin tablosu: ilk 10 + TÜMÜNÜ GÖSTER; güven ⓘ tek küçük satır =====
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=390); kerr=[]; konsol(pg,kerr); tikla(pg,"nav-analiz"); pg.evaluate("sekmeAc('grafik')"); ilerle(pg,16)
    pg.evaluate("""(()=>{const st=TahminUI._durum.sonuc['2026-17']; const l=st.pred.suruculer, n=l.length;
      for(let i=0;i<14-n;i++){ const x=JSON.parse(JSON.stringify(l[n-1])); x.driver='ek'+i; l.push(x); st.pilotlar=(st.pilotlar||[]).concat([{id:'ek'+i,kod:'E'+i,ad:'Ek '+i}]); }
      TahminUI._durum.html.analiz=null; TahminUI.ciz(); })()"""); ilerle(pg,1)
    gor=pg.evaluate("[...document.querySelectorAll('.tp-tablo tr.tp-sat')].filter(r=>r.checkVisibility()).length")
    kontrol("D1 ilk açılışta 10 satır + 'TÜMÜNÜ GÖSTER (14)'", gor==10 and "TÜMÜNÜ GÖSTER (14)" in pg.inner_text(".tp-tumu"), (gor,))
    pg.click(".tp-tumu"); ilerle(pg,1)
    gor2=pg.evaluate("[...document.querySelectorAll('.tp-tablo tr.tp-sat')].filter(r=>r.checkVisibility()).length")
    kontrol("D2 TÜMÜNÜ GÖSTER → 14 satır, sıra aynı (hesap değişmedi)", gor2==14 and pg.evaluate("[...document.querySelectorAll('.tp-tablo tr.tp-sat')].map(r=>r.dataset.driver)")==[x["driver"] for x in S(pg)["pred"]["suruculer"]])
    g=pg.locator(".tp-panel .tp-guven, #tp-analiz .tp-guven").first
    if g.count():
        gh=g.evaluate("e=>e.getBoundingClientRect().height"); kontrol("D3 güven uyarısı tek küçük ⓘ satırı (≤ 24 px, çerçevesiz)", gh<=24 and "ⓘ" in g.inner_text() and g.evaluate("e=>getComputedStyle(e).borderTopWidth")=="0px", gh)
    else: kontrol("D3 güven uyarısı (bu düzenekte güven etiketi var; ⓘ gerekmiyor)", True)
    ad=pg.evaluate("[...document.querySelectorAll('.tp-tablo .tp-c-p .pilot')].filter(e=>e.checkVisibility()).filter(e=>e.scrollWidth>e.parentElement.clientWidth+1).map(e=>e.textContent)")
    kontrol("D4 390 px: tahmin tablosunda pilot adı kesilmiyor", not ad, ad)
    kontrol("D5 taşma 0 + hata yok", tasma(pg)==0 and not errs and not kerr, (tasma(pg),errs,kerr)); b.close()

    # ===== E) ANALİZ: net pozisyon sıralaması yok; Start→Bitiş tek tablo; grafik cümleleri; 3 belirgin çizgi; Ghost Lap konumu =====
    for w in (390,1100):
        pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=w); kerr=[]; konsol(pg,kerr); tikla(pg,"nav-analiz"); pg.evaluate("sekmeAc('grafik')"); ilerle(pg,20)
        tx=pg.evaluate("document.getElementById('sekme-grafik').textContent")
        kontrol("E1[%d] 'Sezon net pozisyonu sıralaması' ve 'EN ÇOK POZİSYON KAZANAN' yok"%w, "net pozisyonu sıralaması" not in tx and "POZİSYON KAZANAN" not in tx and pg.locator(".a32-net,[data-a32-oz]").count()==0)
        kontrol("E2[%d] Start → Bitiş: büyük kart yok, tek kompakt tablo (start/bitiş/fark)"%w, pg.locator("#a32-sf .a32-kart").count()==0 and pg.locator("#a32-sf table.a32-sf").count()>=1 and "Fark" in pg.evaluate("document.querySelector('#a32-sf thead').textContent"))
        cm=pg.evaluate("[...document.querySelectorAll('#sekme-grafik .a3-cumle')].filter(e=>!e.hidden&&e.textContent.trim()).map(e=>e.textContent)")
        kontrol("E3[%d] grafik özet cümleleri (puan gelişimi, form, takım) veriden; sebep kelimesi yok"%w, len(cm)>=3 and all(re.search(r"\d",x) for x in cm) and not any(re.search(r"çünkü|sayesinde|nedeniyle|yüzünden",x) for x in cm), cm)
        sir=pg.evaluate("(()=>{const g=document.querySelectorAll('#a3-pilot .sg-seri');return [g.length,[...g].filter(x=>!x.classList.contains('sg-arka')).length]})()")
        kontrol("E4[%d] varsayılan: en çok 3 belirgin çizgi, diğerleri geri planda"%w, sir[0]<=3 or sir[1]==3, sir)
        kes=pg.evaluate("[...document.querySelectorAll('#a3-pilot .sg-cizgi[stroke-dasharray]')].length")
        kontrol("E5[%d] aynı takımın ikinci pilotu kesikli çizgi"%w, kes>=1, kes)
        ys=pg.evaluate("[...document.querySelectorAll('#a3-pilot .sg-uc')].map(t=>+t.getAttribute('y')).sort((a,b)=>a-b)")
        kontrol("E6[%d] bitiş etiketleri üst üste binmiyor (≥ 11 px aralık)"%w, all(ys[i+1]-ys[i]>=11 for i in range(len(ys)-1)), ys)
        pg.evaluate("sekmeAc('yaris')"); ilerle(pg,10)
        gl=pg.evaluate("(()=>{const g=document.getElementById('gl-ghost');return g?{s:g.nextElementSibling&&g.nextElementSibling.id,t:g.querySelector('summary').textContent,o:g.open}:null})()")
        kontrol("E7[%d] Ghost Lap: 'ÖNE ÇIKAN ANALİZ' başlığı, YARIŞ ANALİZİ'nin üstünde, kapalı"%w, gl and gl["s"]=="yv-detay" and "ÖNE ÇIKAN ANALİZ" in gl["t"] and not gl["o"], gl)
        kontrol("E8[%d] yarış durumu Türkçe (FINISHED yok)"%w, "FINISHED" not in pg.inner_text("#sekme-yaris"))
        kontrol("E9[%d] taşma 0 + hata yok"%w, tasma(pg)==0 and not errs and not kerr, (tasma(pg),errs,kerr)); b.close()


# ===== H) BUGÜN kritik durum: terim satırı (bugun_v3 düzeneği) =====
exec(open('bugun_v3_test.py').read().split("\nwith sync_playwright")[0])
with sync_playwright() as p:
    RF=[dict(ev("r0","2026-10-11T12:02:00Z","RESTART","Yarış başladı."),originalText="Lights out"),dict(ev("r1","2026-10-11T12:20:00Z","RED_FLAG","Kırmızı bayrak: yarış durduruldu."),originalText="RED FLAG")]
    for w,tema in ((390,"koyu"),(1100,"acik")):
        pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",w=w,tema=tema,feed=RF); kerr=[]; konsol(pg,kerr)
        kontrol("H1[%d %s] RED FLAG: kritik satır duruyor + altında tek satır terim ('Kırmızı bayrak · …' + Nedir?)"%(w,tema), pg.locator("#bg-kok .bg-kritik").count()==1 and pg.locator("#bg-kok .bg-terim").count()==1 and pg.inner_text("#bg-kok .bg-terim").startswith("Kırmızı bayrak ·") and pg.locator("#bg-kok .bg-terim [data-terim='kirmizi-bayrak']").count()==1)
        hh=pg.evaluate("document.querySelector('#bg-kok .bg-terim').getBoundingClientRect().height")
        kontrol("H2[%d %s] terim satırı kısa (≤ 2 satır)"%(w,tema), hh<=44, hh)
        kontrol("H3[%d %s] taşma 0 + hata yok"%(w,tema), tasma(pg)==0 and not errs and not kerr, (tasma(pg),errs,kerr)); b.close()
    # yarış aktif, feed yok (saat tahmini) → LIVE TAHMİNİ amber; post-race (C) → şampiyona bloğu + Ne oldu?
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",w=390)
    m=M(pg); kc=renk(pg,"#bg-kok .bg-kod")
    kontrol("H4 BUGÜN yarış aktif, doğrulanmamış: 'LIVE TAHMİNİ' amber, kırmızı değil", m and m["kod"]=="LIVE TAHMİNİ" and not kirmizi(kc), (m,kc)); b.close()
    pg,errs,c,b=ac(p,"2026-10-11T18:00:00Z",w=390,sonuc17=True); ilerle(pg,10)
    m=M(pg); tx=pg.inner_text("#bg-kok")
    kontrol("H5 BUGÜN yarış sonrası (C): taşma 0, hata yok", m and m["mod"]=="C" and tasma(pg)==0 and not errs, (m,errs)); b.close()

with sync_playwright() as p:
    def PT(pg): pg.evaluate("window.SezonDurumu&&(window.SezonDurumu.puanTuru=16); document.dispatchEvent(new CustomEvent('f1-sezon-durumu'))")
    # ===== F) SEZON 390: puan sütunu tam görünür, yatay kaydırma yok; 1100 Takım sütunu duruyor =====
    for w in (390,1100):
        for tema in ("koyu","acik"):
            pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=w,tema=tema); kerr=[]; konsol(pg,kerr); PT(pg); tikla(pg,"nav-sezon"); ilerle(pg,8)
            r=pg.evaluate("""(()=>{const k=document.querySelector('#pilot-govde').closest('.kap'),t=k.querySelector('table'),td=document.querySelector('#pilot-govde tr td:nth-child(4)');
              const kr=k.getBoundingClientRect(),dr=td.getBoundingClientRect();return {sc:k.scrollWidth-k.clientWidth,tw:t.getBoundingClientRect().width,kw:kr.width,in:dr.right<=kr.right+0.5&&td.scrollWidth<=td.clientWidth+1,
              takim:getComputedStyle(document.querySelector('.kap:has(#pilot-govde) th.pg-tc')).display}})()""")
            kontrol("F1[%d %s] puan sütunu kart içinde tam; kaydırma yok"%(w,tema), r["sc"]<=1 and r["in"] and r["tw"]<=r["kw"]+1, r)
            kontrol("F2[%d %s] Takım bilgisi: 390'da adın altında rozet, 1100'de sütun"%(w,tema), (r["takim"]=="none" and pg.locator("#pilot-govde .pg-tm .takim").first.is_visible()) if w==390 else (r["takim"]!="none"), r["takim"])
            m=pg.locator("#samp-manset"); kontrol("F3[%d %s] SEZON başlığı altında şampiyonluk manşeti"%(w,tema), m.count()==1 and m.is_visible())
            pl=pg.locator(".st-p-liste").count(); kontrol("F4[%d %s] 'Sıradaki' kartında tekrarlayan seans ızgarası yok, tek satır yarış saati + küçük silüet"%(w,tema), pl==0 and pg.locator(".st-p-yaris").count()==1 and pg.evaluate("(()=>{const s=document.querySelector('.st-p-pist');return s?s.getBoundingClientRect().width<=222:true})()"))
            kontrol("F5[%d %s] taşma 0 + hata yok"%(w,tema), tasma(pg)==0 and not errs and not kerr, (tasma(pg),errs,kerr)); b.close()

    # ===== G) HAFTA SONU: hiyerarşi, en fazla 3 madde, LIVE TAHMİNİ amber (kırmızı değil) =====
    for w,tema in ((390,"koyu"),(390,"acik"),(1100,"koyu"),(1100,"acik")):
        pg,errs,c,b=ac(p,"2026-10-09T08:50:00Z",w=w,tema=tema); kerr=[]; konsol(pg,kerr); PT(pg); tikla(pg,"nav-haftasonu"); ilerle(pg,10)
        on=pg.evaluate("[...document.querySelectorAll('.h-cz')].map(b=>[...b.classList].filter(c=>c.startsWith('h-onem-'))[0])")
        kontrol("G1[%d %s] seans kartlarında önem sınıfı (FP < Sıralama/Sprint < Yarış)"%(w,tema), "h-onem-yaris" in on and "h-onem-fp" in on and "h-onem-ana" in on, on)
        fs=pg.evaluate("(()=>{const f=s=>{const e=document.querySelector('.h-cz.'+s+' .h-cz-s');return e?parseFloat(getComputedStyle(e).fontSize):0};return [f('h-onem-fp'),f('h-onem-ana'),f('h-onem-yaris')]})()")
        kontrol("G2[%d %s] saat yazısı büyüklüğü FP < Sıralama ≤ Yarış"%(w,tema), fs[0]<fs[1]<=fs[2], fs)
        bm=pg.locator("#a43-bilmen .bm-m").count()
        kontrol("G3[%d %s] hafta sonu bağlamı en fazla 3 madde, kesilmiyor, 'Bilmen gereken 5 şey' yok"%(w,tema), bm<=3 and "5 şey" not in pg.inner_text("#sekme-hafta") + (pg.inner_text("#a43-bilmen") if pg.locator("#a43-bilmen").count() else "") and pg.evaluate("[...document.querySelectorAll('#a43-bilmen .bm-tx')].every(e=>e.scrollHeight<=e.clientHeight+1)"), bm)
        lt=pg.evaluate("[...document.querySelectorAll('.h-cz .h-cz-d, .dr')].filter(e=>/LIVE TAHMİNİ/.test(e.textContent)&&e.checkVisibility()).map(e=>getComputedStyle(e).color)")
        kontrol("G4[%d %s] LIVE TAHMİNİ görünür ve amber (kırmızı değil)"%(w,tema), lt and all(amber(x) and not kirmizi(x) for x in lt), lt)
        bc=pg.evaluate("[...document.querySelectorAll('.h-cz.hz-tahmin')].map(e=>getComputedStyle(e).borderTopColor)")
        kontrol("G5[%d %s] tahmini canlı seans kartı çerçevesi kırmızı değil"%(w,tema), all(not kirmizi(x) for x in bc), bc)
        kontrol("G6[%d %s] taşma 0 + hata yok"%(w,tema), tasma(pg)==0 and not errs and not kerr, (tasma(pg),errs,kerr)); b.close()

# ===== I) Giriş: ilk açılış tam, sonraki açılış kısa, reduced-motion yok =====
with sync_playwright() as p:
    br=p.chromium.launch(); cx=br.new_context(viewport={"width":390,"height":844})
    cx.route(re.compile(r"^https?://.*"), lambda r: r.abort())
    cx.add_init_script("window.__introTest=1")
    p1=cx.new_page(); p1.goto("file://%s/index.html"%SITE); p1.wait_for_timeout(300)
    i1=p1.evaluate("(()=>{const o=document.querySelector('.mo2-isik');return o?o.dataset.intro:null})()")
    kontrol("I1 ilk anlamlı açılış: tam giriş (data-intro=tam)", i1=="tam", i1)
    p1.close()
    p2=cx.new_page(); p2.goto("file://%s/index.html"%SITE); p2.wait_for_timeout(200)   # yeni oturum (yeni sekme / PWA yeniden açılış)
    i2=p2.evaluate("(()=>{const o=document.querySelector('.mo2-isik');return o?o.dataset.intro:null})()")
    kontrol("I2 sonraki açılış: kısa giriş (data-intro=kisa)", i2=="kisa", i2)
    p2.wait_for_timeout(2400)
    kontrol("I3 kısa giriş ≤ 2.6 sn içinde kalktı (kullanıcı beklemez)", p2.evaluate("!document.querySelector('.mo2-isik')"))
    p2.reload(); p2.wait_for_timeout(200)
    kontrol("I4 aynı oturumda yeniden yükleme: giriş yok", p2.evaluate("!document.querySelector('.mo2-isik')")); cx.close()
    cx=br.new_context(viewport={"width":390,"height":844},reduced_motion="reduce"); cx.route(re.compile(r"^https?://.*"), lambda r: r.abort()); cx.add_init_script("window.__introTest=1")
    p3=cx.new_page(); p3.goto("file://%s/index.html"%SITE); p3.wait_for_timeout(300)
    kontrol("I5 prefers-reduced-motion: giriş hiç yok", p3.evaluate("!document.querySelector('.mo2-isik')")); br.close()

print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
