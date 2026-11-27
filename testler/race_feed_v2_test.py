# race_feed_v2_test — 3.2.0 CANLI VERİ VE RACE FEED v2.
#  A) Merkezi Jolpica kuyruğu: açılış istek sayısı, eşzamanlı birleştirme, aralık (≤4/sn)
#  B) 429: Retry/backoff ile kendiliğinden düzelme · kalıcı 429 → "YOĞUN" kartı → sınırlı otomatik kurtarma · CORS'suz 429 (ağ hatası) → kart → kurtarma · sonsuz retry yok
#  C) Gerçek Katar 2026 FP2 verisi (Rory Mitchell; fixture-katar-2026-bsky.json): F2 notu elenir, kırmızı bayrak, 13 dk uzatma, seans sonu, durum zinciri
#  D) İki muhabirden aynı olay → tek kart (ekKaynaklar) · bir kaynak kapalı → diğeri çalışır
#  E) Seans anahtarları: FP notu yarış deposuna girmez; Yarış Günü yarış deposunu gösterir · yanlış seri/seans eşleşmesi yok
#  F) UI: HAFTA SONU seans detayında RACE FEED paneli, "henüz paylaşım yok" bilgisi, ticker etiketi · 390/1100 · koyu/açık · konsol hatası ve taşma 0
#  G) PWA arka plan: gizliyken poll yok, görünür olunca hemen poll
# Ağ yok: ya_lib düzeneği + Bluesky/Jolpica için test rotaları. Sahte saat.
import sys, re, json
sys.path.insert(0, '.')
exec(open('bugun_v3_test.py').read().split("\nwith sync_playwright")[0])

import os as _os
if _os.environ.get('F1KOK'):                                   # geliştirme: siteyi başka klasörden aç (varsayılan /home/claude/f1-takip)
    from playwright.sync_api._generated import Page as _P
    _g = _P.goto
    _P.goto = lambda self, url, *a, **k: _g(self, url.replace('file:///home/claude/f1-takip/', 'file://' + _os.environ['F1KOK'] + '/'), *a, **k)
    _r = _P.reload
FX = json.load(open('fixture-katar-2026-bsky.json'))
MITCHELL_DID = "did:plc:bmmxdktsmsdklw5arywa36iw"
# SENTETİK (yalnız bu test): Medland'ın aynı kırmızı bayrağı farklı cümleyle yazdığı varsayımı → çapraz kaynak birleştirme testi
MEDLAND_SENTETIK = [["sent-rf", "2026-11-27T17:29:40.000Z", "RED FLAG in FP2. #F1 #QatarGP"]]
def iso_ms(s): import datetime; return int(datetime.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000)

class Bsky:
    def __init__(s): s.simdi = 0; s.istek = []; s.kapali = set(); s.medland = FX["medland"] + MEDLAND_SENTETIK
    def feed(s, liste, handle, did):
        out = []
        for rkey, ts, txt in sorted(liste, key=lambda x: x[1], reverse=True):
            if iso_ms(ts) > s.simdi: continue
            out.append({"post": {"uri": "at://%s/app.bsky.feed.post/%s" % (did, rkey), "indexedAt": ts, "author": {"handle": handle, "did": did},
                                 "record": {"text": txt, "createdAt": ts}}})
        return {"feed": out[:30]}
    def rota(s, r):
        u = r.request.url; s.istek.append(u)
        m = re.search(r"actor=([^&]+)", u); actor = m.group(1).replace("%3A", ":") if m else ""
        if "mitchell" in actor or actor == MITCHELL_DID: kim, veri = "mitchell", s.feed(FX["mitchell"], "rorymitchellf1.bsky.social", MITCHELL_DID)
        elif "medland" in actor: kim, veri = "medland", s.feed(s.medland, "chrismedlandf1.bsky.social", "did:plc:medland")
        else: kim, veri = "?", {"feed": []}
        if kim in s.kapali: return r.fulfill(status=500, body="x", headers={"access-control-allow-origin": "*"})
        r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps(veri))

def sayfa(p, saat, w=1100, tema="koyu", bs=None):
    pg, errs, c, b = yeni(p, saat, w=w, tema=tema)
    bs = bs or Bsky()
    pg.route("**/public.api.bsky.app/**", bs.rota)
    kerr = []; pg.on("console", lambda m: kerr.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    return pg, errs, kerr, c, b, bs
def saat_esitle(pg, bs): bs.simdi = pg.evaluate("Date.now()")
def git(pg, bs, iso):
    pg.clock.set_system_time(iso); saat_esitle(pg, bs)
def bekle(pg, bs, sn):
    for _ in range(sn): ilerle(pg, 1); saat_esitle(pg, bs)
def depo(pg, key): return pg.evaluate("(k)=>{try{return RaceFeed.yukle(k).olaylar}catch(e){return null}}", key) or []
def jol(c): return [u.split("/ergast/f1/")[-1] for u in c.net if "api.jolpi.ca" in u]

with sync_playwright() as p:
    # ================= A) MERKEZİ JOLPICA KUYRUĞU =================
    pg, errs, kerr, c, b, bs = sayfa(p, NOW, w=390)
    ilerle(pg, 20)
    ac0 = jol(c)
    kontrol("A1 açılış (BUGÜN) Jolpica isteği ≤ 10 (önce: 29; 1950'den bugüne şampiyon listesi açılışta yüklenmez)", len(ac0) <= 10 and not [u for u in ac0 if re.match(r"19\d\d/", u)], (len(ac0), ac0[:12]))
    z = pg.evaluate("window.__jolpicaZaman.slice()")
    tepe = max([len([y for y in z[i:] if y - x < 1000]) for i, x in enumerate(z)] or [0])
    kontrol("A2 1 saniyede en çok 3 istek başlangıcı (resmî sınır 4/sn)", tepe <= 3, (tepe, z[:10]))
    once = len(jol(c))
    r = pg.evaluate("(async()=>{const u='https://api.jolpi.ca/ergast/f1/2026/9/results/?limit=30';const a=await Promise.all([fetch(u),fetch(u),fetch(u)]);const j=await Promise.all(a.map(x=>x.json()));return j.map(x=>x.MRData.RaceTable.Races.length)})()")
    kontrol("A3 aynı adrese 3 eşzamanlı istek → tek ağ isteği, 3 çağıran da veriyi alır", len(jol(c)) - once == 1 and r == [1, 1, 1], (len(jol(c)) - once, r))
    st = pg.evaluate("KaynakDurum.istatistik()")
    kontrol("A4 kuyruk istatistiği: birleşen ≥ 2, 429 yok", st["birlesen"] >= 2 and st["r429"] == 0, st)
    tikla(pg, "nav-kesfet"); pg.evaluate("sekmeAc('sampiyonlar')"); ilerle(pg, 6)
    kontrol("A5 ŞAMPİYONLAR açılınca liste yüklenmeye başlar (tembel yükleme)", len([u for u in jol(c) if re.match(r"19\d\d/driverstandings", u)]) >= 1, len(jol(c)))
    kontrol("A6 hata yok", not errs and not kerr, (errs, kerr[:3])); b.close()

    # ================= B) 429 ve OTOMATİK KURTARMA =================
    # B1: geçici 429 (CORS başlıklı) → kuyruk bekler, kendiliğinden düzelir, kart çıkmaz
    pg, errs, kerr, c, b, bs = sayfa(p, NOW, w=390)
    say = {"n": 0}
    def r429(r):
        if "/2026/races/" in r.request.url and say["n"] < 2: say["n"] += 1; return r.fulfill(status=429, body="x", headers={"access-control-allow-origin": "*"})
        r.fallback()
    pg.route("**/api.jolpi.ca/**", r429); pg.reload(); ilerle(pg, 3); tikla(pg, "nav-bugun"); ilerle(pg, 20)
    st = pg.evaluate("KaynakDurum.istatistik()")
    kv = pg.evaluate("(()=>{const k=document.querySelector('#bg-kok [data-kaynak-kart]');return !!k&&k.checkVisibility()})()")
    kontrol("B1 geçici 429 ×2 → otomatik yeniden deneme, BUGÜN normal (kart yok), durum 'tamam'", st["r429"] >= 2 and pg.evaluate("KaynakDurum.durum()") == "tamam" and not kv, (st, kv))
    b.close()

    def kart(pg, sel): return pg.evaluate("(s)=>{const k=document.querySelector(s+' [data-kaynak-kart]');return k&&k.checkVisibility()?k.innerText:''}", sel)
    # B2: kalıcı 429 (CORS başlıklı) → "YOĞUN" kartı, sınırlı istek; kaynak düzelince sınırlı otomatik kurtarma (tıklamadan)
    for w, tema in ((390, "koyu"), (1100, "acik")):
        T = "[%d %s]" % (w, tema)
        pg, errs, kerr, c, b, bs = sayfa(p, NOW, w=w, tema=tema)
        D = {"mod": "429"}
        def rk(r):
            if D["mod"] == "429": return r.fulfill(status=429, body="x", headers={"access-control-allow-origin": "*"})
            if D["mod"] == "cors": return r.abort("failed")                                       # CORS'suz 429 tarayıcıda ağ hatası (TypeError) olarak görünür → bağlantı kesme ile aynı
            r.fallback()
        pg.route("**/api.jolpi.ca/**", rk); pg.reload(); ilerle(pg, 2); pg.evaluate("localStorage.clear()"); del c.net[:]
        tikla(pg, "nav-haftasonu"); ilerle(pg, 40)
        k = kart(pg, "#sekme-hafta")
        n429 = len(jol(c))
        kontrol("B2" + T + " kalıcı 429 → HAFTA SONU 'VERİ KAYNAĞI ŞU AN YOĞUN' kartı (teknik metin yok)", "YOĞUN" in k and "429" not in k and "HTTP" not in k, k[:160])
        kontrol("B3" + T + " sonsuz retry yok: 40 sn'de ≤ 12 Jolpica isteği", n429 <= 12, n429)
        D["mod"] = "ok"; ilerle(pg, 40)
        kontrol("B4" + T + " kaynak düzelince OTOMATİK kurtarma (tıklamadan): yarış haftası açıldı", pg.locator("#sekme-hafta .h-hero").count() == 1 and not kart(pg, "#sekme-hafta"), kart(pg, "#sekme-hafta")[:120])
        # CORS'suz 429 (ağ hatası gibi görünür) → genel kart, sonra elle YENİDEN DENE ile kurtarma
        D["mod"] = "cors"; pg.reload(); ilerle(pg, 2); pg.evaluate("localStorage.clear()"); pg.reload(); ilerle(pg, 2); del c.net[:]
        tikla(pg, "nav-haftasonu"); ilerle(pg, 30)
        k = kart(pg, "#sekme-hafta")
        kontrol("B5" + T + " ağ/CORS hatası (CORS'suz 429) → 'VERİ KAYNAĞINA ULAŞILAMIYOR' kartı + YENİDEN DENE", "ULAŞILAMIYOR" in k and "YENİDEN DENE" in k, k[:160])
        D["mod"] = "ok"; pg.click("#sekme-hafta [data-kaynak-yeniden]"); ilerle(pg, 16)
        kontrol("B6" + T + " YENİDEN DENE → normale döndü", pg.locator("#sekme-hafta .h-hero").count() == 1, kart(pg, "#sekme-hafta")[:120])
        kontrol("B7" + T + " taşma 0, JS/konsol hatası yok", tasma(pg) == 0 and not errs and not kerr, (tasma(pg), errs, kerr[:3])); b.close()

    # ================= C) GERÇEK KATAR FP2 VERİSİ — motor + durum =================
    pg, errs, kerr, c, b, bs = sayfa(p, "2026-11-27T17:45:00Z", w=1100)
    saat_esitle(pg, bs); bekle(pg, bs, 30)
    po = pg.evaluate("(()=>{const o=FeedCanli.pollOturumu();return o?{o:o.oturum,k:o.raceKey}:null})()")
    kontrol("C1 FP2 canlı → Race Feed oturumu SecondPractice, depo 2026-22-fp2", po == {"o": "SecondPractice", "k": "2026-22-fp2"}, po)
    ev = depo(pg, "2026-22-fp2")
    metinler = [e["textTr"] for e in ev]
    kontrol("C2 FP2 deposunda kırmızı bayrak notları Türkçe ('Kırmızı bayrak çıktı; seans durduruldu.')", sum(1 for m in metinler if m.startswith("Kırmızı bayrak çıktı")) == 2, metinler)
    kontrol("C3 başka seri (F2 pole) ve seans dışı not (Vowles 16:06, FP1 özeti) FP2'ye karışmadı", not [m for m in metinler if "Ugochukwu" in m or "Vowles" in m or "FP1" in m], metinler)
    kontrol("C4 FP2 notu yarış deposuna (2026-22) ve diğer seanslara girmedi", not depo(pg, "2026-22") and not depo(pg, "2026-22-fp1") and not depo(pg, "2026-22-sprint"), [len(depo(pg, k)) for k in ("2026-22", "2026-22-fp1", "2026-22-sprint")])
    rf = [e for e in ev if e["category"] == "RED_FLAG"]
    ilk = sorted(rf, key=lambda e: e["timestamp"])[0] if rf else {}
    kontrol("D1 iki muhabirden aynı kırmızı bayrak → TEK kart, ikinci kaynak 'ekKaynaklar'da", len(rf) == 2 and any(q.get("ad") == "Chris Medland" for q in ilk.get("ekKaynaklar", [])) or (ilk.get("sourceName") == "Chris Medland" and any(q.get("ad") == "Rory Mitchell" for q in ilk.get("ekKaynaklar", []))), [(e["timestamp"], e["sourceName"], e.get("ekKaynaklar")) for e in rf])
    def durum(pg, an="SecondPractice"):
        return pg.evaluate("""(an)=>{const h=HaftaVeri.haftaKur(sezonYarislar.find(y=>y.round==='22'),'f1');const s=h.seanslar.find(x=>x.anahtar===an);
          const st=HaftaState.durum({seans:s,simdi:Date.now(),sonucVar:false,eski:HaftaVeri.seansDurumu(s,h),olaylar:RaceFeed.yukle(RaceFeed.oturumAnahtari(2026,22,an)).olaylar});
          return {d:st.durum,k:st.kaynak,t:st.tahmini,u:st.uzatmaDk||0,o:st.ozet}}""", an)
    d = durum(pg)
    kontrol("C5 17:45 → durum KIRMIZI BAYRAK (feed, kesin)", d["d"] == "RED_FLAG" and d["k"] == "feed", d)
    git(pg, bs, "2026-11-27T17:52:30Z"); bekle(pg, bs, 35)
    d = durum(pg)
    kontrol("C6 17:52 → 13 dk uzatma okundu; kırmızı bayrak sonrası pist olayı → LIVE TAHMİNİ (kesin 'yeniden başladı' uydurulmaz)", d["u"] == 13 and d["d"] == "LIVE" and d["t"] and "tahmini" in d["o"], d)
    git(pg, bs, "2026-11-27T18:06:00Z"); bekle(pg, bs, 35)
    po = pg.evaluate("(()=>{const o=FeedCanli.pollOturumu();return o?{o:o.oturum,u:o.uzatmaDk||0}:null})()")
    kontrol("C7 18:06 (planlı bitiş 18:00 geçti) → doğrulanmış uzatma nedeniyle poll sürüyor; seans BİTTİ ilan edilmedi", po and po["o"] == "SecondPractice" and durum(pg)["d"] != "RESULT_PENDING", (po, durum(pg)))
    tk = pg.evaluate("(()=>{const o=FeedCanli.tickerOturum(Date.now());return o?{o:o.oturum,d:o.durum,f:o.feedYok}:null})()")
    kontrol("C8 ticker 18:06'da hâlâ FP2 (uzatılmış süre), feedYok=false", tk == {"o": "SecondPractice", "d": "canli", "f": False}, tk)
    git(pg, bs, "2026-11-27T18:15:00Z"); bekle(pg, bs, 35)
    d = durum(pg)
    kontrol("C9 18:15 'Antonelli tops Friday … FP2' → seans bitti (SONUÇ BEKLENİYOR); sonuç uydurulmaz", d["d"] == "RESULT_PENDING", d)
    ev = depo(pg, "2026-22-fp2")
    kontrol("C10 'Seans 13 dakika uzatıldı.' ve 'Antonelli cuma antrenmanlarını zirvede tamamladı.' notları", any(e["textTr"] == "Seans 13 dakika uzatıldı." for e in ev) and any(e["textTr"].startswith("Antonelli cuma antrenmanlarını zirvede tamamladı.") for e in ev), [e["textTr"][:60] for e in ev])
    git(pg, bs, "2026-11-27T18:50:00Z"); bekle(pg, bs, 8)
    kontrol("C11 18:50 → FP2 poll'u kapandı (sonsuz poll yok)", pg.evaluate("FeedCanli.pollOturumu()") is None)
    n0 = len(bs.istek); bekle(pg, bs, 70)
    kontrol("C12 seans dışında Bluesky isteği yok", len(bs.istek) == n0, len(bs.istek) - n0)
    kontrol("C13 hata yok", not errs and not kerr, (errs, kerr[:3])); b.close()

    # ================= D2) BİR KAYNAK KAPALI → DİĞERİ ÇALIŞIR =================
    bs2 = Bsky(); bs2.kapali.add("medland")
    pg, errs, kerr, c, b, bs = sayfa(p, "2026-11-27T17:45:00Z", w=390, bs=bs2)
    saat_esitle(pg, bs); bekle(pg, bs, 30)
    ev = depo(pg, "2026-22-fp2")
    kontrol("D2 Medland HTTP 500 → Rory Mitchell notları yine de geldi (kaynak bağımsızlığı)", len([e for e in ev if e["sourceName"] == "Rory Mitchell"]) >= 3 and not [e for e in ev if e["sourceName"] == "Chris Medland"], [(e["sourceName"], e["textTr"][:40]) for e in ev])
    kontrol("D3 hata yok", not errs and not kerr, (errs, kerr[:3])); b.close()

    # ================= E/F) UI: seans detayı, Yarış Günü ayrımı, ticker · 390/1100 · koyu/açık =================
    for w, tema in ((390, "koyu"), (390, "acik"), (1100, "koyu"), (1100, "acik")):
        T = "[%d %s]" % (w, tema)
        pg, errs, kerr, c, b, bs = sayfa(p, "2026-11-27T17:45:00Z", w=w, tema=tema)
        saat_esitle(pg, bs); bekle(pg, bs, 30)
        tikla(pg, "nav-haftasonu"); bekle(pg, bs, 12)
        pg.evaluate("(()=>{const b=document.querySelector(\"#sekme-hafta [data-act='seans'][data-key='SecondPractice']\");if(b)b.click()})()"); bekle(pg, bs, 2)
        dp = pg.evaluate("(()=>{const e=document.querySelector('#sekme-hafta .h-dp');return e?e.innerText:''})()")
        kontrol("F1" + T + " HAFTA SONU → Antrenman 2 detayı: RACE FEED paneli + KIRMIZI BAYRAK rozeti + kaynak adı", "RACE FEED" in dp and "KIRMIZI BAYRAK" in dp and "Rory Mitchell" in dp, dp[:300])
        kontrol("F2" + T + " paylaşım saati görünür (HH:MM)", bool(re.search(r"\b\d{2}:\d{2}\b", dp)))
        tikla(pg, "nav-haftasonu"); pg.evaluate("sekmeAc('gun')"); bekle(pg, bs, 3)
        gn = pg.evaluate("(()=>{const e=document.getElementById('gun-notlar');return e?e.innerText:''})()")
        kontrol("E1" + T + " Yarış Günü (yarış sayfası) antrenman notlarını GÖSTERMEZ", "Kırmızı bayrak çıktı; seans durduruldu" not in gn, gn[:160])
        tke = pg.evaluate("(()=>{const e=document.getElementById('a45-ticker');return e&&!e.hidden?e.innerText:''})()")
        kontrol("F3" + T + " ticker: ANTRENMAN 2 + kırmızı bayrak etiketi (düz LIVE değil)", "ANTRENMAN 2" in tke and "RED FLAG" in tke, tke)
        kontrol("F4" + T + " taşma 0, JS/konsol hatası yok", tasma(pg) == 0 and not errs and not kerr, (tasma(pg), errs, kerr[:3])); b.close()

    # F5: canlı seans, muhabirlerden paylaşım yok → açık bilgi
    bs3 = Bsky(); bs3.medland = []; FX_YED = FX["mitchell"]; FX["mitchell"] = []
    pg, errs, kerr, c, b, bs = sayfa(p, "2026-11-28T14:50:00Z", w=390, bs=bs3)
    saat_esitle(pg, bs); bekle(pg, bs, 30); tikla(pg, "nav-haftasonu"); bekle(pg, bs, 10)
    pg.evaluate("(()=>{const b=document.querySelector(\"#sekme-hafta [data-act='seans'][data-key='ThirdPractice']\");if(b)b.click()})()"); bekle(pg, bs, 2)
    dp = pg.evaluate("(()=>{const e=document.querySelector('#sekme-hafta .h-dp');return e?e.innerText:''})()")
    kontrol("F5 FP3 canlı, paylaşım yok → 'bu seans için henüz paylaşım yok' bilgisi (LIVE TAHMİNİ korunur)", "henüz paylaşım yok" in dp and "LIVE TAHMİNİ" in dp, dp[:300])
    tke = pg.evaluate("(()=>{const e=document.getElementById('a45-ticker');return e&&!e.hidden?e.innerText:''})()")
    kontrol("F6 ticker: 'Muhabirlerden bu seans için henüz paylaşım yok'", "henüz paylaşım yok" in tke, tke)
    FX["mitchell"] = FX_YED

    # ================= G) PWA arka plandan dönüş =================
    FX["mitchell"] = FX_YED
    pg.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))")
    n0 = len(bs.istek); bekle(pg, bs, 75)
    kontrol("G1 uygulama arka planda (gizli) → Bluesky poll yok", len(bs.istek) == n0, len(bs.istek) - n0)
    pg.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'))")
    bekle(pg, bs, 3)
    kontrol("G2 görünür olunca hemen poll (≤ 3 sn)", len(bs.istek) > n0, len(bs.istek) - n0)
    kontrol("G3 hata yok", not errs and not kerr, (errs, kerr[:3])); b.close()

    # ================= H) Saf birimler: seans anahtarı, seri filtresi =================
    pg, errs, kerr, c, b, bs = sayfa(p, NOW, w=390)
    k = pg.evaluate("['FirstPractice','SecondPractice','ThirdPractice','SprintQualifying','SprintShootout','Sprint','Qualifying','Race'].map(a=>RaceFeed.oturumAnahtari(2026,22,a))")
    kontrol("H1 oturum anahtarları (yarış anahtarı değişmedi)", k == ["2026-22-fp1", "2026-22-fp2", "2026-22-fp3", "2026-22-sq", "2026-22-sq", "2026-22-sprint", "2026-22-q", "2026-22"], k)
    sr = pg.evaluate("['F3 champion takes pole on his F2 debut','Formula E Sao Paulo ePrix','MotoGP Valencia','Red flag in FP2','Hamilton passes Leclerc for P5'].map(t=>RaceFeed.digerSeriMi(t))")
    kontrol("H2 seri filtresi: F2/F3/FE/MotoGP elenir, F1 notları geçer", sr == [True, True, True, False, False], sr)
    kontrol("H3 hata yok", not errs, errs); b.close()

print("TOPLAM %d/%d" % (sum(L.SONUC), len(L.SONUC)))
