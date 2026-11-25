/* A3.4b — Lastik stratejisi: SAF çözümleme fonksiyonları (ağ yok, DOM yok; Node'da da test edilir).
   Girdi: OpenF1 /stints satırları { driver_number, stint_number, compound, lap_start, lap_end, tyre_age_at_start }.
   KURALLAR: yalnızca ölçülebilir bilgi (stint sayısı, bileşik sırası, stint uzunluğu, başlangıç lastik yaşı). Sebep/strateji yorumu YOK.
   - Stint uzunluğu = lap_end − lap_start + 1; lap_end boşsa (son stint) yarışın en büyük lap_end değeri kullanılır, o da yoksa uzunluk bilinmez (null).
   - Bileşik: SOFT, MEDIUM, HARD, INTERMEDIATE, WET; tanınmayan/boş değer "bilinmiyor" (uydurma yok).
   - Aynı pilot için aynı stint_number tekrarlanırsa son satır geçerli; driver_number veya lap_start olmayan satır atılır.
   - Ana yarış oturumu: session_name "Race" ∧ session_type "Race". "Sprint" oturumu (session_type de "Race" olabilir) ASLA seçilmez. */
(function (kok) {
  "use strict";
  var BILESIK = {
    SOFT: { k: "soft", ad: "Yumuşak" }, MEDIUM: { k: "medium", ad: "Orta" }, HARD: { k: "hard", ad: "Sert" },
    INTERMEDIATE: { k: "inter", ad: "Ara lastik" }, WET: { k: "wet", ad: "Yağmur" }
  };
  var BILINMIYOR = { k: "bilinmiyor", ad: "Bilinmiyor" };
  var CANLI_PENCERE_MS = 30 * 60 * 1000;      // OpenF1: seans bitişinden 30 dk sonrasına kadar "canlı" (ücretli) pencere

  function sayi(v) { return typeof v === "number" && isFinite(v) ? v : (typeof v === "string" && v.trim() !== "" && isFinite(Number(v)) ? Number(v) : null); }
  function norm(x) { return String(x == null ? "" : x).trim().toLowerCase(); }
  function bilesik(c) { return BILESIK[String(c == null ? "" : c).trim().toUpperCase()] || BILINMIYOR; }

  function stintleriCoz(rows) {
    var uyari = [], gec = {}, enBuyuk = 0;
    (rows || []).forEach(function (r) { var e = r ? sayi(r.lap_end) : null; if (e != null && e > enBuyuk) { enBuyuk = e; } });
    (rows || []).forEach(function (r, i) {
      if (!r || r.driver_number == null) { uyari.push("driver_number yok (#" + i + ")"); return; }
      var bas = sayi(r.lap_start); if (bas == null) { uyari.push("lap_start yok (#" + i + ")"); return; }
      var no = String(r.driver_number), sn = sayi(r.stint_number);
      var t = gec[no] || (gec[no] = {});
      var anahtar = sn != null ? sn : "i" + i;
      if (t[anahtar]) { uyari.push("tekrarlanan stint #" + no + "/" + anahtar); }
      var bit = sayi(r.lap_end), yas = sayi(r.tyre_age_at_start), son = bit != null ? bit : (enBuyuk >= bas ? enBuyuk : null);
      t[anahtar] = { n: sn, b: bilesik(r.compound), bas: bas, bit: bit != null ? bit : son, tur: son != null && son >= bas ? son - bas + 1 : null, yas: yas != null && yas > 0 ? yas : 0, bitisEksik: bit == null };
    });
    var pilot = {};
    Object.keys(gec).forEach(function (no) {
      pilot[no] = Object.keys(gec[no]).map(function (k) { return gec[no][k]; }).sort(function (a, b) { return (a.n == null ? 1e9 : a.n) - (b.n == null ? 1e9 : b.n) || a.bas - b.bas; });
    });
    return { pilot: pilot, enBuyukTur: enBuyuk || null, uyari: uyari };
  }

  function ozet(stintler) {
    return { sayi: stintler.length, sira: stintler.map(function (s) { return s.b.ad; }) };
  }

  // Pit karşılaştırma: OpenF1'e göre pit turu = bir stintin son turu (son stint hariç). Jolpica turları verilirse karşılaştırılır; hiçbiri diğerini düzeltmez.
  function pitKarsilastir(stintler, jolpicaTurlar) {
    var openf1 = stintler.slice(0, -1).map(function (s) { return s.bit; }).filter(function (x) { return x != null; });
    if (!jolpicaTurlar) { return { openf1: openf1, jolpica: null, fark: null }; }
    var jt = jolpicaTurlar.slice().sort(function (a, b) { return a - b; }), fark = jt.length !== openf1.length;
    if (!fark) { for (var i = 0; i < jt.length; i++) { if (Math.abs(jt[i] - openf1[i]) > 1) { fark = true; break; } } }
    return { openf1: openf1, jolpica: jt, fark: fark };
  }

  // Yarış oturumunu seç. Dönüş: oturum | null. yarisBaslangicMs: Jolpica yarış başlangıcı (yanlış hafta sonu koruması ±12 saat).
  function yarisOturumuSec(oturumlar, yarisBaslangicMs) {
    var liste = (oturumlar || []).filter(function (o) { return o && norm(o.session_name) === "race" && norm(o.session_type) === "race"; });
    if (!liste.length) {   // yedek: adı "Sprint" içermeyen "Race" türü oturum
      liste = (oturumlar || []).filter(function (o) { return o && norm(o.session_type) === "race" && !/sprint/.test(norm(o.session_name)); });
    }
    liste = liste.filter(function (o) { return !yarisBaslangicMs || !isFinite(Date.parse(o.date_start)) || Math.abs(Date.parse(o.date_start) - yarisBaslangicMs) <= 12 * 3600 * 1000; });
    liste.sort(function (a, b) { return Math.abs(Date.parse(a.date_start) - yarisBaslangicMs) - Math.abs(Date.parse(b.date_start) - yarisBaslangicMs); });
    return liste[0] || null;
  }

  // Tarihsel (ücretsiz) pencere: bitişten 30 dk sonra. date_end bilinmiyorsa başlangıçtan 3 saat sonra kabul edilir.
  function yayimlandiMi(dateEnd, yarisBaslangicMs, simdi) {
    var bit = Date.parse(dateEnd);
    var e = isFinite(bit) ? bit : (yarisBaslangicMs || 0) + 2 * 3600 * 1000;
    return simdi >= e + CANLI_PENCERE_MS;
  }


  // ================= v3.2.0 — LASTİK VE YARIŞ STRATEJİSİ (saf) =================
  // KURALLAR: stint yalnız kaynak satırından; lastik türü tahmin edilmez (tanınmayan → "bilinmiyor"); yarışı tamamlamayan pilotun stinti
  // tamamladığı turda biter (sahte uzatma yok); son stintin lap_end'i boşsa yalnız pilotun Jolpica tur sayısıyla kapatılır.
  // Pit lane süresi (lane_duration) ile durağan süre (stop_duration) ayrı tutulur; hiçbiri diğerinin yerine geçmez.
  var KISA = { soft: "S", medium: "M", hard: "H", inter: "I", wet: "W", bilinmiyor: "?" };
  var ING = { soft: "SOFT", medium: "MEDIUM", hard: "HARD", inter: "INTERMEDIATE", wet: "WET", bilinmiyor: "BİLİNMİYOR" };
  function pilotlarJ(sonuc) {
    var l = (sonuc || []).filter(function (r) { return r && r.Driver; }).map(function (r) {
      var pt = String(r.positionText == null ? "" : r.positionText), g = sayi(r.grid);
      return { id: r.Driver.driverId, kod: r.Driver.code || String(r.Driver.familyName || "").slice(0, 3).toUpperCase(), soyad: r.Driver.familyName || "",
               ad: ((r.Driver.givenName || "") + " " + (r.Driver.familyName || "")).trim(), takim: r.Constructor ? r.Constructor.name : "", no: String(r.number),
               bitis: sayi(r.position), siniflandi: /^\d+$/.test(pt), pt: pt, grid: g && g > 0 ? g : null, pitYolu: !(g && g > 0), tur: sayi(r.laps) || 0, durum: String(r.status || "") };
    });
    var kaz = l.filter(function (p) { return p.bitis === 1; })[0], N = kaz ? kaz.tur : Math.max.apply(null, [0].concat(l.map(function (p) { return p.tur; })));
    l.forEach(function (p) { p.cekildi = (/^(R|DNF|RET)$/i.test(p.pt) || (p.siniflandi && p.tur < N && !/Finished|Lap/i.test(p.durum))) && p.tur < N; p.dns = /^(W|DNS)$/i.test(p.pt) || (p.tur === 0 && !p.siniflandi); });
    return { liste: l, N: N };
  }
  function strateji(g) {
    g = g || {};
    var PJ = pilotlarJ(g.sonuc), N = PJ.N, uyari = [], hamS = {};
    (g.stintRows || []).forEach(function (r, i) {
      if (!r || r.driver_number == null) { return; }
      var bas = sayi(r.lap_start); if (bas == null) { uyari.push("lap_start yok #" + i); return; }
      var no = String(r.driver_number), sn = sayi(r.stint_number), t = hamS[no] || (hamS[no] = {}), an = sn != null ? sn : "i" + i;
      t[an] = { n: sn, b: bilesik(r.compound), bas: bas, bitHam: sayi(r.lap_end), yas: sayi(r.tyre_age_at_start) };
    });
    var pitBy = {};
    (g.pit || []).forEach(function (p) {
      var no = String(p.driverNumber != null ? p.driverNumber : p.driver_number), lap = sayi(p.lapNumber != null ? p.lapNumber : p.lap_number);
      if (no === "undefined" || lap == null) { return; }
      (pitBy[no] = pitBy[no] || []).push({ tur: lap, lane: sayi(p.laneDuration != null ? p.laneDuration : p.lane_duration), durak: sayi(p.stopDuration != null ? p.stopDuration : p.stop_duration), es: false });
    });
    Object.keys(pitBy).forEach(function (no) { pitBy[no].sort(function (a, b) { return a.tur - b.tur; }); });
    var pitVar = g.pit != null;
    var satirlar = PJ.liste.map(function (p) {
      var ham = hamS[p.no] ? Object.keys(hamS[p.no]).map(function (k) { return hamS[p.no][k]; }) : [];
      ham.sort(function (a, b) { return (a.n == null ? 1e9 : a.n) - (b.n == null ? 1e9 : b.n) || a.bas - b.bas; });
      var sinir = p.dns ? 0 : (p.tur > 0 ? p.tur : null), st = [];          // DNS: hiç tur tamamlanmadı → blok çizilmez
      ham.forEach(function (s, i) {
        var son = i === ham.length - 1, bit = s.bitHam;
        if (bit == null && son && sinir != null) { bit = sinir; }                 // son stint açık: pilotun tamamladığı tur (Jolpica)
        if (bit != null && sinir != null && bit > sinir) { bit = sinir; }         // tamamlanan turdan ötesi çizilmez
        if (sinir != null && s.bas > sinir) { uyari.push(p.kod + ": tamamlanan turdan sonra başlayan stint atıldı"); return; }
        st.push({ n: s.n, b: s.b, bas: s.bas, bit: bit, uzun: bit != null && bit >= s.bas ? bit - s.bas + 1 : null, yas: s.yas, pit: null });
      });
      var pl = pitBy[p.no] || [];
      st.forEach(function (s, i) { if (i === 0) { return; } var m = pl.filter(function (x) { return !x.es && (x.tur === s.bas - 1 || x.tur === s.bas); })[0]; if (m) { m.es = true; s.pit = m; } });
      // tutarlılık: pit verisi varken her pit bir stint geçişiyle, her geçiş bir pitle eşleşmeli; değilse satır özet maddelerinde kullanılmaz
      // (son turda yapılan, ardından stint kaydı gelmeyen pit — ör. pit sonrası çekilme — eşleşmemiş sayılmaz)
      var sonBit = st.length ? st[st.length - 1].bit : null;
      var tutarli = !pitVar || (pl.every(function (x) { return x.es || (sonBit != null && x.tur >= sonBit); }) && st.slice(1).every(function (x) { return !!x.pit; }));
      var uzunlar = st.filter(function (s) { return s.uzun != null; }), enUzun = uzunlar.slice().sort(function (a, b) { return b.uzun - a.uzun || a.bas - b.bas; })[0] || null;
      return { id: p.id, kod: p.kod, soyad: p.soyad, ad: p.ad, takim: p.takim, no: p.no, bitis: p.bitis, pt: p.pt, siniflandi: p.siniflandi, grid: p.grid, pitYolu: p.pitYolu,
               tur: p.tur, cekildi: p.cekildi, dns: p.dns, stintler: st, pitler: pitVar ? pl.map(function (x) { return { tur: x.tur, lane: x.lane, durak: x.durak, eslesti: x.es }; }) : null,
               pitSayisi: pitVar ? pl.length : null, enUzun: enUzun, tutarli: tutarli };
    });
    satirlar.sort(function (a, b) {
      var ak = a.siniflandi && a.bitis ? a.bitis : 1000 - a.tur, bk = b.siniflandi && b.bitis ? b.bitis : 1000 - b.tur;
      return ak - bk;
    });
    var bilinen = {}; satirlar.forEach(function (s) { s.stintler.forEach(function (x) { bilinen[x.b.k] = 1; }); });
    return { satirlar: satirlar, toplamTur: N, lastikler: Object.keys(bilinen), veriVar: satirlar.some(function (s) { return s.stintler.length; }), uyari: uyari };
  }
  function dizilim(s) { return s.stintler.map(function (x) { return x.b.k; }).join(">"); }
  // En fazla 3 deterministik bilgi. Hesaplanamayan madde hiç üretilmez. Değerlendirme ("en iyi", "yanlış") yok.
  function stratejiOzet(R) {
    var out = [], sat = (R && R.satirlar) || [];
    var tam = sat.filter(function (s) { return s.tutarli !== false && s.stintler.length && s.stintler.every(function (x) { return x.uzun != null; }); });
    var enUz = null; tam.forEach(function (s) { s.stintler.forEach(function (x) { if (!enUz || x.uzun > enUz.x.uzun) { enUz = { s: s, x: x }; } }); });
    if (enUz && enUz.x.b.k !== "bilinmiyor") { out.push("En uzun stint: " + enUz.s.soyad + ", " + ING[enUz.x.b.k] + " ile " + enUz.x.uzun + " tur (tur " + enUz.x.bas + "–" + enUz.x.bit + ")."); }
    var kaz = sat.filter(function (s) { return s.bitis === 1; })[0];
    if (kaz && kaz.stintler.length && tam.indexOf(kaz) >= 0) {
      var d = kaz.stintler.length - 1;
      out.push(kaz.soyad + " yarışı " + (d === 0 ? "lastik değiştirmeden" : d + " lastik değişimiyle") + " kazandı: " + kaz.stintler.map(function (x) { return ING[x.b.k]; }).join(" → ") + ".");
    }
    var pod = sat.filter(function (s) { return s.bitis && s.bitis <= 3; });
    if (pod.length === 3 && pod.every(function (s) { return tam.indexOf(s) >= 0; })) {
      var dz = pod.map(dizilim), farkli = dz[0] !== dz[1] && dz[1] !== dz[2] && dz[0] !== dz[2], ayni = dz[0] === dz[1] && dz[1] === dz[2];
      if (farkli) { out.push("Podyumdaki üç pilot üç farklı lastik dizilimi kullandı."); } else if (ayni) { out.push("Podyumdaki üç pilot aynı lastik dizilimini kullandı."); }
    }
    return out.slice(0, 3);
  }
  // Bayrak zaman pencereleri (ms) — RaceControl.normalize çıktısından. SC/VSC: açık "DEPLOYED" → END; kırmızı bayrak: RED_FLAG → sonraki açık RESUMED.
  function bayrakPencereleri(rc) {
    var w = [], ac = {};
    (rc || []).forEach(function (e) {
      var t = e.normalizedType, a = e.subType, ms = e.ms != null ? e.ms : Date.parse(e.date);
      if (!isFinite(ms)) { return; }
      if (t === "SAFETY_CAR" || t === "VSC") {
        if (a !== "END") { if (!ac[t] && /DEPLOYED/i.test(String(e.message || ""))) { ac[t] = { tip: t === "VSC" ? "VSC" : "SC", bas: ms, basTur: sayi(e.lapNumber) }; } }
        else if (ac[t]) { ac[t].bit = ms; ac[t].bitTur = sayi(e.lapNumber); w.push(ac[t]); ac[t] = null; }
      } else if (t === "RED_FLAG" && !ac.RED) { ac.RED = { tip: "RED", bas: ms, basTur: sayi(e.lapNumber) }; }
      else if (t === "SESSION_RESUMED" && a === "EXPLICIT" && ac.RED) { ac.RED.bit = ms; ac.RED.bitTur = sayi(e.lapNumber); w.push(ac.RED); ac.RED = null; }
    });
    Object.keys(ac).forEach(function (k) { if (ac[k]) { ac[k].bit = null; ac[k].bitTur = null; w.push(ac[k]); } });
    return w.sort(function (a, b) { return a.bas - b.bas; });
  }
  function medyan(l) { var s = l.slice().sort(function (a, b) { return a - b; }), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; }
  // Stint temposu (tek pilot). turlar: LapsVeri normalize turları (driverNumber, lapNumber, lapDuration, isPitOutLap, dateStart).
  // Hariç: 1. tur · pit çıkış turu · pit giriş turu (stint sonu, sonrasında pit varsa) · süresi olmayan tur · bayrak penceresiyle (zamanla, pilotun
  // KENDİ turu) çakışan tur ve pencere bitişinden sonraki ilk tur · kalan turların medyanından %10'dan yavaş tur (trafik/olay; açıkça geçersiz sayılır).
  // En az 5 temiz tur yoksa tempo HESAPLANMAZ (null).
  var EN_AZ_TEMIZ = 5, YAVAS_ORAN = 1.10;
  function tempo(turlar, satir, pencereler) {
    if (!turlar || !satir || !satir.stintler) { return null; }
    var no = Number(satir.no), my = turlar.filter(function (t) { return t.driverNumber === no; });
    if (!my.length) { return null; }
    var W = (pencereler || []).map(function (w) { return { bas: w.bas, bit: w.bit != null ? w.bit : Infinity }; });
    var sonrasi = {}; W.forEach(function (w) { if (!isFinite(w.bit)) { return; } var ilk = my.filter(function (t) { return t.dateStart && Date.parse(t.dateStart) >= w.bit; }).sort(function (a, b) { return a.lapNumber - b.lapNumber; })[0]; if (ilk) { sonrasi[ilk.lapNumber] = 1; } });
    return satir.stintler.map(function (s, i) {
      var sonraPit = i < satir.stintler.length - 1;
      var aday = my.filter(function (t) { return t.lapNumber >= s.bas && (s.bit == null || t.lapNumber <= s.bit); });
      var haric = { ilkTur: 0, pit: 0, sure: 0, bayrak: 0, yavas: 0 }, temiz = [];
      aday.forEach(function (t) {
        if (t.lapNumber === 1) { haric.ilkTur++; return; }
        if (t.isPitOutLap || (sonraPit && t.lapNumber === s.bit)) { haric.pit++; return; }
        if (t.lapDuration == null) { haric.sure++; return; }
        var b = t.dateStart ? Date.parse(t.dateStart) : NaN, e = b + t.lapDuration * 1000;
        if (sonrasi[t.lapNumber] || (isFinite(b) && W.some(function (w) { return b < w.bit && e > w.bas; }))) { haric.bayrak++; return; }
        temiz.push(t.lapDuration);
      });
      var m0 = medyan(temiz), son = m0 == null ? [] : temiz.filter(function (x) { return x <= m0 * YAVAS_ORAN; });
      haric.yavas = temiz.length - son.length;
      var yeter = son.length >= EN_AZ_TEMIZ;
      return { stint: s, turSayisi: aday.length, kullanilan: son.length, haric: haric, medyan: yeter ? medyan(son) : null, enHizli: yeter ? Math.min.apply(null, son) : null };
    });
  }

  var API = { strateji: strateji, stratejiOzet: stratejiOzet, bayrakPencereleri: bayrakPencereleri, tempo: tempo, medyan: medyan, ING: ING, KISA: KISA, EN_AZ_TEMIZ: EN_AZ_TEMIZ, YAVAS_ORAN: YAVAS_ORAN,
              stintleriCoz: stintleriCoz, ozet: ozet, pitKarsilastir: pitKarsilastir, yarisOturumuSec: yarisOturumuSec, yayimlandiMi: yayimlandiMi, bilesik: bilesik, BILESIK: BILESIK, CANLI_PENCERE_MS: CANLI_PENCERE_MS };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.LastikHesap = API; }
})(typeof window !== "undefined" ? window : null);
