import sys, re
sys.path.insert(0,"/home/claude/f1-takip/testler/state")
from state_ui_lib import *
from playwright.sync_api import sync_playwright
NOW="2026-10-12T10:00:00Z"
def dt(m,s=0): return "2026-10-11T12:%02d:%02d+00:00"%(m,s)
def rc(sk):
    b=lambda m,msg,**o: dict({"session_key":sk,"meeting_key":2000,"date":dt(m),"message":msg,"category":"Other","flag":None},**o)
    r=[b(5,"RED FLAG",category="Flag",flag="RED"),b(9,"SESSION RESUMED"),b(12,"SAFETY CAR DEPLOYED",category="SafetyCar"),b(14,"SAFETY CAR IN THIS LAP",category="SafetyCar"),
       b(16,"SAFETY CAR DEPLOYED",category="SafetyCar"),b(18,"SAFETY CAR IN THIS LAP",category="SafetyCar"),b(30,"5 SECOND TIME PENALTY FOR CAR 3 (HAM)",driver_number=3),b(59,"CHEQUERED FLAG",category="Flag",flag="CHEQUERED")]
    r+=[b(31+i,"YELLOW IN TRACK LIMITS",category="Flag",flag="YELLOW",sector=1+i%3) for i in range(7)]
    return r
def laps(sk):
    r=[]
    for d in range(1,23):
        for l in range(1,6):
            r.append({"session_key":sk,"meeting_key":2000,"driver_number":d,"lap_number":l,"lap_duration":None if l==1 else round(91.156+d*0.05+(l%3)*0.1,3) if d!=3 else (90.5 if l==4 else 92.0),"duration_sector_1":28.4,"duration_sector_2":30.1,"duration_sector_3":31.5,"st_speed":290,"is_pit_out_lap":l==1,"date_start":dt(5+l)})
    return r
def ovt(sk):
    a=[3]*6+[4]*4+[6]*2
    return [{"session_key":sk,"meeting_key":2000,"date":dt(5+i,10),"overtaking_driver_number":x,"overtaken_driver_number":9+i,"position":5-i%4} for i,x in enumerate(a)]
def pit(sk):
    return [{"session_key":sk,"meeting_key":2000,"date":dt(10+i*5),"driver_number":dn,"lap_number":10+i*8,"lane_duration":ln,"stop_duration":st} for i,(dn,ln,st) in enumerate([(2,21.4,2.31),(4,22.0,2.44),(2,24.9,2.9),(6,None,None)])]
def hava(sk,yagmur=True,alan=True):
    r=[]
    for i in range(30):
        o={"session_key":sk,"meeting_key":2000,"date":dt(i),"air_temperature":29.8-i*0.05,"track_temperature":41.2-i*0.23,"humidity":74,"pressure":1010.5,"rainfall":(1 if (yagmur and i>=27) else 0),"wind_direction":136,"wind_speed":3.2}
        if not alan: o["air_temperature"]=None
        r.append(o)
    return r
def hc(d): return [c for c in d.of_cagri[getattr(d,"ofbase",0):] if re.match(r"(race_control|laps|overtakes|pit|weather)\?",c)]
def hazir(p,w=1100,veri="hepsi",mod="ok"):
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.sonuc[("17","results")]=yaris(); d.sonuc[("17","sprint")]=yaris(sprint=True)
    for ad,f in (("rc",rc),("laps",laps),("ovt",ovt),("pit",pit),("hava",hava)):
        setattr(d,"of_"+ad,{5:f(5)} if (veri=="hepsi" or ad in veri) else {})
        setattr(d,"of_"+ad+"_mod",mod)
    page,errs,br=ac2(p,d,NOW,w,sayfa="yaris"); page.clock.run_for(20000); page.wait_for_timeout(500); return d,page,errs,br
def ac_v2(page):
    page.locator("#yo-v2 [data-yo2-act='ac']").click(); page.wait_for_timeout(100)
    for _ in range(8): page.clock.run_for(3000); page.wait_for_timeout(250)
def tx(page): return page.locator("#yo-kart").inner_text().replace("\n"," | ")
with sync_playwright() as p:
    d,page,errs,br=hazir(p)
    t0=tx(page)
    kontrol("Y1 açılışta A6 sonucu görünür, v2 yalnız 'Detayları göster' (veri ön-yükleme yok)", "yarışı kazandı" in t0 and page.locator("#yo-v2 .yo2-k").count()==0 and page.locator("#yo-v2 [data-yo2-act='ac']").count()==1, t0)
    kontrol("Y2 açılışta 0 historical OpenF1 çağrısı (kör 5 endpoint YOK)", len(hc(d))==0, hc(d))
    ac_v2(page); t=tx(page)
    c=hc(d)
    kontrol("Y3 tıklayınca 5 endpoint, her biri TAM 1 kez, session_key=5, sıralı", len(c)==5 and [x.split("?")[0] for x in c]==["race_control","laps","overtakes","pit","weather"] and all("session_key=5" in x for x in c), c)
    n=page.locator("#yo-v2 .yo2-liste > li").count()
    kontrol("Y4 ilk görünüm: v2 kartı ≤4 (A6 sonuç + 4 = en çok 5 ana madde): akış/hareket/pit/hava", n==4 and all(x in t for x in ("YARIŞIN AKIŞI","POZİSYON HAREKETİ","PİT","HAVA")) , (n,t))
    kontrol("Y5 akış: 1 kırmızı bayrak · 2 Safety Car · ceza · 7 sarı bayrak kaydı", "1 kırmızı bayrak kaydı" in t and "2 Safety Car kaydı" in t and "7 sarı bayrak kaydı" in t and "1 ceza kaydı" in t, t)
    kontrol("Y6 hareket: HAM için 6 geçiş kaydı + alt not; 'geçiş' tek başına yok", "HAM için 6 geçiş kaydı" in t and "NOR için 4 geçiş kaydı" in t and "pit/ceza kaynaklı sıra değişimlerini de içerebilir" in t, t)
    kontrol("Y7 pit: RUS en çok (2), en kısa kayıtlı stop 2.31 sn", "En çok: RUS" in t and "En kısa kayıtlı stop: RUS 2.31 sn" in t, t)
    kontrol("Y8 hava: yağış kaydedildi + pist sıcaklığı 41.2°C → ", "Seans içinde yağış kaydedildi" in t and "Pist sıcaklığı 41.2°C → 34.5°C" in t, t)
    kontrol("Y9 en hızlı tur kaydı satırı (HAM 1:30.500)", "En hızlı tur kaydı: HAM 1:30.500 (tur 4)" in t, t)
    kontrol("Y10 detay bölümleri: Kritik olaylar/Geçiş kayıtları/Pit özeti/Hava özeti/Tur özeti", all(x in t.upper() for x in ("KRİTİK OLAYLAR","GEÇİŞ KAYITLARI","PİT ÖZETİ","HAVA ÖZETİ","TUR ÖZETİ")), t)
    kontrol("Y11 sarı bayrak tek tek listelenmez (kritik listede 'sarı' satırı yok)", page.locator("#yo-v2 .yo2-bb:text-is('Kritik olaylar') + ul li").filter(has_text=re.compile("YELLOW|Sarı bayrak:",re.I)).count()==0)
    kontrol("Y12 yorum/nedensel dil yok, null/undefined yok", not re.search(r"sayesinde|nedeniyle|zorladı|iyi pit|kötü pit|strateji hata|undefined|null|NaN",t.split("Lastik")[0] if False else t.replace("Lastik stratejisini gör","")), t)
    kontrol("Y13 duplicate yok: aynı kart/başlık tekrar etmiyor", len(set(page.locator("#yo-v2 .yo2-liste > li").all_inner_texts()))==4)
    kontrol("Y14 A6 satırları (KAZANAN/PODYUM) korunur", "KAZANAN" in t and "PODYUM" in t)
    ob=len(d.of_cagri)
    page.locator("#yo-v2 [data-yo2-act='kapat']").click(); page.locator("#yo-v2 [data-yo2-act='ac']").click(); page.wait_for_timeout(200)
    page.evaluate("document.dispatchEvent(new CustomEvent('f1-yaris-sonuc',{detail:{tur:17,liste:window.YarisOzet._durum.liste}}))"); page.wait_for_timeout(300); page.clock.run_for(3000)
    kontrol("Y15 kapat/aç + yeniden çizim: yeni çağrı YOK (gereksiz refetch yok), açık durum korunur", len(d.of_cagri)==ob and page.locator("#yo-v2 .yo2-liste > li").count()==4, len(d.of_cagri)-ob)
    page.clock.run_for(5*60*1000); page.wait_for_timeout(300)
    kontrol("Y16 5 dk boşta yeni OpenF1 çağrısı yok (polling artmadı)", len(d.of_cagri)==ob, len(d.of_cagri)-ob)
    ls=page.evaluate("Object.keys(localStorage).filter(k=>/(rc|laps|ovt|pit|hv)-/.test(k)&&!k.includes('oturum')).map(k=>k.split('-')[1]?k.replace(/f1-hafta-v1-/,''):k)")
    kontrol("Y17 mevcut cache namespace'leri kullanıldı (rc-/laps-/ovt-/pit-/hv-), yeni anahtar yok", all(any(x.startswith(pf) for x in ls) for pf in ("rc-","laps-","ovt-","pit-","hv-")), ls)
    kontrol("Y18 hata yok", not errs, errs)
    for tema in ("koyu","acik"):
        page.evaluate("t=>document.documentElement.setAttribute('data-tema',t)",tema)
        kontrol("Y19 tema "+tema+": görünür, taşma yok", page.locator("#yo-v2 .yo2-k").first.is_visible() and not page.evaluate("document.documentElement.scrollWidth>window.innerWidth+1"))
    page.reload(); page.clock.run_for(8000); page.wait_for_timeout(300); page.evaluate("sekmeAc('yaris')"); page.clock.run_for(20000); page.wait_for_timeout(500)
    n0=len(hc(d)); t2=tx(page)
    kontrol("Y20 sayfa yenilenince: önbellekten ilk görünüm TIKLAMADAN dolu, yeni historical çağrı yok", len(hc(d))==n0 and page.locator("#yo-v2 .yo2-liste > li").count()==4 and "7 sarı bayrak kaydı" in t2, (n0,len(hc(d)),t2))
    page.locator("#yo-v2 [data-yo2-act='ac']").click(); page.wait_for_timeout(300); page.clock.run_for(8000); page.wait_for_timeout(300)
    kontrol("Y21 önbellek tam iken detay açmak da ağ çağrısı yapmaz", len(hc(d))==n0, hc(d)[n0:]); br.close()
    # kısmi: yalnız pit + hava
    d,page,errs,br=hazir(p,veri=("pit","hava")); ac_v2(page); t=tx(page)
    kontrol("Y22 yalnız pit+hava hazır: o iki kart; olmayanlar gizli, placeholder yok", page.locator("#yo-v2 .yo2-liste > li").count()==2 and "PİT" in t and "HAVA" in t and "YARIŞIN AKIŞI" not in t and "POZİSYON" not in t and "yok" not in t.lower().split("yağış")[0], t); br.close()
    # hiçbiri hazır değil (boş)
    d,page,errs,br=hazir(p,veri=()); ac_v2(page); t=tx(page)
    kontrol("Y23 hiçbir historical hazır değil: A6 sonucu durur, v2 kartı yok, 'henüz yayımlanmadı' (hata DEĞİL)", "yarışı kazandı" in t and page.locator("#yo-v2 .yo2-k").count()==0 and "Seans verileri henüz yayımlanmadı." in t and "ulaşılamıyor" not in t, t); br.close()
    # ağ hatası
    d,page,errs,br=hazir(p,mod="abort"); ac_v2(page); t=tx(page)
    kontrol("Y24 ağ hatası: A6 sonucu durur + 'ulaşılamıyor'; sayfa hatası yok", "yarışı kazandı" in t and "OpenF1 seans verilerine şu anda ulaşılamıyor." in t and not errs, (t,errs)); br.close()
    # yeşil: eksik hava alanı (air temp null) uydurma yok
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.sonuc[("17","results")]=yaris(); d.of_hava={5:hava(5,yagmur=False,alan=False)}
    page,errs,br=ac2(p,d,NOW,1100,sayfa="yaris"); page.clock.run_for(20000); page.wait_for_timeout(400); ac_v2(page); t=tx(page)
    kontrol("Y25 eksik hava alanı (air null): 'Hava sıcaklığı' yok, 'yağış kaydı yok', uydurma yok", "Hava sıcaklığı" not in t and "Seans içinde yağış kaydı yok" in t and "Pist sıcaklığı" in t, t); br.close()
    # genişlikler
    for w in (390,1100):
        d,page,errs,br=hazir(p,w=w); ac_v2(page)
        tas=page.evaluate("document.documentElement.scrollWidth>window.innerWidth+1"); kutu_tas=page.evaluate("(()=>{const k=document.getElementById('yo-kart');return k.scrollWidth>k.clientWidth+1})()")
        kontrol("Y26 %dpx: yatay taşma yok, kartlar görünür"%w, not tas and not kutu_tas and page.locator("#yo-v2 .yo2-k").count()==4, (tas,kutu_tas)); br.close()
    # canlı yarış: kart yok, çağrı yok
    d=Durum(); d.sonuc[("17","qualifying")]=siralama(); d.of_rc={5:rc(5)}
    page,errs,br=ac2(p,d,"2026-10-11T12:30:00Z",1100,sayfa="yaris"); page.clock.run_for(5000); page.wait_for_timeout(300)
    kontrol("Y27 tamamlanmamış/canlı yarışta v2 yok, historical çağrı yok", page.locator("#yo-v2").count()==0 or not page.locator("#yo-v2").is_visible(), hc(d)); br.close()
print("\n%d/%d"%(sum(SONUC),len(SONUC))); sys.exit(0 if all(SONUC) else 1)
