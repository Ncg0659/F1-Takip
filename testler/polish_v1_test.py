# VISUAL POLISH v1 — mobil üst çizgi, ticker, tahmin renkleri, mobil pist profili akordeonu, rozet boşluğu, pist yönü, Ghost Lap akıcılığı, taşma/konsol.
import sys, re, json, subprocess
sys.path.insert(0,'.')
exec(open('bugun_v3_test.py').read().split("\nwith sync_playwright")[0])
F1='/home/claude/f1-takip/'
def E(id,ts,cat,tr): return dict(ev(id,ts,cat,tr),originalText="x")
START=dict(ev("r0","2026-10-11T12:02:00Z","RESTART","Yarış başladı."),originalText="Lights out and away we go. The race has started.")
UZUN=[START,E("u1","2026-10-11T12:20:00Z","PENALTY","Hamilton pist sınırlarını aştığı için beş saniye ceza aldı, takım itiraz etmeyi değerlendiriyor")]
KISA=[START,E("k1","2026-10-11T12:20:00Z","PIT","Norris pite girdi.")]
TK="""()=>{const o=document.querySelector('.tk-o:not([hidden])');if(!o)return null;const oi=o.querySelector('.tk-oi');const L=s=>o.querySelector(s).getBoundingClientRect().left;
 return {kay:o.classList.contains('tk-kay'),an:oi.getAnimations().length,kn:L('.tk-kn'),ys:L('.tk-yas'),mt:L('.tk-mi'),doc:document.documentElement.scrollWidth}}"""
TASMA="""()=>{const W=document.documentElement.clientWidth;return {doc:document.documentElement.scrollWidth,W:W}}"""
with sync_playwright() as p:
    # ---- 3) mobil üst kırmızı çizgi ----
    for w,bek in ((390,"none"),(1100,"var")):
        pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=w)
        d=pg.evaluate("[getComputedStyle(document.body,'::before').display, getComputedStyle(document.body,'::before').content, getComputedStyle(document.body,'::after').content]")
        if w==390: kontrol("3 mobil: üst kırmızı çizgi ve maske yok", d[0]=="none" or d[1] in ("none","normal"), d)
        else: kontrol("3 masaüstü: üst çizgi yerinde", d[0]!="none" and d[1] not in ("none","normal"), d)
        b.close()
    # ---- 4) ticker ----
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",w=390,feed=UZUN)
    a=pg.evaluate(TK); pg.wait_for_timeout(2600); z=pg.evaluate(TK)
    kontrol("4 uzun içerik: kayma aktif", bool(a) and a["kay"] and a["an"]==1, a)
    kontrol("4 ikon + etiket + metin TEK PARÇA kayıyor (aynı miktar, sola)", bool(a and z) and z["kn"]<a["kn"]-5 and abs((z["kn"]-a["kn"])-(z["mt"]-a["mt"]))<1 and abs((z["kn"]-a["kn"])-(z["ys"]-a["ys"]))<1, (a,z))
    kontrol("4 kayarken sayfa yatay taşmıyor", z["doc"]==390, z)
    pg.emulate_media(reduced_motion="reduce"); pg.set_viewport_size({"width":388,"height":900}); pg.wait_for_timeout(300)
    r1=pg.evaluate(TK); pg.wait_for_timeout(900); r2=pg.evaluate(TK)
    kontrol("4 Hareketi Azalt: hareket yok (animasyon 0, konum sabit)", bool(r1 and r2) and not r1["kay"] and r1["an"]==0 and r1["mt"]==r2["mt"], (r1,r2))
    kontrol("4 konsol hatası yok", not errs, errs); b.close()
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",w=390,feed=KISA)
    a=pg.evaluate(TK); pg.wait_for_timeout(1500); z=pg.evaluate(TK)
    kontrol("4 kısa içerik: hareket yok", bool(a and z) and not a["kay"] and a["an"]==0 and abs(a["mt"]-z["mt"])<1.5, (a,z)); b.close()
    pg,errs,c,b=ac(p,"2026-10-11T12:30:00Z",w=1100,feed=UZUN)
    a=pg.evaluate(TK); kontrol("4 masaüstü: aynı metin sığıyor → hareket yok", bool(a) and not a["kay"] and a["an"]==0, a); b.close()

    # ---- 8) + 9) pist listesi ----
    for tema in ("koyu","acik"):
        pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=390,tema=tema)
        tikla(pg,"nav-kesfet"); ilerle(pg,8)
        n=pg.locator("#pist-govde > tr").count()
        kontrol("8/%s mobil: pist listesi kart düzeninde, Profil düğmesi ekranda"%tema, n>5 and pg.evaluate("[...document.querySelectorAll('#pist-govde button[data-pist]')].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=390})"), n)
        bos=pg.evaluate("[...document.querySelectorAll('#pist-govde .ui-pist-h')].map(h=>{const a=h.querySelector('.ui-pist-ad').getBoundingClientRect(), r=h.querySelector('.pp-sinifrozet').getBoundingClientRect(); return r.top<a.bottom-2 ? Math.round(r.left-a.right) : 99})")
        kontrol("9/%s mobil: ad ↔ rozet boşluğu 8–12 px (ya da rozet alt satırda)"%tema, len(bos)==n and all((8<=x<=12) or x==99 for x in bos), bos)
        sat=pg.locator("#pist-govde > tr").nth(2); ad=sat.locator(".ui-pist-ad").inner_text()
        sat.locator(".ui-pist-ad").click(); ilerle(pg,2); pg.wait_for_timeout(350)
        d=pg.evaluate("""()=>{const a=document.querySelector('#pist-govde tr.pp-acik'), k=document.querySelector('#pist-govde tr.pp-acc');if(!a||!k)return null;
          return {ayni:a.nextElementSibling===k, ust:Math.round(k.getBoundingClientRect().top-a.getBoundingClientRect().bottom), panel:!!document.querySelector('#dp-panel[open]'), exp:a.querySelector('button[data-pist]').getAttribute('aria-expanded'),
                  ad:a.querySelector('.ui-pist-ad').textContent, dolu:k.textContent.length>80, gorunur:k.getBoundingClientRect().top<innerHeight, doc:document.documentElement.scrollWidth, sinir:getComputedStyle(a).borderTopColor!==getComputedStyle(a.previousElementSibling).borderTopColor}}""")
        kontrol("8/%s karta dokununca profil İLGİLİ KARTIN HEMEN ALTINDA açıldı (alt panel değil)"%tema, bool(d) and d["ayni"] and abs(d["ust"])<=1 and not d["panel"] and d["ad"]==ad and d["dolu"] and d["gorunur"], d)
        kontrol("8/%s açık kart belirgin durumda (aria-expanded + çerçeve), yatay taşma 0"%tema, bool(d) and d["exp"]=="true" and d["sinir"] and d["doc"]==390, d)
        pg.locator("#pist-govde > tr").nth(5).locator("button[data-pist]").click(); ilerle(pg,2)
        kontrol("8/%s başka pist açılınca öncekİ kapanır (tek açık)"%tema, pg.locator("#pist-govde tr.pp-acc").count()==1 and pg.locator("#pist-govde tr.pp-acik").count()==1 and pg.evaluate("document.querySelector('#pist-govde tr.pp-acik')===document.querySelectorAll('#pist-govde > tr:not(.pp-acc)')[4]"))
        pg.locator("#pist-govde tr.pp-acik .ui-pist-ad").click(); ilerle(pg,1)
        kontrol("8/%s aynı karta tekrar dokununca kapanır"%tema, pg.locator(".pp-acc, .pp-acik").count()==0)
        pg.locator("#pist-govde > tr").nth(1).locator("button[data-pist]").click(); ilerle(pg,1); pg.locator(".pp-acc-kapat").click(); ilerle(pg,1)
        kontrol("8/%s 'Kapat' düğmesi kapatır"%tema, pg.locator(".pp-acc, .pp-acik").count()==0)
        pg.locator("#pist-govde > tr").nth(1).locator("button[data-pist]").click(); ilerle(pg,1); tikla(pg,"nav-sezon"); ilerle(pg,8)
        kontrol("8/%s sekme değişince açık profil kapanır"%tema, pg.locator(".pp-acc").count()==0)
        pg.click("#sekme-sezon button.st-pist"); ilerle(pg,2); pg.wait_for_timeout(350)
        d=pg.evaluate("""()=>{const b=document.querySelector('#sekme-sezon button.st-pist'), k=document.querySelector('#sekme-sezon .pp-acc');if(!k)return null;const y=b.closest('p');
          return {hemen:y.nextElementSibling===k, panel:!!document.querySelector('#dp-panel[open]'), gorunur:k.getBoundingClientRect().top<innerHeight, doc:document.documentElement.scrollWidth, exp:b.getAttribute('aria-expanded')}}""")
        kontrol("8/%s SEZON kartı: pist adına dokununca profil kartın içinde, adın hemen altında"%tema, bool(d) and d["hemen"] and not d["panel"] and d["gorunur"] and d["doc"]==390 and d["exp"]=="true", d)
        ilerle(pg,4); kontrol("8/%s SEZON: geri sayım ilerlerken açık kalır"%tema, pg.locator("#sekme-sezon .pp-acc").count()==1)
        pg.click("#sekme-sezon button.st-pist"); ilerle(pg,1)
        kontrol("8/%s SEZON: aynı ada tekrar dokununca kapanır; hata yok"%tema, pg.locator(".pp-acc").count()==0 and not errs, errs); b.close()
    pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=1100)
    tikla(pg,"nav-kesfet"); ilerle(pg,8)
    bos=pg.evaluate("[...document.querySelectorAll('#pist-govde .ui-pist-h')].map(h=>{const a=h.querySelector('.ui-pist-ad').getBoundingClientRect(), r=h.querySelector('.pp-sinifrozet').getBoundingClientRect(); return r.top<a.bottom-2 ? Math.round(r.left-a.right) : 99})")
    kontrol("9 masaüstü: ad ↔ rozet boşluğu 8–12 px", len(bos)>5 and all((8<=x<=12) or x==99 for x in bos), bos)
    hiza=pg.evaluate("[...new Set([...document.querySelectorAll('#pist-govde .ui-pist-ad')].map(a=>Math.round(a.getBoundingClientRect().left)))]")
    kontrol("9 masaüstü: pist adları aynı sol hizada", len(hiza)==1, hiza)
    pg.locator("#pist-govde button[data-pist]").nth(1).click(); ilerle(pg,2)
    kontrol("8 masaüstü: davranış değişmedi (Detay paneli açılır, akordeon yok)", pg.evaluate("!!document.querySelector('#dp-panel[open]')") and pg.locator(".pp-acc").count()==0 and not errs, errs); b.close()

    # ---- genel: sekmeler, 390 + 1100, koyu + açık: yatay taşma 0, konsol hatası 0 ----
    for w in (390,1100):
        for tema in ("koyu","acik"):
            pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=w,tema=tema); kotu=[]
            for nv in ("nav-bugun","nav-haftasonu","nav-sezon","nav-analiz","nav-kesfet"):
                tikla(pg,nv); ilerle(pg,8); t=pg.evaluate(TASMA)
                if t["doc"]>t["W"]: kotu.append((nv,t))
            kontrol("genel %d/%s: 5 ana sekmede yatay taşma 0, konsol hatası 0"%(w,tema), not kotu and not errs, (kotu,errs)); b.close()

# ---- 2) pist yönü + 6) Ghost Lap akıcılığı (saf hesap; node) ----
JS = r"""
const P=require('/home/claude/f1-takip/pist-siluetleri.js'), O=require('/home/claude/f1-takip/testler/ghost/pist-siluetleri.kuzey-yukari.js'), G=require('/home/claude/f1-takip/ghost-hesap.js');
const pts=d=>{const n=d.match(/-?\d+(\.\d+)?/g).map(Number),o=[];for(let i=0;i<n.length;i+=2)o.push([n[i],n[i+1]]);return o};
const out={n:Object.keys(P.YOL).length, donen:Object.keys(P.YON), dik:[], sayi:[], sekil:[], kutu:[]};
for(const k of Object.keys(P.YOL)){ const a=pts(P.YOL[k]), b=pts(O.YOL[k]);
  const xs=a.map(p=>p[0]), ys=a.map(p=>p[1]), w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys);
  if(Math.min(...xs)<13||Math.max(...xs)>287||Math.min(...ys)<13||Math.max(...ys)>187) out.kutu.push(k);
  if(a.length!==b.length) out.sayi.push(k);
  if(P.YON[k]!=null){ if(h>w) out.dik.push(k);
    // şekil korunumu: ardışık kenar uzunluklarının oranı sabit (döndürme + uniform ölçek) ve işaretli alanın yönü aynı (ayna yok)
    const len=q=>q.slice(1).map((p,i)=>Math.hypot(p[0]-q[i][0],p[1]-q[i][1])), la=len(a), lb=len(b), sa=la.reduce((x,y)=>x+y,0), sb=lb.reduce((x,y)=>x+y,0);
    const sap=Math.max(...la.map((x,i)=>Math.abs(x/sa-lb[i]/sb)));
    const alan=q=>q.reduce((s,p,i)=>{const n=q[(i+1)%q.length];return s+p[0]*n[1]-n[0]*p[1]},0);
    if(sap>2e-4||Math.sign(alan(a))!==Math.sign(alan(b))) out.sekil.push([k,sap]); }
  else if(P.YOL[k]!==O.YOL[k]) out.sekil.push([k,'degisti']); }
// Ghost Lap: gerçek örneklerden geçer, boşlukta tahmin yok, tekrarlar iner, duruş korunur
const s=[{t:0,x:0,y:0},{t:240,x:10,y:0},{t:480,x:20,y:5},{t:720,x:30,y:14},{t:3000,x:60,y:14},{t:3240,x:70,y:14}];
out.gecis=s.slice(0,3).every(p=>{const r=G.konumYumusak(s,p.t);return r.durum==='canli'&&Math.abs(r.x-p.x)<1e-9&&Math.abs(r.y-p.y)<1e-9});
out.bosluk=G.konumYumusak(s,1500).durum; out.once=G.konumYumusak(s,-1).durum; out.bitti=G.konumYumusak(s,9999).durum;
let mx=0,onc=null; for(let t=0;t<720;t+=8){const r=G.konumYumusak(s,t); if(onc){mx=Math.max(mx,Math.hypot(r.x-onc.x,r.y-onc.y));} onc=r;} out.adimMaks=mx;   // 8 ms'lik kare adımı: sıçrama yok
const ham=[{t:0,x:0,y:0},{t:240,x:5,y:0},{t:480,x:5,y:0},{t:720,x:12,y:0},{t:960,x:20,y:0},{t:1200,x:20,y:0},{t:1440,x:20,y:0},{t:1680,x:20,y:0},{t:1920,x:20,y:0},{t:2160,x:28,y:0}];
const rs=G.replaySeri({konumHam:ham}); out.rs=rs.map(p=>p.t);
out.eski=G.replaySeri({ornekler:[{t:0,x:1,y:1},{t:240,x:2,y:2},{t:480,x:null,y:null}]}).length;
out.olcum=rs.every(p=>ham.some(h=>h.t===p.t&&h.x===p.x&&h.y===p.y));
console.log(JSON.stringify(out));
"""
o=json.loads(subprocess.run(["node","-e",JS],capture_output=True,text=True,cwd="/tmp").stdout)
kontrol("2 pist: 25 pist, hepsi 300×200 kutu içinde", o["n"]==25 and not o["kutu"], o["kutu"])
kontrol("2 pist: döndürülen %d pistin hiçbiri dik/yan durmuyor (genişlik ≥ yükseklik)"%len(o["donen"]), len(o["donen"])>=10 and not o["dik"], o["dik"])
kontrol("2 pist: nokta sayıları aynı; şekil korunmuş (yalnız döndürme + uniform ölçek, ayna yok); dönmeyenler birebir aynı", not o["sayi"] and not o["sekil"], (o["sayi"],o["sekil"]))
kontrol("6 Ghost Lap: yumuşak eğri GERÇEK ölçümlerin hepsinden kendi zamanında geçer", o["gecis"])
kontrol("6 Ghost Lap: veri boşluğunda konum üretilmez (bosluk); tur öncesi 'yok', sonu 'bitti'", o["bosluk"]=="bosluk" and o["once"]=="yok" and o["bitti"]=="bitti", o)
kontrol("6 Ghost Lap: kareler arası sıçrama yok (8 ms adım ≤ 1 birim)", o["adimMaks"]<1.0, o["adimMaks"])
kontrol("6 Ghost Lap: kısa bayat tekrar tek örneğe iner, uzun duruş (başı+sonu) korunur; yalnız gerçek ölçümler", o["rs"]==[0,240,720,960,1920,2160] and o["olcum"], o["rs"])
kontrol("6 Ghost Lap: konumHam yoksa eski eşlenmiş seriye düşer", o["eski"]==2, o["eski"])
SONUC1=list(L.SONUC)

# ---- 7) tahmin renkleri (ayrı fixture) ----
exec(open('prediction_ui_v1_test.py').read().split("\nwith sync_playwright")[0])
L.SONUC[:0]=[]   # aynı sayaç
def rgb(s): return [int(x) for x in re.findall(r"\d+",s)[:3]]
with sync_playwright() as p:
    for w,tema in ((390,"koyu"),(1100,"koyu"),(390,"acik")):
        pg,errs,c,b=ac(p,"2026-10-06T10:00:00Z",w=w,tema=tema); bugun(pg)
        pg.evaluate("sekmeAc('grafik')"); ilerle(pg,6); beklekart(pg,"#tp-panel .tp-sat",6)
        r=pg.evaluate("""()=>{const q=(n,s)=>getComputedStyle(document.querySelector('#tp-panel .tp-tablo tbody tr td:nth-child('+n+') '+s));
          return {y:[2,3,4].map(n=>q(n,'.tp-y').color), b:[2,3,4].map(n=>q(n,'.tp-bar b').backgroundColor), th:[2,3,4].map(n=>getComputedStyle(document.querySelector('#tp-panel thead th:nth-child('+n+')')).color),
                  golge:[2,3,4].map(n=>q(n,'.tp-y').textShadow+q(n,'.tp-bar b').boxShadow), doc:document.documentElement.scrollWidth, sat:document.querySelectorAll('#tp-panel .tp-sat').length}}""")
        k,pd,pu=[rgb(x) for x in r["y"]]
        kontrol("7 %d/%s: Kazanma kırmızı, Podyum amber, Puan soğuk mavi"%(w,tema), k[0]>k[1]+60 and k[0]>k[2]+60 and pd[0]>pd[2]+60 and pd[1]>pd[2]+40 and pu[2]>pu[0]+40, r["y"])
        kontrol("7 %d/%s: yüzde, bar ve kolon başlığı aynı renk ailesi; glow yok"%(w,tema), r["y"]==r["b"]==r["th"] and all(g=="nonenone" for g in r["golge"]), r)
        kontrol("7 %d/%s: tablo yapısı aynı (8 satır), taşma 0, hata yok"%(w,tema), r["sat"]==8 and r["doc"]==w and not errs, (r["sat"],r["doc"],errs)); b.close()
print("\nTOPLAM %d/%d"%(sum(L.SONUC),len(L.SONUC)))
