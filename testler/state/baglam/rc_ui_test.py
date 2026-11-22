import sys, json
sys.path.insert(0,"/home/claude/f1-takip/testler/state")
from state_ui_lib import *
from playwright.sync_api import sync_playwright
import state_ui_lib as L
FX=json.loads(__import__("subprocess").check_output(["node","-e","console.log(JSON.stringify(require('/home/claude/f1-takip/testler/state/baglam/rc_fixture_sq.js')))"]))
for r in FX: r["session_key"]=2; r["meeting_key"]=2000   # mock oturum 2 = Sprint Qualifying
NOW="2026-10-12T10:00:00Z"
def rcc(d): return [c for c in d.of_cagri[getattr(d,"ofbase",0):] if "race_control" in c]
def hazir(p,w=1100,sq=True,mod="ok"):
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.of_res[2]=of_sq(); d.of_rc={2:FX} if sq else {}; d.of_rc_mod=mod
    page,errs,br=ac2(p,d,NOW,w); return d,page,errs,br
def ac_blok(page,i=0):
    page.locator(".so-ac").nth(i).click(); page.wait_for_timeout(50); page.clock.run_for(3000); page.wait_for_timeout(300)
with sync_playwright() as p:
    d,page,errs,br=hazir(p)
    kontrol("R0 açılışta/açmadan race_control çağrısı YOK (tembel)", len(rcc(d))==0, rcc(d))
    # SQ kartı
    kartlar=page.locator(".h-seans"); n=kartlar.count()
    idx=[i for i in range(n) if "Sprint Qualifying" in kart(page,i) or "Sprint Sıralama" in kart(page,i)]
    kontrol("R1 tamamlanmış kartlarda 'Seans Olayları' var", page.locator(".so-ac").count()>=1, page.locator(".so-ac").count())
    sqi=[i for i in range(page.locator(".so").count()) if page.locator(".so").nth(i).get_attribute("data-seans")=="SprintQualifying"]
    kontrol("R1b SprintQualifying kutusu bulundu", len(sqi)==1, sqi)
    ac_blok(page,sqi[0] if sqi else 0)
    kutu=page.locator(".so[data-seans='SprintQualifying']"); tx=kutu.inner_text().replace("\n"," | ")
    kontrol("R2 açınca tam 1 race_control çağrısı, session_key=2", len(rcc(d))==1 and "session_key=2" in rcc(d)[0], rcc(d))
    sat=kutu.locator(".so-sat").count()
    kontrol("R3 ilk görünüm 3–5 satır", 3<=sat<=5, sat)
    kontrol("R4 KIRMIZI BAYRAK + DAMALI BAYRAK görünür; kaynak etiketi", "KIRMIZI BAYRAK" in tx and "DAMALI BAYRAK" in tx and "Kaynak: OpenF1 / Race Control" in tx, tx[:300])
    kontrol("R5 'Tüm olayları göster (N)' düğmesi", "Tüm olayları göster (" in tx, tx[-200:])
    kontrol("R6 ham İngilizce 'SESSION ABORTED' ilk görünümde yok", "SESSION ABORTED" not in tx)
    kutu.locator("[data-so-act=tumu]").click(); page.wait_for_timeout(100)
    tx2=kutu.inner_text().replace("\n"," | "); sat2=kutu.locator(".so-sat").count()
    kontrol("R7 tümü: daha çok satır, SEANS YENİDEN BAŞLADI + BAŞLANGIÇ GECİKECEK", sat2>sat and "SEANS YENİDEN BAŞLADI" in tx2 and "BAŞLANGIÇ GECİKECEK" in tx2, tx2[:400])
    # kapat/aç → yeni çağrı yok
    page.locator(".so-ac").nth(sqi[0]).click(); page.locator(".so-ac").nth(sqi[0]).click(); page.wait_for_timeout(200); page.clock.run_for(3000)
    kontrol("R8 kapat/aç: tekrar race_control çağrısı YOK", len(rcc(d))==1, rcc(d))
    # yeniden çizim açık kalır
    page.evaluate("document.dispatchEvent(new Event('f1-feed-guncel'))"); page.wait_for_timeout(200)
    kontrol("R9 hafta yeniden çizilince blok açık kalır", page.locator(".so[data-seans='SprintQualifying'] .so-sat").count()>0)
    # başka oturum (SQ dışı) karışmıyor: Practice 1 aç → 404 → yayımlanmadı mesajı; SQ olayları görünmez
    fp=page.locator(".so[data-seans='FirstPractice']")
    if fp.count():
        fp.locator(".so-ac").click(); page.wait_for_timeout(50); page.clock.run_for(3000); page.wait_for_timeout(300)
        t=fp.inner_text()
        kontrol("R10 FP1: başka oturumun olayı karışmaz + 'henüz yayımlanmadı' mesajı", "KIRMIZI BAYRAK" not in t and "Race Control verisi henüz yayımlanmadı." in t, t)
        kontrol("R10b FP1 için ayrı session_key=1 çağrısı", any("session_key=1" in c for c in rcc(d)) and len(rcc(d))==2, rcc(d))
    kontrol("R11 hata yok", not errs, errs)
    # dark/light
    for tema in ("koyu","acik"):
        page.evaluate("t=>document.documentElement.setAttribute('data-tema',t)",tema)
        kontrol("R12 tema "+tema+" uygulandı + blok görünür", page.evaluate("document.documentElement.getAttribute('data-tema')")==tema and kutu.locator(".so-sat").first.is_visible())
    br.close()
    # ağ hatası
    d,page,errs,br=hazir(p,mod="abort"); ac_blok(page,[i for i in range(page.locator(".so").count()) if page.locator(".so").nth(i).get_attribute("data-seans")=="SprintQualifying"][0])
    t=page.locator(".so[data-seans='SprintQualifying']").inner_text()
    kontrol("R13 ağ hatası: 'OpenF1 Race Control verisine şu anda ulaşılamıyor.' (yayımlanmadı DEĞİL)", "OpenF1 Race Control verisine şu anda ulaşılamıyor." in t and "henüz yayımlanmadı" not in t, t)
    kontrol("R13b Yeniden dene düğmesi var", page.locator(".so-btn").count()==1)
    br.close()
    # veri yok
    d,page,errs,br=hazir(p,sq=False); ac_blok(page,[i for i in range(page.locator(".so").count()) if page.locator(".so").nth(i).get_attribute("data-seans")=="SprintQualifying"][0])
    t=page.locator(".so[data-seans='SprintQualifying']").inner_text()
    kontrol("R14 veri yok: 'Race Control verisi henüz yayımlanmadı.'", "Race Control verisi henüz yayımlanmadı." in t and "ulaşılamıyor" not in t, t)
    br.close()
    # canlı/yaklaşan seans: blok yok, çağrı yok
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.of_rc={2:FX}
    page,errs,br=ac2(p,d,"2026-10-09T12:40:00Z",1100)   # SQ sürerken
    kutuSQ=page.locator(".so[data-seans='SprintQualifying']")
    kontrol("R15 canlı seansta 'Seans Olayları' YOK, race_control çağrısı yok", kutuSQ.count()==0 and len(rcc(d))==0, (kutuSQ.count(),rcc(d)))
    br.close()
    # 390px + 1100px yatay taşma
    for w in (390,1100):
        d,page,errs,br=hazir(p,w=w); i=[i for i in range(page.locator(".so").count()) if page.locator(".so").nth(i).get_attribute("data-seans")=="SprintQualifying"][0]
        ac_blok(page,i); page.locator(".so[data-seans='SprintQualifying'] [data-so-act=tumu]").click(); page.wait_for_timeout(100)
        tas=page.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
        kontrol("R16 %dpx: yatay taşma yok, satırlar görünür"%w, not tas and page.locator(".so-sat").count()>5, tas)
        br.close()
print("\n%d/%d"%(sum(SONUC),len(SONUC))); sys.exit(0 if all(SONUC) else 1)
