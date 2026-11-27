# strateji_v1_test — LASTİK VE YARIŞ STRATEJİSİ (v3.2.0).
#  U) saf katman: testler/strateji/strateji_birim.js (GERÇEK fixture: 2025 Hollanda GP — OpenF1 9920 stint/pit/race_control + F1DB sonuç;
#     tempo vakaları SENTETİK tur zamanlarıyla).
#  B) tarayıcı: aynı gerçek veri SAHTE AĞ üzerinden uygulamaya verilir (yaris_hikaye_v1_test kurulumu: Jolpica 2026/16 ↔ 2025/15 verisi).
#     Stint temposu için laps uç noktası SENTETİK tur zamanı döndürür (fixture'da tur süresi yok) — bu bölüm canlı uçtan uca test DEĞİLDİR.
import sys, re, json, subprocess
sys.path.insert(0,'.')
exec(open('yaris_hikaye_v1_test.py').read().split("\nwith sync_playwright")[0])

U=json.loads(subprocess.run(["node","strateji/strateji_birim.js"],capture_output=True,text=True,cwd=".").stdout)
for s in U: kontrol("U "+s["ad"], s["ok"], s["ek"])

KIRMIZI=re.compile(r"rgb\(2[0-5]\d, [0-5]?\d, [0-5]?\d\)")
LAPS=[]
def sentetik_laps(pg):
    # SENTETİK: Piastri (81) ve Verstappen (1) için 72 tur; zamanlar yarış saatine göre. Yalnız tempo arayüzünü sınamak için.
    yb=pg.evaluate("(()=>{const y=sezonYarislar.find(r=>r.round==='16');return Date.parse(y.date+'T'+(y.time||'12:00:00Z'))})()")
    rows=[]
    for no,taban in ((81,72.4),(1,72.6)):
        t=yb
        for n in range(1,73):
            d=taban+(n%4)*0.1
            if n==1: d=80.0
            rows.append({"driver_number":no,"lap_number":n,"lap_duration":d,"is_pit_out_lap":n in (24,54),"date_start":datetime.fromtimestamp(t/1000,timezone.utc).isoformat().replace("+00:00","Z"),"session_key":9920})
            t+=d*1000
    def lr(r):
        if re.search(r"/v1/laps\?session_key=9920$",r.request.url): LAPS.append(r.request.url); return js(r,rows)
        return r.fallback()
    pg.route(re.compile(r"api\.openf1\.org/v1/laps"),lr)
def D(pg,k): return pg.evaluate("(k)=>{const d=LastikStrateji._durum();return k==='filtre'?d.filtre:k==='durum'?d.durum:k==='tur'?d.tur:null}",k)
def satirlar(pg): return pg.evaluate("[...document.querySelectorAll('#ls-strateji .ls-grafik .ls-satir:not(.ls-eksen)')].map(e=>e.dataset.lsSatir)")
def filtre(pg,f): pg.click("#ls-strateji [data-ls-f='%s']"%f); ilerle(pg,1)
def gorus(pg): pg.evaluate("document.getElementById('ls-strateji').scrollIntoView({block:'start'})"); ilerle(pg,25)
KES=r"(()=>{const o=[];document.querySelectorAll('#ls-strateji *').forEach(e=>{if(e.checkVisibility()&&e.scrollWidth>e.clientWidth+1&&!['visible','clip'].includes(getComputedStyle(e).overflowX)&&!e.closest('.ls-st'))o.push(e.className||e.tagName)});return o})()"

with sync_playwright() as p:
    for w,tema in ((390,"koyu"),(390,"acik"),(1100,"koyu"),(1100,"acik")):
        T="[%d %s]"%(w,tema)
        pg,errs,c,b=yeni(p,NOW,w=w,tema=tema); kerr=[]; konsol(pg,kerr)
        OFI=kurulum(pg); LAPS.clear(); sentetik_laps(pg)
        if w==390: pg.evaluate("localStorage.setItem('f1-favori','hadjar')")
        ilerle(pg,4); yaris16(pg)
        kontrol("T1"+T+" sıra: Yarışın Hikâyesi → Lastik Stratejisi → Ghost Lap → YARIŞ ANALİZİ", pg.evaluate("(()=>{const t=i=>{const e=document.getElementById(i);return e?e.getBoundingClientRect().top:null};const h=t('yh-hikaye'),l=t('ls-strateji'),g=t('gl-ghost'),d=t('yv-detay');return h!=null&&l!=null&&h<l&&(g==null||l<g)&&l<d})()"))
        kontrol("T2"+T+" tembel: bölüm görünmeden strateji yüklenmez (Hikâye kendi verisini çeker; stint en çok bir kez)", D(pg,"durum")=="bos" and sum(1 for u in OFI if u.startswith("stints"))<=1, OFI)
        gorus(pg)
        n0=len(OFI)
        kontrol("T3"+T+" görünür olunca yüklendi: varsayılan İLK 10, resmî sonuç sırası", D(pg,"durum")=="hazir" and satirlar(pg)==["piastri","max_verstappen","hadjar","russell","albon","bearman","stroll","alonso","tsunoda","ocon"] and D(pg,"filtre")=="ilk10", satirlar(pg))
        kontrol("T4"+T+" her uç nokta bir kez (Hikâye ile ortak önbellek; duplicate yok, laps yok)", all(sum(1 for u in OFI if u.startswith(e))<=1 for e in ("race_control","pit","stints","sessions","meetings")) and not any(u.startswith("laps?session_key=9920") and "driver_number" not in u for u in OFI), OFI)
        renk=pg.evaluate("(()=>{const r={};for(const k of ['soft','medium','hard']){const e=document.querySelector('#ls-strateji .ls-st.ls-c-'+k);r[k]=e?getComputedStyle(e).backgroundColor:null}return r})()")
        kontrol("T5"+T+" lastik renkleri: SOFT kırmızı, MEDIUM sarı, HARD beyaz", renk=={"soft":"rgb(225, 6, 0)","medium":"rgb(245, 196, 0)","hard":"rgb(238, 241, 245)"}, renk)
        geo=pg.evaluate("(()=>{const r=document.querySelector(\"#ls-strateji [data-ls-satir='piastri']\");const iz=r.querySelector('.ls-iz').getBoundingClientRect();return [...r.querySelectorAll('.ls-st')].map(b=>{const q=b.getBoundingClientRect();return [(q.left-iz.left)/iz.width,q.width/iz.width]})})()")
        kontrol("T6"+T+" bloklar stint uzunluğuyla orantılı (Piastri 1–23 / 24–53 / 54–72, 72 tur)", len(geo)==3 and abs(geo[0][1]-23/72)<0.01 and abs(geo[1][0]-23/72)<0.01 and abs(geo[1][1]-30/72)<0.01 and abs(geo[2][1]-19/72)<0.01, geo)
        kontrol("T7"+T+" pit işareti: pit kaydı eşleşen stint geçişleri işaretli", pg.locator("#ls-strateji [data-ls-satir='piastri'] .ls-st.ls-pitli").count()==2)
        kontrol("T8"+T+" SC/VSC bantları (liderin turlarına göre) çizildi + açıklama notu", pg.locator("#ls-strateji [data-ls-satir='piastri'] .ls-band-SC").count()==3 and pg.locator("#ls-strateji [data-ls-satir='piastri'] .ls-band-VSC").count()==1 and "liderin" in pg.inner_text("#ls-strateji"))
        # filtreler — ağ isteği yok
        filtre(pg,"tumu"); s_t=satirlar(pg)
        ham=pg.evaluate("(()=>{const r=document.querySelector(\"#ls-strateji [data-ls-satir='hamilton']\");if(!r)return null;const iz=r.querySelector('.ls-iz').getBoundingClientRect();const bl=[...r.querySelectorAll('.ls-st')].map(b=>b.getBoundingClientRect().right);return {sag:(Math.max(...bl)-iz.left)/iz.width,dnf:!!r.querySelector('.ls-dnf'),et:r.querySelector('.ls-ad').textContent}})()")
        kontrol("T9"+T+" TÜMÜ: 20 pilot; DNF Hamilton satırı 22. turda biter (sahte uzatma yok) + DNF etiketi", len(s_t)==20 and s_t[-1]=="hamilton" and ham and ham["sag"]<=22/72+0.01 and ham["dnf"] and ham["et"].startswith("DNF"), (len(s_t),ham))
        filtre(pg,"podyum"); kontrol("T10"+T+" PODYUM: 3 pilot", satirlar(pg)==["piastri","max_verstappen","hadjar"], satirlar(pg))
        if w==390:
            filtre(pg,"favori"); fv=pg.evaluate("(()=>{const r=document.querySelector('#ls-strateji .ls-fav');return r?[r.dataset.lsSatir,getComputedStyle(r.querySelector('.ls-iz')).boxShadow]:null})()")
            kontrol("T11"+T+" FAVORİ (Hadjar): yalnız favori satırı, nötr vurgu (kırmızı değil)", satirlar(pg)==["hadjar"] and fv and fv[0]=="hadjar" and not KIRMIZI.search(fv[1]), fv)
        else:
            kontrol("T11"+T+" favori yokken FAVORİ düğmesi pasif", pg.locator("#ls-strateji [data-ls-f='favori']").is_disabled())
        filtre(pg,"ilk10")
        kontrol("T12"+T+" filtre değişimleri yeni OpenF1 isteği yapmaz; grafik yeniden animasyon oynatmaz", len(OFI)==n0 and pg.locator("#ls-strateji .ls-anim").count()==0, OFI[n0:])
        # blok dokunma → detay
        blk=pg.locator("#ls-strateji [data-ls-satir='piastri'] .ls-st").nth(1); blk.click(); ilerle(pg,1)
        det=pg.inner_text("#ls-strateji .ls-detay")
        kontrol("T13"+T+" bloğa dokununca: pilot, lastik, tur aralığı, uzunluk, başlangıç yaşı, pit turu + pit lane süresi", "Piastri" in det and "HARD" in det and "Tur 24–53" in det and "30 tur" in det and "lastik yaşı" in det and "Pit: tur 23" in det and "pit lane süresi" in det, det)
        dr=R(pg,"#ls-strateji .ls-det")
        kontrol("T14"+T+" detay paneli ekran içinde", dr and dr["l"]>=0 and dr["r"]<=w+0.5, dr)
        blk.click(); ilerle(pg,1)
        if w==390: kontrol("T15"+T+" ikinci dokunuş paneli kapatır", pg.locator("#ls-strateji .ls-det").count()==0)
        else: kontrol("T15"+T+" fareyle üzerine gelme de aynı detayı gösterir", (pg.locator("#ls-strateji [data-ls-satir='hadjar'] .ls-st").first.hover(), ilerle(pg,1), "Hadjar" in pg.inner_text("#ls-strateji .ls-detay"))[2])
        # pit stop analizi
        pg.click("#ls-strateji .ls-pit-d > summary"); ilerle(pg,1)
        pt=pg.inner_text("#ls-strateji .ls-pit-d")
        kontrol("T16"+T+" PİT STOP ANALİZİ: pit lane ve durağan ayrı sütun + tanımlar; hata iddiası yok", "Pit lane" in pt and "Durağan" in pt and "pit yoluna girişten çıkışa" in pt and "hata göstergesi değildir" in pt and not re.search(r"hatalı|yavaş pit|kötü|başarısız",pt), pt[:200])
        ph=pg.evaluate("[...document.querySelectorAll('#ls-strateji .ls-pit tbody tr')].filter(r=>r.querySelector('th').textContent==='PIA').map(r=>[...r.querySelectorAll('td')].map(x=>x.textContent))[0]")
        kontrol("T17"+T+" Piastri pit satırı ham kayıtla aynı (2 pit, tur 23 ve 53)", ph and ph[0]=="2" and ph[1]=="23, 53", ph)
        # karşılaştırma
        filtre(pg,"karsilastir")
        kk=pg.inner_text("#ls-strateji .ls-kk")
        bB="hadjar" if w==390 else "max_verstappen"
        kontrol("T18"+T+" KARŞILAŞTIR: A = P1 Piastri, B = favori (Hadjar) yoksa P2; lastik dizilimi + pit turları + start/bitiş", satirlar(pg)==["piastri",bB] and "MEDIUM (23 tur) → HARD (30 tur) → HARD (19 tur)" in kk and "23, 53" in kk and "P1 → P1" in kk and ("P4 → P3" if w==390 else "P3 → P2") in kk, kk[:300])
        kontrol("T19"+T+" karşılaştırma kartında pit lane süresi; kaynakta varsa durağan süre ayrı satırda", "Pit lane süresi" in kk and "Durağan süre" in kk and "En uzun stint" in kk)
        pg.select_option("#ls-strateji select[data-ls-sec='B']","bearman"); ilerle(pg,1)
        kk=pg.inner_text("#ls-strateji .ls-kk")
        kontrol("T20"+T+" pilot değiştirme: Bearman pit yolundan start gösterilir; yeni istek yok", "Pit yolu → P6" in kk and satirlar(pg)==["piastri","bearman"] and len(OFI)==n0, (kk[-120:],OFI[n0:]))
        kontrol("T21"+T+" tempo: düğmeye basılmadan tur zamanı isteği yok", pg.locator("#ls-strateji [data-ls-tempo]").count()==1 and not LAPS)
        pg.click("#ls-strateji [data-ls-tempo]"); ilerle(pg,4)
        tt=pg.inner_text("#ls-strateji .ls-tempo-k") if pg.locator("#ls-strateji .ls-tempo-k").count() else ""
        kontrol("T22"+T+" STİNT TEMPOSU (SENTETİK tur zamanları): stint başına temiz tur / medyan / en hızlı; tek laps isteği", "medyan" in tt.lower() and "1:12" in tt and len(LAPS)==1, (tt[:200],LAPS))
        nt=pg.inner_text("#ls-strateji .ls-kars .ls-not")
        kontrol("T23"+T+" tempo notu: hariç turlar + lastik/yakıt/trafik/pist etkisi; aşınma/performans sonucu çıkarılmaz", all(x in nt for x in ("pit giriş/çıkış","SC/VSC","yakıt","trafik","aşınma ya da performans sonucu çıkarılmaz")))
        n1=len(OFI); pg.select_option("#ls-strateji select[data-ls-sec='A']","hadjar"); ilerle(pg,1); filtre(pg,"tumu"); filtre(pg,"karsilastir")
        kontrol("T24"+T+" tempo yüklendikten sonra pilot/filtre değişimi yeni istek yapmaz", len(OFI)==n1 and len(LAPS)==1, OFI[n1:])
        # İzlerken Öğren
        tr=pg.evaluate("[...document.querySelectorAll('#ls-strateji .ls-ogren [data-terim]')].map(b=>[b.dataset.terim,!!(window.ICERIK&&ICERIK.sozluk&&ICERIK.sozluk.terimler[b.dataset.terim])])")
        kontrol("T25"+T+" İzlerken Öğren: Stint, Compound, Pit lane, Undercut, Overcut, Tyre degradation → mevcut sözlük", [x[0] for x in tr]==["stint","lastik-bilesikleri","pit-stop","undercut","overcut","lastik-asinmasi"] and all(x[1] for x in tr), tr)
        pg.click("#ls-strateji .ls-ogren [data-terim='undercut']"); ilerle(pg,1)
        kontrol("T26"+T+" terime dokununca sözlük açılır", pg.evaluate("(()=>{const d=document.querySelector('dialog[open]');return !!d&&/undercut/i.test(d.textContent)})()"))
        pg.keyboard.press("Escape"); ilerle(pg,1)
        txt=pg.inner_text("#ls-strateji")
        kontrol("T27"+T+" ham hata / yargı yok (undercut yalnız öğretim bağlantısında)", not re.search(r"undefined|NaN|null|Error|HTTP|en iyi strateji|yanlış strateji|undercut yaptı|overcut yaptı|aşınma %|sayesinde|nedeniyle",txt), re.findall(r"undefined|NaN|null|Error|HTTP|en iyi strateji|yanlış strateji|undercut yaptı|sayesinde|nedeniyle",txt))
        # Yarışın Hikâyesi pit kartı → strateji
        pg.evaluate("document.getElementById('yh-hikaye').scrollIntoView({block:'start'})"); ilerle(pg,20)
        lk=pg.locator("#yh-hikaye [data-ls-git]")
        if lk.count():
            hid=lk.first.get_attribute("data-ls-git"); n2=len(OFI); lk.first.click(); ilerle(pg,2); pg.wait_for_timeout(1200)   # yumuşak kaydırma gerçek zamanla ilerler
            ust=pg.evaluate("document.getElementById('ls-strateji').getBoundingClientRect().top")
            kontrol("T28"+T+" Hikâye pit kartı → 'Lastik grafiğinde gör': o pilot karşılaştırmada A, bölüme kaydırır, yeni istek yok", D(pg,"filtre")=="karsilastir" and pg.evaluate("LastikStrateji._durum().secA")==hid and -5<ust<pg.viewport_size["height"]/2 and len(OFI)==n2, (hid,ust,OFI[n2:]))
        else: kontrol("T28"+T+" Hikâye'de pit kartı bağlantısı var", False)
        kontrol("T29"+T+" kesilme yok, sayfa taşması 0", pg.evaluate(KES)==[] and tasma(pg)==0, (pg.evaluate(KES),tasma(pg)))
        if w==1100: kontrol("T30"+T+" masaüstünde grafik geniş (≥ 700 px)", pg.evaluate("document.querySelector('#ls-strateji .ls-grafik').getBoundingClientRect().width")>=700)
        else: kontrol("T30"+T+" 390: pilot adları okunur (kesilmeden), satır yüksekliği ≥ 20 px", pg.evaluate("[...document.querySelectorAll('#ls-strateji .ls-ad')].every(e=>e.scrollWidth<=e.clientWidth+1)") and pg.evaluate("document.querySelector('#ls-strateji .ls-satir:not(.ls-eksen)').getBoundingClientRect().height")>=20)
        # yarış değişimi
        pg.select_option("#yaris-sec","15"); ilerle(pg,6)
        kontrol("T31"+T+" yarış değişince önceki yarışın stintleri gösterilmez", str(D(pg,"tur"))=="15" and D(pg,"durum")!="hazir" and pg.locator("#ls-strateji [data-ls-satir='piastri']").count()==0)
        n3=len(OFI); pg.select_option("#yaris-sec","16"); ilerle(pg,6); gorus(pg)
        kontrol("T32"+T+" aynı yarışa dönünce önbellekten çizilir (stint/pit/race_control yeniden istenmez)", D(pg,"durum")=="hazir" and not any(u.startswith(("stints","pit","race_control")) for u in OFI[n3:]), OFI[n3:])
        if w==1100 and tema=="koyu": pg.locator("#ls-strateji").screenshot(path="/tmp/f1-ekran/strateji_1100.png")
        if w==390 and tema=="koyu": pg.locator("#ls-strateji").screenshot(path="/tmp/f1-ekran/strateji_390.png")
        kontrol("T33"+T+" JS/konsol hatası yok", not errs and not kerr, (errs,kerr[:3])); b.close()

    # ===== reduced motion =====
    pg,errs,c,b=yeni(p,NOW,w=390,tema="koyu"); pg.emulate_media(reduced_motion="reduce"); kerr=[]; konsol(pg,kerr)
    kurulum(pg); ilerle(pg,4); yaris16(pg); gorus(pg)
    an=pg.evaluate("[...document.querySelectorAll('#ls-strateji .ls-st')].map(e=>getComputedStyle(e).animationName)")
    kontrol("R1 prefers-reduced-motion: blok animasyonu yok", an and all(a=="none" for a in an), an[:3])
    b.close()
    pg,errs,c,b=yeni(p,NOW,w=390,tema="koyu"); kerr=[]; konsol(pg,kerr)
    kurulum(pg); ilerle(pg,4); yaris16(pg); gorus(pg)
    an=pg.evaluate("(()=>{const e=document.querySelector('#ls-strateji .ls-st');const s=getComputedStyle(e);return [s.animationName,parseFloat(s.animationDuration)]})()")
    kontrol("R2 normal hareket: bloklar bir kez 400–800 ms içinde oluşur", an[0]=="ls-buyu" and 0.4<=an[1]<=0.8, an)
    b.close()

    # ===== eksik veri: OpenF1 boş → açıklayıcı boş durum; diğer bölümler çalışır =====
    pg,errs,c,b=yeni(p,NOW,w=390,tema="koyu"); kerr=[]; konsol(pg,kerr)
    kurulum(pg,bos_openf1=True); yaris16(pg); gorus(pg)
    kontrol("M1 OpenF1 stint verisi yok: açıklayıcı boş durum, sonsuz yükleme yok, Hikâye yine görünür", pg.locator("#ls-strateji [data-ls-bos]").count()==1 and "Diğer analiz bölümleri kullanılabilir" in pg.inner_text("#ls-strateji") and pg.locator("#yh-hikaye .yh-o[data-tip='FINISH']").count()==1 and D(pg,"durum")!="yukleniyor", pg.inner_text("#ls-strateji")[:200])
    kontrol("M2 taşma 0, hata yok", tasma(pg)==0 and not errs and not kerr, (errs,kerr[:3])); b.close()

print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
