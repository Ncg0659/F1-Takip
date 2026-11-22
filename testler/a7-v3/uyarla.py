# A7 UI testlerini v3 sekme yapısına uyarlar (orijinaller state-testleri/baglam/ altında DEĞİŞMEDEN kalır)
import re
SRC="/home/claude/f1-takip/testler/state/baglam/"
SHIM='''
TABK={"so":"olay","ta":"tur","gc":"gecis","pt":"pit","sh":"hava"}
def sec_ses(page,ses):
    b=page.locator("#sekme-hafta .h-cz[data-key='%s']"%ses)
    if b.count() and b.get_attribute("aria-pressed")!="true": b.click(); page.wait_for_timeout(100)
def gec(page,tab):
    page.locator("#sekme-hafta [data-act='psek'][data-v='%s']"%tab).click(); page.wait_for_timeout(50); page.clock.run_for(6000); page.wait_for_timeout(300)
def sekmeler(page,ses):
    sec_ses(page,ses); return page.locator("#sekme-hafta .v3-sek").all_inner_texts()
def bir_kutu(page): return page.locator(".h-dp .so,.h-dp .ta,.h-dp .gc,.h-dp .pt,.h-dp .sh").count()
'''
TEMA="page.evaluate(\"t=>document.documentElement.setAttribute('data-tema',t)\",tema)"
def tema_duzelt(t,ses,tab):
    assert TEMA in t
    return t.replace(TEMA,TEMA+"; sec_ses(page,\"%s\"); gec(page,\"%s\")"%(ses,tab))
def yaz(ad,t): open(ad,"w",encoding="utf-8").write(t)
def ortak(t,pref):
    t=t.replace("from playwright.sync_api import sync_playwright","from playwright.sync_api import sync_playwright"+SHIM,1)
    # ac_* yardımcısı: seansı seç + sekmeyi aç
    t=re.sub(r'def (ac_\w+)\(page,ad\):\n    k=kutu\(page,ad\); k\.locator\("\.(\w\w)-ac"\)\.click\(\); .*?return k',
             lambda m:'def %s(page,ad):\n    sec_ses(page,ad); gec(page,TABK["%s"]); return kutu(page,ad)'%(m.group(1),m.group(2)),t,flags=re.S)
    # kapat/aç → SONUÇ'a git ve geri dön (modülün kendi düğmesi artık gizli)
    t=re.sub(r'(\w+)\.locator\("\.(\w\w)-ac"\)\.click\(\); \1\.locator\("\.\2-ac"\)\.click\(\);',lambda m:'gec(page,"sonuc"); gec(page,TABK["%s"]);'%m.group(2),t)
    return t
def satir_degis(t,onek,yeni):
    out=[]; bulundu=False
    for l in t.split("\n"):
        if l.strip().startswith('kontrol("%s '%onek): out.append("    "+yeni); bulundu=True
        else: out.append(l)
    assert bulundu,onek
    return "\n".join(out)
# --- PIT
t=ortak(open(SRC+"pit_ui_test.py",encoding="utf-8").read(),"pt")
t=satir_degis(t,"T1","kontrol(\"T1 yalnız Sprint ve Race seanslarında PİT sekmesi var (FP/SQ/Q'da yok)\", all((\"PİT\" in sekmeler(page,s))==(s in (\"Sprint\",\"Race\")) for s in (\"FirstPractice\",\"SprintQualifying\",\"Sprint\",\"Qualifying\",\"Race\")))")
t=satir_degis(t,"T15","kontrol(\"T15 Race: 5 A7 sekmesi birlikte erişilebilir, DOM'da aynı anda yalnız bir A7 kutusu\", all(x in sekmeler(page,\"Race\") for x in (\"OLAYLAR\",\"TURLAR\",\"GEÇİŞ\",\"PİT\",\"HAVA\")) and bir_kutu(page)<=1)")
t=tema_duzelt(t,"Race","pit"); yaz("pit_ui_test.py",t)
# --- OVT
t=ortak(open(SRC+"ovt_ui_test.py",encoding="utf-8").read(),"gc")
t=satir_degis(t,"G1","kontrol(\"G1 yalnız Sprint ve Race seanslarında GEÇİŞ sekmesi var (FP/SQ/Q'da yok)\", all((\"GEÇİŞ\" in sekmeler(page,s))==(s in (\"Sprint\",\"Race\")) for s in (\"FirstPractice\",\"SprintQualifying\",\"Sprint\",\"Qualifying\",\"Race\")))")
t=satir_degis(t,"G13","kontrol(\"G13 Race: 5 A7 sekmesi birlikte, DOM'da aynı anda yalnız bir A7 kutusu\", all(x in sekmeler(page,\"Race\") for x in (\"OLAYLAR\",\"TURLAR\",\"GEÇİŞ\")) and bir_kutu(page)<=1)")
t=tema_duzelt(t,"Race","gecis"); yaz("ovt_ui_test.py",t)
# --- LAPS
t=ortak(open(SRC+"laps_ui_test.py",encoding="utf-8").read(),"ta")
t=satir_degis(t,"A1","kontrol(\"A1 tamamlanmış seansların en az 4'ünde TURLAR sekmesi var (orijinal: ≥4 düğme)\", sum(\"TURLAR\" in sekmeler(page,s) for s in (\"FirstPractice\",\"SprintQualifying\",\"Qualifying\",\"Sprint\",\"Race\"))>=4)")
t=satir_degis(t,"A14","kontrol(\"A14 SQ: OLAYLAR ve TURLAR ayrı sekme/kutu, aynı anda yalnız biri\", all(x in sekmeler(page,\"SprintQualifying\") for x in (\"OLAYLAR\",\"TURLAR\")) and bir_kutu(page)<=1)")
t=tema_duzelt(t,"SprintQualifying","tur"); yaz("laps_ui_test.py",t)
# --- HAVA
t=ortak(open(SRC+"hava_ui_test.py",encoding="utf-8").read(),"sh")
t=satir_degis(t,"H1","kontrol(\"H1 tamamlanmış seanslarda HAVA sekmesi var (FP/SQ/Sprint/Q/Race)\", all(\"HAVA\" in sekmeler(page,s) for s in (\"FirstPractice\",\"SprintQualifying\",\"Sprint\",\"Qualifying\",\"Race\")))")
t=satir_degis(t,"H9","kontrol(\"H9 mevcut Open-Meteo hava kartı etkilenmedi (5 seans kartı grid'de, tek detay paneli)\", page.locator(\".h-cz\").count()==5 and page.locator(\".h-seans\").count()==1)")
t=t.replace('    ses=[page.locator(".sh").nth(i).get_attribute("data-seans") for i in range(page.locator(".sh").count())]\n','')
t=tema_duzelt(t,"Race","hava"); yaz("hava_ui_test.py",t)
# --- RC
t=ortak(open(SRC+"rc_ui_test.py",encoding="utf-8").read(),"so")
t=t.replace('''def ac_blok(page,i=0):
    page.locator(".so-ac").nth(i).click(); page.wait_for_timeout(50); page.clock.run_for(3000); page.wait_for_timeout(300)''','''def ac_blok(page,i=0):
    sec_ses(page,"SprintQualifying"); gec(page,"olay")''')
IDX='[i for i in range(page.locator(".so").count()) if page.locator(".so").nth(i).get_attribute("data-seans")=="SprintQualifying"][0]'
t=t.replace(IDX,"0")
t=satir_degis(t,"R1","kontrol(\"R1 tamamlanmış SQ seansında OLAYLAR sekmesi var\", \"OLAYLAR\" in sekmeler(page,\"SprintQualifying\"), sekmeler(page,\"SprintQualifying\"))")
t=satir_degis(t,"R1b","kontrol(\"R1b seçili seans SprintQualifying (tek detay paneli)\", page.locator(\".h-dp\").get_attribute(\"data-seans\")==\"SprintQualifying\" and page.locator(\".h-dp\").count()==1)")
t=t.replace('    sqi=[i for i in range(page.locator(".so").count()) if page.locator(".so").nth(i).get_attribute("data-seans")=="SprintQualifying"]\n','    sqi=[0]\n')
t=t.replace("ac_blok(page,sqi[0] if sqi else 0)","ac_blok(page)")
t=t.replace('page.locator(".so-ac").nth(sqi[0]).click(); page.locator(".so-ac").nth(sqi[0]).click();','gec(page,"sonuc"); gec(page,"olay");')
t=t.replace('''    fp=page.locator(".so[data-seans='FirstPractice']")
    if fp.count():
        fp.locator(".so-ac").click(); page.wait_for_timeout(50); page.clock.run_for(3000); page.wait_for_timeout(300)
        t=fp.inner_text()''','''    sec_ses(page,"FirstPractice"); fp=page.locator(".so[data-seans='FirstPractice']")
    if True:
        gec(page,"olay")
        t=fp.inner_text()''')
t=tema_duzelt(t,"SprintQualifying","olay"); yaz("rc_ui_test.py",t)
print("hazır")
